import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Cache TTL: 24 hours.
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
  // Diagnostic info — visible in client toast when something goes wrong.
  diagnostics?: {
    strategiesTried: string[];
    rawHtmlBytes?: number;
    chunksFound?: number;
    blockedBy?: string;
  };
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

const REALISTIC_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

function buildScraperApiUrl(target: string, key: string): string {
  // Plain v1 endpoint — keeps it simple. ~10 reqs/sec on free tier.
  return `https://api.scraperapi.com/?api_key=${encodeURIComponent(key)}&url=${encodeURIComponent(target)}&country_code=us`;
}

interface FetchOutcome {
  html: string;
  bytes: number;
  blocked: boolean;       // looks like a captcha / blocked page
  source: string;         // strategy label for diagnostics
}

async function fetchHtml(url: string, signal: AbortSignal, strategy: string): Promise<FetchOutcome> {
  const useScraperApi = !!process.env.SCRAPER_API_KEY;
  const targetUrl = useScraperApi ? buildScraperApiUrl(url, process.env.SCRAPER_API_KEY!) : url;

  const res = await fetch(targetUrl, {
    signal,
    headers: useScraperApi ? {} : REALISTIC_HEADERS,
  });
  const html = res.ok ? await res.text() : "";
  const bytes = html.length;
  // Heuristic: blocked pages tend to be small (<5KB) or contain "captcha" / "Pardon Our Interruption" / "denied"
  const blocked = !res.ok || bytes < 5000 || /captcha|pardon our interruption|access denied|robot/i.test(html.slice(0, 8000));
  console.log(`[pc-parts/lookup] ${strategy}: status=${res.status} bytes=${bytes} blocked=${blocked}`);
  return { html, bytes, blocked, source: useScraperApi ? `${strategy}+scraperapi` : strategy };
}

function extractPrices(html: string): { samples: PriceSample[]; raw: number[]; chunks: number } {
  // Try multiple split patterns — eBay's HTML varies by page version.
  const splitPatterns: RegExp[] = [
    /<li[^>]*class="[^"]*s-item[^"]*"[^>]*>/g,
    /<div[^>]*class="[^"]*srp-river-results-listing[^"]*"[^>]*>/g,
    /<li[^>]*data-viewport[^>]*>/g,
    /<div[^>]*data-listing-id[^>]*>/g,
  ];
  let chunks: string[] = [];
  for (const pat of splitPatterns) {
    const split = html.split(pat).slice(1);
    if (split.length > chunks.length) chunks = split;
    if (chunks.length >= 5) break;
  }

  const raw: number[] = [];
  const samples: PriceSample[] = [];

  for (const chunk of chunks) {
    const titleMatch =
      chunk.match(/<span[^>]*role="heading"[^>]*>([^<]+)<\/span>/i) ||
      chunk.match(/<div[^>]*class="[^"]*s-item__title[^"]*"[^>]*>(?:<span[^>]*>)?([^<]+)<\/(?:span|div)>/i) ||
      chunk.match(/<span[^>]*class="[^"]*s-item__title[^"]*"[^>]*>([^<]+)<\/span>/i) ||
      chunk.match(/<h3[^>]*class="[^"]*s-item__title[^"]*"[^>]*>([^<]+)<\/h3>/i) ||
      chunk.match(/data-testid="item-title"[^>]*>([^<]+)</i);
    const cleanTitle = (titleMatch ? titleMatch[1] : "").replace(/\s+/g, " ").replace(/^new listing\s*/i, "").trim();
    if (!cleanTitle || /shop on ebay/i.test(cleanTitle)) continue;

    const priceMatch =
      chunk.match(/<span[^>]*class="[^"]*s-item__price[^"]*"[^>]*>[\s\S]{0,80}?\$([0-9,]+(?:\.\d{1,2})?)/i) ||
      chunk.match(/data-testid="item-price"[^>]*>[\s\S]{0,80}?\$([0-9,]+(?:\.\d{1,2})?)/i) ||
      chunk.match(/\$([0-9,]+(?:\.\d{1,2})?)/);
    if (!priceMatch) continue;
    const price = parseFloat(priceMatch[1].replace(/,/g, ""));
    if (isNaN(price) || price <= 1 || price > 100_000) continue;

    const urlMatch =
      chunk.match(/<a[^>]*class="[^"]*s-item__link[^"]*"[^>]*href="([^"]+)"/i) ||
      chunk.match(/<a[^>]*href="(https?:\/\/[^"]*\/itm\/[^"]+)"/i);
    const link = urlMatch ? urlMatch[1] : null;

    const condMatch =
      chunk.match(/<span[^>]*class="[^"]*SECONDARY_INFO[^"]*"[^>]*>([^<]+)<\/span>/i) ||
      chunk.match(/data-testid="item-condition"[^>]*>([^<]+)</i);
    const condition = condMatch ? condMatch[1].trim() : null;

    raw.push(price);
    if (samples.length < 8) samples.push({ title: cleanTitle, price, url: link, condition });
    if (raw.length >= 30) break;
  }

  return { samples, raw, chunks: chunks.length };
}

interface ScrapeResult {
  samples: PriceSample[];
  raw: number[];
  source: string;
  diagnostics: { strategiesTried: string[]; rawHtmlBytes: number; chunksFound: number; blockedBy?: string };
}

async function scrape(query: string, signal: AbortSignal): Promise<ScrapeResult> {
  const strategiesTried: string[] = [];
  let lastBytes = 0;
  let lastChunks = 0;
  let blockedBy: string | undefined;

  // Strategy chain — we stop on the first non-blocked, prices-found result.
  const strategies: Array<{ label: string; url: string }> = [
    {
      label: "ebay-sold-mobile",
      url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1&_ipg=60`,
    },
    {
      label: "ebay-active-mobile",
      url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sop=15&_ipg=60`,
    },
    {
      label: "ebay-sold-desktop",
      url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`,
    },
  ];

  for (const s of strategies) {
    strategiesTried.push(s.label);
    try {
      const out = await fetchHtml(s.url, signal, s.label);
      lastBytes = out.bytes;
      if (out.blocked) {
        blockedBy = blockedBy ?? s.label;
        continue;
      }
      const parsed = extractPrices(out.html);
      lastChunks = parsed.chunks;
      console.log(`[pc-parts/lookup] ${s.label}: chunks=${parsed.chunks} prices=${parsed.raw.length}`);
      if (parsed.raw.length > 0) {
        return {
          samples: parsed.samples,
          raw: parsed.raw,
          source: out.source,
          diagnostics: { strategiesTried, rawHtmlBytes: out.bytes, chunksFound: parsed.chunks },
        };
      }
    } catch (err) {
      console.error(`[pc-parts/lookup] ${s.label} error:`, err);
    }
  }

  return {
    samples: [],
    raw: [],
    source: "none",
    diagnostics: { strategiesTried, rawHtmlBytes: lastBytes, chunksFound: lastChunks, blockedBy },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { query?: string; forceRefresh?: boolean };
    const rawQuery = (body.query || "").trim();
    if (!rawQuery) return NextResponse.json({ error: "query required" }, { status: 400 });
    if (rawQuery.length < 3) return NextResponse.json({ error: "query too short" }, { status: 400 });

    const key = normalizeQuery(rawQuery);
    const supabase = await createClient();

    if (!body.forceRefresh) {
      const { data: cached } = await supabase
        .from("pc_part_price_cache").select("*").eq("query_key", key).maybeSingle();
      if (cached) {
        const age = Date.now() - new Date(cached.fetched_at).getTime();
        if (age < CACHE_TTL_MS && Number(cached.sample_count) > 0) {
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let result: ScrapeResult;
    try {
      result = await scrape(key, controller.signal);
    } finally {
      clearTimeout(timeout);
    }

    if (result.raw.length === 0) {
      const useScraperApi = !!process.env.SCRAPER_API_KEY;
      const hint = useScraperApi
        ? "ScraperAPI returned no results. Try a more specific part name."
        : "eBay is blocking the server (Vercel datacenter IPs). Set SCRAPER_API_KEY in Vercel env vars (free tier at scraperapi.com) to enable proxy fetching.";
      return NextResponse.json({
        query: rawQuery,
        median: null, avg: null, low: null, high: null,
        sampleCount: 0, samples: [], source: "none",
        cached: false, fetchedAt: new Date().toISOString(),
        error: hint,
        diagnostics: result.diagnostics,
      } as PriceLookup);
    }

    const trimmed = trimOutliers(result.raw);
    const med = Math.round(median(trimmed) * 100) / 100;
    const avg = Math.round((trimmed.reduce((s, n) => s + n, 0) / trimmed.length) * 100) / 100;
    const low = Math.round(Math.min(...trimmed) * 100) / 100;
    const high = Math.round(Math.max(...trimmed) * 100) / 100;

    await supabase.from("pc_part_price_cache").upsert({
      query_key: key,
      median: med, avg, low, high,
      sample_count: trimmed.length,
      samples: result.samples,
      source: result.source,
      fetched_at: new Date().toISOString(),
    }, { onConflict: "query_key" });

    return NextResponse.json({
      query: rawQuery,
      median: med, avg, low, high,
      sampleCount: trimmed.length,
      samples: result.samples,
      source: result.source,
      cached: false,
      fetchedAt: new Date().toISOString(),
      diagnostics: result.diagnostics,
    } as PriceLookup);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[pc-parts/lookup] uncaught:", msg);
    return NextResponse.json({
      query: "", median: null, avg: null, low: null, high: null,
      sampleCount: 0, samples: [], source: "error",
      cached: false, fetchedAt: new Date().toISOString(),
      error: msg,
    } as PriceLookup, { status: 500 });
  }
}
