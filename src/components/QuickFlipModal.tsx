"use client";

/**
 * QuickFlipModal — a streamlined "single-item flip" entry point for the PC
 * Deals workflow. The full AddPCDealModal is built around evaluating a
 * multi-part PC build; this modal handles the much more common case of
 * flipping a single component or peripheral (a keyboard, mouse, GPU, RAM
 * stick) where you just need:
 *   - Item name
 *   - What you're paying
 *   - What it's actually worth (built-in eBay sold lookup)
 *
 * Saves as a normal pc_deals row with a single pc_deal_parts entry, so it
 * shows up in the same list and can later be marked purchased/sold.
 */

import { useEffect, useState } from "react";
import { Zap, X, Sparkles } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import PriceLookup from "@/components/PriceLookup";
import type { PCPartCategory } from "@/lib/types";

const SOURCES = ["Facebook Marketplace", "Craigslist", "OfferUp", "eBay", "Reddit", "Other"];

const CATEGORIES: { value: PCPartCategory; label: string; emoji: string }[] = [
  { value: "peripheral", label: "Peripheral (keyboard / mouse / etc.)", emoji: "\u{1F3B9}" },
  { value: "gpu", label: "GPU", emoji: "\u{1F3AE}" },
  { value: "cpu", label: "CPU", emoji: "\u{1F5A5}" },
  { value: "ram", label: "RAM", emoji: "\u{1F4BE}" },
  { value: "storage", label: "Storage (SSD/HDD)", emoji: "\u{1F4BF}" },
  { value: "motherboard", label: "Motherboard", emoji: "\u{1F527}" },
  { value: "psu", label: "PSU", emoji: "\u{1F50C}" },
  { value: "cooler", label: "Cooler", emoji: "\u{2744}\u{FE0F}" },
  { value: "case", label: "Case", emoji: "\u{1F4E6}" },
  { value: "monitor", label: "Monitor", emoji: "\u{1F5BC}" },
  { value: "other", label: "Other", emoji: "\u{1F4E6}" },
];

export interface QuickFlipData {
  name: string;
  category: PCPartCategory;
  asking_price: number;
  estimated_value: number;
  source: string | null;
  listing_url: string | null;
  notes: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: QuickFlipData) => Promise<void>;
  // Optional pre-fill (e.g. coming from /pc-deals Quick Lookup)
  defaultName?: string;
  defaultEstimatedValue?: number;
}

export default function QuickFlipModal({ isOpen, onClose, onSave, defaultName, defaultEstimatedValue }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PCPartCategory>("peripheral");
  const [askingPrice, setAskingPrice] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [source, setSource] = useState("Facebook Marketplace");
  const [listingUrl, setListingUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(defaultName ?? "");
    setCategory("peripheral");
    setAskingPrice("");
    setEstimatedValue(defaultEstimatedValue != null ? String(defaultEstimatedValue) : "");
    setSource("Facebook Marketplace");
    setListingUrl("");
    setNotes("");
    setSaving(false);
  }, [isOpen, defaultName, defaultEstimatedValue]);

  const ask = parseFloat(askingPrice) || 0;
  const value = parseFloat(estimatedValue) || 0;
  const profit = value - ask;
  const margin = ask > 0 ? (profit / ask) * 100 : 0;
  const verdict =
    margin > 30 ? { label: "Great flip", classes: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800" } :
    margin >= 15 ? { label: "Good buy", classes: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800" } :
    margin >= 5 ? { label: "Tight margin", classes: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800" } :
    ask === 0 ? { label: "—", classes: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700" } :
    { label: "Skip", classes: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800" };

  const canSave = name.trim().length >= 2 && ask > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        category,
        asking_price: ask,
        estimated_value: value,
        source: source.trim() || null,
        listing_url: listingUrl.trim() || null,
        notes: notes.trim() || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 text-sm";

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Quick Flip" size="md">
      <div className="space-y-4 p-1">
        {/* Header callout */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
          <Zap size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Single-item flip</p>
            <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
              Buying one thing and reselling it. Type the name, look up the eBay median, then enter what you&apos;re paying.
            </p>
          </div>
        </div>

        {/* Item name */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Item name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="e.g. Logitech G Pro X Superlight, RTX 3070 FE, 32GB DDR4 3600"
            autoFocus
          />
          {name.trim().length >= 3 && (
            <div className="mt-2 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <PriceLookup
                query={name}
                onApply={(price) => setEstimatedValue(String(price))}
              />
            </div>
          )}
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as PCPartCategory)}
            className={inputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
            ))}
          </select>
        </div>

        {/* Pricing pair */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">You pay (asking) *</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                className={inputClass + " pl-7"}
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Resale value</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                className={inputClass + " pl-7"}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Verdict */}
        {ask > 0 && value > 0 && (
          <div className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${verdict.classes}`}>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold opacity-80">Potential profit</p>
              <p className="text-xl font-bold tabular-nums">
                {profit >= 0 ? "+" : "-"}${Math.abs(profit).toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block text-[10px] uppercase tracking-wider font-bold mb-0.5">{verdict.label}</span>
              <p className="text-xs tabular-nums">{margin.toFixed(0)}% margin</p>
            </div>
          </div>
        )}

        {/* Source / link */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Source</label>
            <select value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Listing URL (optional)</label>
            <input
              type="url"
              value={listingUrl}
              onChange={(e) => setListingUrl(e.target.value)}
              className={inputClass}
              placeholder="https://…"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputClass + " resize-none"}
            placeholder="Condition, missing accessories, color, anything worth remembering"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <X size={14} /> Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all flex items-center justify-center gap-1.5"
          >
            {saving ? <Sparkles size={14} className="animate-pulse" /> : <Zap size={14} />}
            {saving ? "Saving…" : "Track this flip"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
