import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Cache TTL: 24 hours. eBay prices don't move fast.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface PriceSample {
  title: string;
  price: number;
  url: string | null;
  condition: string | null;
}

export interface PriceLookup {
  query: string;
  median: number | null;
  avg: number | null;
  low: number | null;
  high: number | null;
  sampleCount: number;
  samples: PriceSample[];
  source: string;
  cached: boolean;
  fetchedAt: string;
  error?: string;
}

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// Filter outliers using IQR. Helps when a single listing is way off (e.g. bundled
// or mislabeled).
function trimOutliers(nums: number[]): number[] {
  if (nums.length < 4) return nums;
  const sorted = [...nums].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return sorted.filter((n) => n >= lo && n <= hi);
}

/**
 * Scrape eBay sold listings for the given query. Returns raw parsed results.
 * This hits the public eBay HTML page — no API key needed — which means the
 * parser is fragile by nature. We're defensive: multiple regex fallbacks,
 * outlier trimming, sanity checks.
 */
async function scrapeEbaySold(query: string, signal: AbortSignal): Promise<{ samples: PriceSample[]; raw: number[] }> {
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1&rt=nc&_ipg=60`;
  const res = await fetch(url, {
    signal,
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Upgrade-Insecure-Requests": "1",
    },
  });
  if (!res.ok) {
    throw new Error(`eBay returned ${res.status}`);
  }
  const html = await res.text();
  console.log(`[pc-parts/lookup] "${query}" — html ${html.length} bytes`);

  // Try multiple split patterns. eBay's HTML varies by region/test cohort.
  const splitPatterns: RegExp[] = [
    /<li[^>]*class="[^"]*s-item[^"]*s-item__pl-on-bottom[^"]*"[^>]*>/g,
    /<li[^>]*class="[^"]*s-item__pl-on-bottom[^"]*"[^>]*>/g,
    /<li[^>]*class="[^"]*s-item[^"]*"[^>]*>/g,
    /<div[^>]*class="[^"]*s-item[^"]*"[^>]*>/g,
  ];
  let chunks: string[] = [];
  for (const pat of splitPatterns) {
    const split = html.split(pat).slice(1);
    if (split.length > chunks.length) chunks = split;
    if (chunks.length >= 5) break;
  }
  console.log(`[pc-parts/lookup] "${query}" — ${chunks.length} candidate item chunks`);

  const raw: number[] = [];
  const samples: PriceSample[] = [];

  for (const chunk of chunks) {
    // Title — try several known wrappers
    const titleMatch =
      chunk.match(/<span[^>]*role="heading"[^>]*>([^<]+)<\/span>/i) ||
      chunk.match(/<div[^>]*class="[^"]*s-item__title[^"]*"[^>]*>(?:<span[^>]*>)?([^<]+)<\/(?:span|div)>/i) ||
      chunk.match(/<span[^>]*class="[^"]*s-item__title[^"]*"[^>]*>([^<]+)<\/span>/i) ||
      chunk.match(/<h3[^>]*class="[^"]*s-item__title[^"]*"[^>]*>([^<]+)<\/h3>/i) ||
      chunk.match(/data-testid="item-title"[^>]*>([^<]+)</i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";
    if (!title || /shop on ebay/i.test(title) || /^new listing/i.test(title.trim())) {
      // skip but allow titles that legitimately start with "New Listing —" by stripping it
    }
    const cleanTitle = title.replace(/^new listing\s*/i, "").trim();
    if (!cleanTitle || /shop on ebay/i.test(cleanTitle)) continue;

    // Price — handle ranges, "Sold" prefix, and currency wrapping.
    // Common forms:
    //   <span class="s-item__price">$320.00</span>
    //   <span class="POSITIVE">$320.00</span>
    //   <span class="s-item__price"><span ...>$320.00 to $450.00</span></span>
    const priceMatch =
      chunk.match(/<span[^>]*class="[^"]*s-item__price[^"]*"[^>]*>[\s\S]{0,80}?\$([0-9,]+(?:\.\d{1,2})?)/i) ||
      chunk.match(/data-testid="item-price"[^>]*>[\s\S]{0,80}?\$([0-9,]+(?:\.\d{1,2})?)/i) ||
      chunk.match(/\$([0-9,]+(?:\.\d{1,2})?)/);
    if (!priceMatch) continue;
    const price = parseFloat(priceMatch[1].replace(/,/g, ""));
    if (isNaN(price) || price <= 1 || price > 100_000) continue;

    // URL to the listing
    const urlMatch =
      chunk.match(/<a[^>]*class="[^"]*s-item__link[^"]*"[^>]*href="([^"]+)"/i) ||
      chunk.match(/<a[^>]*href="(https?:\/\/[^"]*\/itm\/[^"]+)"/i);
    const link = urlMatch ? urlMatch[1] : null;

    // Condition chip (optional)
    const condMatch =
      chunk.match(/<span[^>]*class="[^"]*SECONDARY_INFO[^"]*"[^>]*>([^<]+)<\/span>/i) ||
      chunk.match(/data-testid="item-condition"[^>]*>([^<]+)</i);
    const condition = condMatch ? condMatch[1].trim() : null;

    raw.push(price);
    if (samples.length < 8) {
      samples.push({ title: cleanTitle, price, url: link, condition });
    }

    if (raw.length >= 30) break;
  }

  console.log(`[pc-parts/lookup] "${query}" — extracted ${raw.length} prices`);
  return { samples, raw };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { query?: string; forceRefresh?: boolean };
    const rawQuery = (body.query || "").trim();
    if (!rawQuery) {
      return NextResponse.json({ error: "query required" }, { status: 400 });
    }
    if (rawQuery.length < 3) {
      return NextResponse.json({ error: "query too short" }, { status: 400 });
    }

    const key = normalizeQuery(rawQuery);
    const supabase = await createClient();

    // Check cache
    if (!body.forceRefresh) {
      const { data: cached } = await supabase
        .from("pc_part_price_cache")
        .select("*")
        .eq("query_key", key)
        .maybeSingle();
      if (cached) {
        const age = Date.now() - new Date(cached.fetched_at).getTime();
        if (age < CACHE_TTL_MS) {
          return NextResponse.json({
            query: rawQuery,
            median: cached.median ? Number(cached.median) : null,
            avg: cached.avg ? Number(cached.avg) : null,
            low: cached.low ? Number(cached.low) : null,
            high: cached.high ? Number(cached.high) : null,
            sampleCount: cached.sample_count,
            samples: cached.samples || [],
            source: cached.source,
            cached: true,
            fetchedAt: cached.fetched_at,
          } as PriceLookup);
        }
      }
    }

    // Fresh scrape (with timeout guard)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let samples: PriceSample[] = [];
    let raw: number[] = [];
    try {
      const result = await scrapeEbaySold(key, controller.signal);
      samples = result.samples;
      raw = result.raw;
    } finally {
      clearTimeout(timeout);
    }

    if (raw.length === 0) {
      return NextResponse.json({
        query: rawQuery,
        median: null, avg: null, low: null, high: null,
        sampleCount: 0, samples: [], source: "ebay_sold",
        cached: false, fetchedAt: new Date().toISOString(),
        error: "No sold listings found. Try a more specific part name.",
      } as PriceLookup);
    }

    const trimmed = trimOutliers(raw);
    const med = Math.round(median(trimmed) * 100) / 100;
    const avg = Math.round((trimmed.reduce((s, n) => s + n, 0) / trimmed.length) * 100) / 100;
    const low = Math.round(Math.min(...trimmed) * 100) / 100;
    const high = Math.round(Math.max(...trimmed) * 100) / 100;

    // Write-through cache
    await supabase.from("pc_part_price_cache").upsert(
      {
        query_key: key,
        median: med, avg, low, high,
        sample_count: trimmed.length,
        samples: samples,
        source: "ebay_sold",
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "query_key" }
    );

    return NextResponse.json({
      query: rawQuery,
      median: med, avg, low, high,
      sampleCount: trimmed.length,
      samples,
      source: "ebay_sold",
      cached: false,
      fetchedAt: new Date().toISOString(),
    } as PriceLookup);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        query: "",
        median: null, avg: null, low: null, high: null,
        sampleCount: 0, samples: [], source: "ebay_sold",
        cached: false, fetchedAt: new Date().toISOString(),
        error: msg,
      } as PriceLookup,
      { status: 500 }
    );
  }
}
