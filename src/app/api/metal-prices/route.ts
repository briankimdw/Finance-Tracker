import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { METALS } from "@/lib/metals";

interface MetalPriceApiResponse {
  success: boolean;
  rates?: { USDXAU?: number; USDXAG?: number; USDXPT?: number; USDXPD?: number };
}

const FALLBACK = {
  gold: METALS.gold.defaultPrice,
  silver: METALS.silver.defaultPrice,
  platinum: METALS.platinum.defaultPrice,
  palladium: METALS.palladium.defaultPrice,
};

export async function GET() {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];

    // Check cache first
    const { data: cached } = await supabase
      .from("cached_metal_prices")
      .select("*")
      .eq("fetched_at", today)
      .maybeSingle();

    if (cached && cached.gold && cached.silver) {
      return NextResponse.json({
        gold: Number(cached.gold),
        silver: Number(cached.silver),
        platinum: Number(cached.platinum),
        palladium: Number(cached.palladium),
        timestamp: cached.created_at,
        source: "cache",
      });
    }

    // Fetch live
    const apiKey = process.env.METAL_PRICE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ...FALLBACK, timestamp: new Date().toISOString(), source: "fallback" });
    }

    const url = `https://api.metalpriceapi.com/v1/latest?api_key=${apiKey}&base=USD&currencies=XAU,XAG,XPT,XPD`;
    const res = await fetch(url, { cache: "no-store" });
    const data: MetalPriceApiResponse = await res.json();

    if (!data.success || !data.rates) {
      return NextResponse.json({ ...FALLBACK, timestamp: new Date().toISOString(), source: "fallback" });
    }

    const prices = {
      gold: data.rates.USDXAU ? 1 / data.rates.USDXAU : FALLBACK.gold,
      silver: data.rates.USDXAG ? 1 / data.rates.USDXAG : FALLBACK.silver,
      platinum: data.rates.USDXPT ? 1 / data.rates.USDXPT : FALLBACK.platinum,
      palladium: data.rates.USDXPD ? 1 / data.rates.USDXPD : FALLBACK.palladium,
    };

    // Cache fire-and-forget
    supabase
      .from("cached_metal_prices")
      .upsert({ fetched_at: today, ...prices }, { onConflict: "fetched_at" })
      .then(() => {});

    return NextResponse.json({ ...prices, timestamp: new Date().toISOString(), source: "live" });
  } catch {
    return NextResponse.json({ ...FALLBACK, timestamp: new Date().toISOString(), source: "fallback" });
  }
}
