"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign, Link as LinkIcon, Search, Plus, X, ChevronDown, ChevronUp, Store, Zap,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type {
  PCDeal,
  PCDealPart,
  PCDealStatus,
  PCPartCategory,
} from "@/lib/types";

const SOURCES = [
  "Facebook Marketplace",
  "Craigslist",
  "OfferUp",
  "eBay",
  "Reddit",
  "Other",
];

const CONDITIONS = [
  { value: "used", label: "Used" },
  { value: "like-new", label: "Like new" },
  { value: "for-parts", label: "For parts" },
];

export const PART_CATEGORIES: { value: PCPartCategory; emoji: string; label: string }[] = [
  { value: "cpu", emoji: "\u{1F5A5}", label: "CPU" },
  { value: "gpu", emoji: "\u{1F3AE}", label: "GPU" },
  { value: "ram", emoji: "\u{1F4BE}", label: "RAM" },
  { value: "storage", emoji: "\u{1F4BF}", label: "Storage" },
  { value: "psu", emoji: "\u{1F50C}", label: "PSU" },
  { value: "motherboard", emoji: "\u{1F527}", label: "Motherboard" },
  { value: "case", emoji: "\u{1F4E6}", label: "Case" },
  { value: "cooler", emoji: "\u{2744}\u{FE0F}", label: "Cooler" },
  { value: "monitor", emoji: "\u{1F5BC}", label: "Monitor" },
  { value: "peripheral", emoji: "\u{1F3B9}", label: "Peripheral" },
  { value: "other", emoji: "\u{1F4E6}", label: "Other" },
];

export function getCategoryMeta(cat: PCPartCategory): { emoji: string; label: string } {
  return PART_CATEGORIES.find((c) => c.value === cat) ?? PART_CATEGORIES[PART_CATEGORIES.length - 1];
}

export type PricingSearchLink = { label: string; url: string };

export function buildPricingSearchLinks(partName: string): PricingSearchLink[] {
  const q = encodeURIComponent(partName.trim());
  return [
    { label: "eBay sold", url: `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1` },
    { label: "Newegg", url: `https://www.newegg.com/p/pl?d=${q}` },
    { label: "Amazon", url: `https://www.amazon.com/s?k=${q}` },
    { label: "PCPartPicker", url: `https://pcpartpicker.com/search/?q=${q}` },
    { label: "UserBenchmark", url: `https://www.userbenchmark.com/Search?searchTerm=${q}` },
  ];
}

function verdictFromMargin(margin: number): { key: "great" | "good" | "fair" | "skip"; label: string; classes: string } {
  if (margin > 30) return { key: "great", label: "Great deal", classes: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800" };
  if (margin >= 15) return { key: "good", label: "Good buy", classes: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800" };
  if (margin >= 5) return { key: "fair", label: "Fair margin", classes: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800" };
  return { key: "skip", label: "Skip", classes: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800" };
}

export interface DraftPart {
  // local-only id while composing
  _key: string;
  id?: string;            // real id when editing
  category: PCPartCategory;
  name: string;
  estimated_value: string; // kept as string while typing
  condition: string | null;
  notes: string | null;
}

export interface PCDealFormData {
  name: string;
  source: string | null;
  listing_url: string | null;
  asking_price: number;
  seller_notes: string | null;
  condition: string | null;
  status?: PCDealStatus;
  parts: DraftPart[];
  removedPartIds: string[];
}

interface AddPCDealModalProps {
  isOpen: boolean;
  deal?: PCDeal | null;
  existingParts?: PCDealPart[];
  onClose: () => void;
  onSave: (data: PCDealFormData) => Promise<void>;
}

function makeKey(): string {
  return `k_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function AddPCDealModal({ isOpen, deal, existingParts, onClose, onSave }: AddPCDealModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    source: "Facebook Marketplace",
    custom_source: "",
    listing_url: "",
    asking_price: "",
    seller_notes: "",
    condition: "used",
  });
  const [parts, setParts] = useState<DraftPart[]>([]);
  const [removedPartIds, setRemovedPartIds] = useState<string[]>([]);
  const [expandedPriceKey, setExpandedPriceKey] = useState<string | null>(null);
  // per-part lookup state keyed by part _key
  type LookupSample = { title: string; price: number; url: string | null; condition: string | null };
  const [lookups, setLookups] = useState<Record<string, { status: "idle" | "loading" | "ok" | "error"; median?: number; avg?: number; low?: number; high?: number; sampleCount?: number; samples?: LookupSample[]; error?: string }>>({});

  // Fire an eBay sold-listings lookup for a given part. `mode`:
  //   - "auto"   : fill the value only if user hasn't typed anything yet (used by onBlur)
  //   - "force"  : always overwrite the value with the median (used by ⚡ button)
  //   - "preview": just show results, don't touch the value
  const lookupPrice = async (key: string, query: string, mode: "auto" | "force" | "preview" = "auto") => {
    const q = query.trim();
    if (q.length < 3) return;
    setLookups((prev) => ({ ...prev, [key]: { status: "loading" } }));
    try {
      const res = await fetch("/api/pc-parts/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, forceRefresh: mode === "force" }),
      });
      const data = await res.json();
      if (!res.ok) {
        const reason = data?.error || `eBay lookup failed (${res.status})`;
        setLookups((prev) => ({ ...prev, [key]: { status: "error", error: reason } }));
        return;
      }
      if (data.median === null || data.sampleCount === 0) {
        setLookups((prev) => ({ ...prev, [key]: { status: "error", error: data.error || "No sold listings found" } }));
        return;
      }
      setLookups((prev) => ({
        ...prev,
        [key]: {
          status: "ok",
          median: Number(data.median),
          avg: Number(data.avg),
          low: Number(data.low),
          high: Number(data.high),
          sampleCount: Number(data.sampleCount),
          samples: Array.isArray(data.samples) ? data.samples : [],
        },
      }));
      if (mode === "force") {
        updatePart(key, { estimated_value: String(data.median) });
      } else if (mode === "auto") {
        const current = parts.find((p) => p._key === key);
        const existing = parseFloat(current?.estimated_value || "");
        if (!existing || existing === 0) {
          updatePart(key, { estimated_value: String(data.median) });
        }
      }
    } catch (err) {
      setLookups((prev) => ({ ...prev, [key]: { status: "error", error: err instanceof Error ? err.message : "Network error" } }));
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (deal) {
      const src = deal.source ?? "";
      const isKnown = SOURCES.includes(src);
      setForm({
        name: deal.name,
        source: isKnown ? src : (src ? "Other" : "Facebook Marketplace"),
        custom_source: isKnown ? "" : src,
        listing_url: deal.listing_url ?? "",
        asking_price: String(deal.asking_price ?? ""),
        seller_notes: deal.seller_notes ?? "",
        condition: deal.condition ?? "used",
      });
      const initial: DraftPart[] = (existingParts ?? []).map((p) => ({
        _key: makeKey(),
        id: p.id,
        category: p.category,
        name: p.name,
        estimated_value: String(p.estimated_value ?? ""),
        condition: p.condition,
        notes: p.notes,
      }));
      setParts(initial);
      setRemovedPartIds([]);
    } else {
      setForm({
        name: "",
        source: "Facebook Marketplace",
        custom_source: "",
        listing_url: "",
        asking_price: "",
        seller_notes: "",
        condition: "used",
      });
      setParts([]);
      setRemovedPartIds([]);
    }
    setExpandedPriceKey(null);
  }, [deal, existingParts, isOpen]);

  const update = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const addPart = () => {
    setParts((p) => [
      ...p,
      { _key: makeKey(), category: "gpu", name: "", estimated_value: "", condition: null, notes: null },
    ]);
  };

  const updatePart = (key: string, patch: Partial<DraftPart>) => {
    setParts((prev) => prev.map((p) => (p._key === key ? { ...p, ...patch } : p)));
  };

  const removePart = (key: string) => {
    setParts((prev) => {
      const victim = prev.find((p) => p._key === key);
      if (victim?.id) {
        setRemovedPartIds((rp) => [...rp, victim.id!]);
      }
      return prev.filter((p) => p._key !== key);
    });
    if (expandedPriceKey === key) setExpandedPriceKey(null);
  };

  const askingPriceNum = parseFloat(form.asking_price) || 0;
  const totalPartsValue = useMemo(
    () =>
      parts.reduce((s, p) => s + (parseFloat(p.estimated_value) || 0), 0),
    [parts]
  );
  const potentialProfit = totalPartsValue - askingPriceNum;
  const profitMargin = askingPriceNum > 0 ? (potentialProfit / askingPriceNum) * 100 : 0;
  const verdict = verdictFromMargin(profitMargin);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    const chosenSource =
      form.source === "Other" ? (form.custom_source.trim() || null) : form.source;
    try {
      await onSave({
        name: form.name.trim(),
        source: chosenSource,
        listing_url: form.listing_url.trim() || null,
        asking_price: askingPriceNum,
        seller_notes: form.seller_notes.trim() || null,
        condition: form.condition || null,
        parts,
        removedPartIds,
      });
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 text-sm";
  const labelClass = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1";

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={deal ? "Edit PC Deal" : "New PC Deal"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className={labelClass}>Listing name *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className={inputClass}
            placeholder="RTX 4070 Gaming PC on FB"
          />
        </div>

        {/* Source + listing URL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass + " flex items-center gap-1"}>
              <Store size={11} /> Source
            </label>
            <select
              value={form.source}
              onChange={(e) => update("source", e.target.value)}
              className={inputClass}
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {form.source === "Other" && (
              <input
                type="text"
                value={form.custom_source}
                onChange={(e) => update("custom_source", e.target.value)}
                className={inputClass + " mt-2"}
                placeholder="Where did you find it?"
              />
            )}
          </div>
          <div>
            <label className={labelClass + " flex items-center gap-1"}>
              <LinkIcon size={11} /> Listing URL
            </label>
            <input
              type="url"
              value={form.listing_url}
              onChange={(e) => update("listing_url", e.target.value)}
              className={inputClass}
              placeholder="https://..."
            />
          </div>
        </div>

        {/* Asking price + condition */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass + " flex items-center gap-1"}>
              <DollarSign size={11} /> Asking price *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.asking_price}
              onChange={(e) => update("asking_price", e.target.value)}
              className={inputClass}
              placeholder="900.00"
            />
          </div>
          <div>
            <label className={labelClass}>Condition</label>
            <select
              value={form.condition}
              onChange={(e) => update("condition", e.target.value)}
              className={inputClass}
            >
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Seller notes */}
        <div>
          <label className={labelClass}>Seller notes <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span></label>
          <textarea
            value={form.seller_notes}
            onChange={(e) => update("seller_notes", e.target.value)}
            rows={2}
            className={inputClass + " resize-none"}
            placeholder="Paste the listing description..."
          />
        </div>

        {/* Parts section */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Parts in this build
            </h3>
            <button
              type="button"
              onClick={addPart}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              <Plus size={12} /> Add part
            </button>
          </div>
          {parts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 px-4 py-5 text-center text-xs text-gray-500 dark:text-gray-400">
              Add each component (CPU, GPU, RAM, etc.) with an estimated resale value to see the potential profit.
            </div>
          ) : (
            <div className="space-y-2">
              {parts.map((p) => {
                const expanded = expandedPriceKey === p._key;
                const links = buildPricingSearchLinks(p.name);
                const meta = getCategoryMeta(p.category);
                return (
                  <div key={p._key} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
                    <div className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-4 sm:col-span-3">
                        <select
                          value={p.category}
                          onChange={(e) => updatePart(p._key, { category: e.target.value as PCPartCategory })}
                          className={inputClass + " !px-2 !py-2 text-xs"}
                          aria-label="Part category"
                        >
                          {PART_CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.emoji} {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-8 sm:col-span-5">
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => updatePart(p._key, { name: e.target.value })}
                          onBlur={() => {
                            // Auto-fetch on blur if name set + no successful lookup yet
                            const status = lookups[p._key]?.status;
                            if (p.name.trim().length >= 3 && status !== "ok" && status !== "loading") {
                              lookupPrice(p._key, p.name, "auto");
                            }
                          }}
                          className={inputClass + " !py-2 text-xs"}
                          placeholder={`${meta.label} model / name`}
                        />
                      </div>
                      <div className="col-span-9 sm:col-span-3">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-xs">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={p.estimated_value}
                            onChange={(e) => updatePart(p._key, { estimated_value: e.target.value })}
                            className={inputClass + " !pl-6 !py-2 text-xs"}
                            placeholder="250"
                            aria-label="Estimated resale value"
                          />
                        </div>
                      </div>
                      <div className="col-span-3 sm:col-span-1 flex items-center gap-1 justify-end">
                        <button
                          type="button"
                          onClick={() => lookupPrice(p._key, p.name, "force")}
                          disabled={!p.name.trim() || lookups[p._key]?.status === "loading"}
                          title={p.name.trim() ? "Auto-fill from eBay sold listings (overrides current value)" : "Type a part name first"}
                          className="text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-30 disabled:hover:text-gray-400 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 relative"
                        >
                          {lookups[p._key]?.status === "loading" ? (
                            <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/><path fill="currentColor" d="M4 12a8 8 0 018-8V2.5a9.5 9.5 0 00-9.5 9.5H4z"/></svg>
                          ) : (
                            <Zap size={13} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedPriceKey(expanded ? null : p._key)}
                          disabled={!p.name.trim()}
                          title={p.name.trim() ? "Check prices on eBay / Newegg / Amazon" : "Type a part name first"}
                          className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-30 disabled:hover:text-gray-400 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <Search size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removePart(p._key)}
                          className="text-gray-300 dark:text-gray-600 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40"
                          aria-label="Remove part"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Lookup result + recent sales */}
                    {lookups[p._key]?.status === "ok" && (
                      <div className="mt-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1.5 border border-emerald-100 dark:border-emerald-900">
                        <div className="flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-300">
                          <Zap size={10} />
                          <span className="font-medium">eBay median ${lookups[p._key].median?.toFixed(2)}</span>
                          <span className="text-emerald-600/70 dark:text-emerald-400/70">
                            · {lookups[p._key].sampleCount} sold · ${lookups[p._key].low?.toFixed(0)}–${lookups[p._key].high?.toFixed(0)}
                          </span>
                          <button
                            type="button"
                            onClick={() => updatePart(p._key, { estimated_value: String(lookups[p._key].median) })}
                            className="ml-auto text-emerald-700 dark:text-emerald-300 hover:underline font-medium"
                            title="Apply median to estimated value"
                          >
                            Use
                          </button>
                        </div>
                        {lookups[p._key].samples && lookups[p._key].samples!.length > 0 && (
                          <details className="mt-1 group/det">
                            <summary className="cursor-pointer text-[10px] text-emerald-600/80 dark:text-emerald-400/80 hover:text-emerald-700 dark:hover:text-emerald-300 select-none list-none flex items-center gap-1">
                              <ChevronDown size={10} className="transition-transform group-open/det:rotate-180" />
                              See {lookups[p._key].samples!.length} recent sales
                            </summary>
                            <div className="mt-1.5 space-y-0.5">
                              {lookups[p._key].samples!.map((s, i) => (
                                <div key={i} className="flex items-center gap-2 text-[11px]">
                                  <span className="font-bold text-gray-900 dark:text-gray-100 tabular-nums w-12">${s.price.toFixed(2)}</span>
                                  <a href={s.url || "#"} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                                    {s.title}
                                  </a>
                                  {s.condition && <span className="text-[9px] text-gray-400 dark:text-gray-500 shrink-0 uppercase tracking-wider">{s.condition}</span>}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                    {lookups[p._key]?.status === "error" && (
                      <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md px-2 py-1">
                        ⚠ {lookups[p._key].error}
                      </p>
                    )}
                    <AnimatePresence initial={false}>
                      {expanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ type: "spring", damping: 28, stiffness: 260 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-1.5">
                            {links.map((l) => (
                              <a
                                key={l.label}
                                href={l.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                              >
                                <Search size={10} /> {l.label}
                              </a>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live verdict summary */}
        <div className={`rounded-2xl border p-4 ${verdict.classes}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                Live estimate
              </p>
              <p className="text-2xl font-bold tabular-nums mt-0.5">
                {potentialProfit >= 0 ? "+" : "-"}${Math.abs(potentialProfit).toFixed(2)}
              </p>
              <p className="text-[11px] mt-0.5 opacity-90">
                Parts worth ${totalPartsValue.toFixed(2)} vs ${askingPriceNum.toFixed(2)} asking
                {askingPriceNum > 0 && (
                  <> &middot; {profitMargin.toFixed(0)}% margin</>
                )}
              </p>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 bg-white/60 dark:bg-black/20">
              {verdict.label}
            </span>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 px-4 rounded-lg text-white text-sm font-medium bg-blue-600 hover:bg-blue-700 transition-all hover:shadow-lg hover:shadow-blue-600/20 disabled:opacity-50"
          >
            {loading ? "Saving..." : deal ? "Save changes" : "Create deal"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}

// Re-export helpers used by the details sheet
export { verdictFromMargin };

// Helper to reveal/hide price links — used by parent components if needed.
export function useExpandablePriceLinks() {
  const [open, setOpen] = useState<string | null>(null);
  return {
    open,
    toggle: (id: string) => setOpen((cur) => (cur === id ? null : id)),
    close: () => setOpen(null),
    Chevron: ({ id }: { id: string }) => (open === id ? <ChevronUp size={12} /> : <ChevronDown size={12} />),
  };
}
