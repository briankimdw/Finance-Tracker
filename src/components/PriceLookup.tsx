"use client";

/**
 * Quick price-comp helper. Given an item name, renders a row of one-click
 * "search this on…" links: eBay sold, Mercari, Google Shopping, Amazon,
 * Facebook Marketplace.
 *
 * We used to scrape eBay sold prices server-side, but that gets rate-limited
 * and blocked — most of the time it returned "eBay blocked the request" so
 * the ⚡ button was useless. Direct deep-links are 100% reliable: the user
 * clicks one and lands on a real comp page in eBay/Mercari/etc.
 *
 * The `onApply` prop is no longer used (kept for API compat — callers can
 * remove it in their next pass). We don't auto-fill any value.
 */

import { Search, ExternalLink } from "lucide-react";

interface Props {
  query: string;
  // Kept for backward compatibility with existing callers; no longer invoked
  // since we removed the unreliable scrape path.
  onApply?: (price: number) => void;
  // Visual size — "sm" fits inline next to inputs, "md" for stand-alone rows.
  size?: "sm" | "md";
  // Hide the help text under the links
  compact?: boolean;
}

function externalLinks(query: string) {
  const q = encodeURIComponent(query.trim());
  return [
    { label: "eBay sold", url: `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1` },
    { label: "eBay live", url: `https://www.ebay.com/sch/i.html?_nkw=${q}` },
    { label: "Mercari", url: `https://www.mercari.com/search/?keyword=${q}&status=sold_out` },
    { label: "Google Shopping", url: `https://www.google.com/search?tbm=shop&q=${q}` },
    { label: "Amazon", url: `https://www.amazon.com/s?k=${q}` },
    { label: "Facebook MP", url: `https://www.facebook.com/marketplace/search/?query=${q}` },
  ];
}

export default function PriceLookup({ query, size = "sm", compact = false }: Props) {
  const small = size === "sm";
  const trimmed = query.trim();
  const enabled = trimmed.length >= 3;
  const links = externalLinks(trimmed);

  return (
    <div className={small ? "text-xs" : "text-sm"}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 font-medium">
          <Search size={small ? 11 : 13} />
          <span className={small ? "text-[11px]" : "text-xs"}>Comp price:</span>
        </span>
        {enabled ? (
          links.map((l) => (
            <a
              key={l.label}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-0.5 rounded-md font-medium transition-colors bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/60 hover:bg-blue-100 dark:hover:bg-blue-900/50 ${
                small ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs"
              }`}
            >
              {l.label}
              <ExternalLink size={small ? 9 : 10} />
            </a>
          ))
        ) : (
          <span className="text-gray-400 dark:text-gray-500 text-[11px]">type at least 3 characters</span>
        )}
      </div>

      {!compact && enabled && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
          Opens the actual sold-listings page in a new tab — eyeball the median yourself, then come back and enter it.
        </p>
      )}
    </div>
  );
}
