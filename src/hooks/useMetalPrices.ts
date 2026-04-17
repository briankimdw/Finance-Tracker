"use client";

import { useCallback, useEffect, useState } from "react";
import { METALS } from "@/lib/metals";
import type { MetalPrices } from "@/lib/types";

const CACHE_KEY = "networth-metal-prices";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const FALLBACK: MetalPrices = {
  gold: METALS.gold.defaultPrice,
  silver: METALS.silver.defaultPrice,
  platinum: METALS.platinum.defaultPrice,
  palladium: METALS.palladium.defaultPrice,
  timestamp: new Date().toISOString(),
  source: "fallback",
};

export function useMetalPrices() {
  const [prices, setPrices] = useState<MetalPrices>(FALLBACK);
  const [loading, setLoading] = useState(true);

  const fetchPrices = useCallback(async (force = false) => {
    setLoading(true);
    try {
      if (!force && typeof window !== "undefined") {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as { prices: MetalPrices; cachedAt: number };
          if (Date.now() - parsed.cachedAt < CACHE_TTL_MS) {
            setPrices(parsed.prices);
            setLoading(false);
            return;
          }
        }
      }

      const res = await fetch("/api/metal-prices", { cache: "no-store" });
      const data = (await res.json()) as MetalPrices;
      setPrices(data);

      if (typeof window !== "undefined") {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ prices: data, cachedAt: Date.now() }));
      }
    } catch {
      setPrices(FALLBACK);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  return { prices, loading, refetch: () => fetchPrices(true) };
}
