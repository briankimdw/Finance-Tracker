"use client";

import { RefreshCw } from "lucide-react";
import { useMetalPrices } from "@/hooks/useMetalPrices";
import { METALS, METAL_KEYS } from "@/lib/metals";

export default function MetalPriceHeader() {
  const { prices, loading, refetch } = useMetalPrices();

  const updated = new Date(prices.timestamp);
  const timeStr = updated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const dateStr = updated.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Live Spot Prices</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {prices.source === "cache" && "Cached"}
            {prices.source === "live" && "Live"}
            {prices.source === "fallback" && "Offline"}
            {" • "}{dateStr} {timeStr}
          </span>
          <button onClick={refetch} disabled={loading} className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {METAL_KEYS.map((m) => (
          <div key={m} className={`rounded-lg p-3 ${METALS[m].bgClass} border border-transparent`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-medium ${METALS[m].textClass}`}>{METALS[m].name}</span>
              <span className={`text-[10px] font-medium ${METALS[m].textClass} opacity-70`}>{METALS[m].symbol}</span>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">${prices[m].toFixed(2)}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">per oz</p>
          </div>
        ))}
      </div>
    </div>
  );
}
