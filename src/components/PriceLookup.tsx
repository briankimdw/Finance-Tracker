"use client";

/**
 * Reusable eBay sold-listings lookup chip.
 *
 * Pass a query (the item name) and a callback that receives the suggested
 * median price. We hit the same /api/pc-parts/lookup endpoint that PC Deals
 * use — it just queries eBay sold listings for any string. Works for any
 * resellable item, not just PC parts.
 *
 * Two trigger modes:
 *   - <PriceLookup query={name} onApply={...} />               : button only
 *   - <PriceLookup query={name} onApply={...} autoOnBlurKey="x" />
 *     If you wire `autoOnBlurKey` to the input's onBlur, the lookup fires
 *     automatically when the user finishes typing — but only fills the value
 *     if it's currently empty. The ⚡ button always overwrites.
 */

import { useState } from "react";
import { Zap, Search, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Sample = { title: string; price: number; url: string | null; condition: string | null };

type Status = "idle" | "loading" | "ok" | "error";

interface Lookup {
  status: Status;
  median?: number;
  avg?: number;
  low?: number;
  high?: number;
  sampleCount?: number;
  samples?: Sample[];
  error?: string;
}

interface Props {
  query: string;
  // Called with the suggested price (median) when the user clicks "Use price"
  // or implicitly when they hit ⚡ in `auto` mode and the field was empty.
  onApply: (price: number) => void;
  // Optional: also receive a sales-comp summary string for storing in notes etc.
  onSummary?: (summary: string) => void;
  // Visual size — "sm" fits inline next to inputs, "md" for stand-alone rows.
  size?: "sm" | "md";
  // If true, ⚡ overwrites the current value with median. Otherwise just shows results.
  alwaysOverwrite?: boolean;
  // Hide the recent-sales drilldown disclosure
  compact?: boolean;
  // Disable the button (e.g. while the parent is saving)
  disabled?: boolean;
}

// External price-shopping links the user can fall back to if our scrape fails
function externalLinks(query: string) {
  const q = encodeURIComponent(query.trim());
  return [
    { label: "eBay sold", url: `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1` },
    { label: "Mercari", url: `https://www.mercari.com/search/?keyword=${q}&status=sold_out` },
    { label: "Google Shopping", url: `https://www.google.com/search?tbm=shop&q=${q}` },
    { label: "Amazon", url: `https://www.amazon.com/s?k=${q}` },
    { label: "Facebook MP", url: `https://www.facebook.com/marketplace/search/?query=${q}` },
  ];
}

export default function PriceLookup({
  query,
  onApply,
  onSummary,
  size = "sm",
  alwaysOverwrite = false,
  compact = false,
  disabled = false,
}: Props) {
  const [lookup, setLookup] = useState<Lookup>({ status: "idle" });
  const [expanded, setExpanded] = useState(false);

  const fire = async () => {
    const q = query.trim();
    if (q.length < 3) {
      setLookup({ status: "error", error: "Type at least 3 characters first" });
      return;
    }
    setLookup({ status: "loading" });
    try {
      const res = await fetch("/api/pc-parts/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, forceRefresh: alwaysOverwrite }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLookup({ status: "error", error: data?.error || `Lookup failed (${res.status})` });
        return;
      }
      if (data.median === null || data.sampleCount === 0) {
        const diag = data.diagnostics ? ` (tried: ${(data.diagnostics.strategiesTried || []).join(", ")})` : "";
        setLookup({ status: "error", error: (data.error || "No listings found") + diag });
        return;
      }
      const next: Lookup = {
        status: "ok",
        median: Number(data.median),
        avg: Number(data.avg),
        low: Number(data.low),
        high: Number(data.high),
        sampleCount: Number(data.sampleCount),
        samples: Array.isArray(data.samples) ? data.samples : [],
      };
      setLookup(next);
      if (alwaysOverwrite && typeof next.median === "number") {
        onApply(next.median);
      }
      if (onSummary && typeof next.median === "number" && next.sampleCount) {
        onSummary(
          `eBay sold (${next.sampleCount}): median $${next.median.toFixed(2)}` +
            (typeof next.low === "number" && typeof next.high === "number"
              ? ` (range $${next.low.toFixed(2)}–$${next.high.toFixed(2)})`
              : "")
        );
      }
    } catch (err) {
      setLookup({ status: "error", error: err instanceof Error ? err.message : "Network error" });
    }
  };

  const small = size === "sm";
  const links = externalLinks(query);

  return (
    <div className={small ? "text-xs" : "text-sm"}>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={fire}
          disabled={disabled || lookup.status === "loading" || query.trim().length < 3}
          className={`inline-flex items-center gap-1.5 rounded-md font-medium transition-all ${
            small ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs"
          } ${
            lookup.status === "loading"
              ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-wait"
              : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title="Look up recent eBay sold prices"
        >
          <Zap size={small ? 11 : 12} />
          {lookup.status === "loading" ? "Looking…" : "Lookup"}
        </button>

        {lookup.status === "ok" && lookup.median != null && (
          <>
            <span className="text-gray-500 dark:text-gray-400">
              <span className="text-gray-400 dark:text-gray-500">median</span>{" "}
              <span className="font-semibold text-gray-900 dark:text-gray-100">${lookup.median.toFixed(2)}</span>
              {lookup.sampleCount ? (
                <span className="text-gray-400 dark:text-gray-500"> · n={lookup.sampleCount}</span>
              ) : null}
            </span>
            {!alwaysOverwrite && (
              <button
                type="button"
                onClick={() => onApply(lookup.median!)}
                className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Use price
              </button>
            )}
            {!compact && lookup.samples && lookup.samples.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="ml-auto inline-flex items-center gap-0.5 text-[10px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                Recent sales {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
            )}
          </>
        )}

        {lookup.status === "error" && (
          <span className="text-[11px] text-red-600 dark:text-red-400 truncate" title={lookup.error}>
            {lookup.error}
          </span>
        )}
      </div>

      {/* Range chips */}
      {lookup.status === "ok" && typeof lookup.low === "number" && typeof lookup.high === "number" && (
        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-gray-400 dark:text-gray-500">
          <span>low ${lookup.low.toFixed(0)}</span>
          <span>·</span>
          <span>avg ${lookup.avg?.toFixed(0)}</span>
          <span>·</span>
          <span>high ${lookup.high.toFixed(0)}</span>
        </div>
      )}

      {/* Recent sales drilldown */}
      <AnimatePresence>
        {expanded && lookup.samples && lookup.samples.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 space-y-1 overflow-hidden"
          >
            {lookup.samples.slice(0, 8).map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-800 rounded-md px-2 py-1 bg-gray-50 dark:bg-gray-800/50">
                <span className="font-semibold text-gray-900 dark:text-gray-100 w-14 shrink-0">${s.price.toFixed(2)}</span>
                <span className="flex-1 truncate" title={s.title}>{s.title}</span>
                {s.url && (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline shrink-0">
                    <ExternalLink size={11} />
                  </a>
                )}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {/* External fallback links — always shown so users can comp manually if scrape is blocked */}
      {!compact && (
        <div className="mt-2 flex items-center gap-1 flex-wrap text-[10px]">
          <Search size={10} className="text-gray-400 dark:text-gray-500" />
          <span className="text-gray-400 dark:text-gray-500">Search:</span>
          {links.map((l) => (
            <a
              key={l.label}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
