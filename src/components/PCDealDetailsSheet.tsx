"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ExternalLink, Pencil, Trash2, Search, Plus, Check, X, DollarSign, Calendar,
  CheckCircle2, XCircle, RotateCcw, TrendingUp, TrendingDown, Cpu, Zap,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { todayEST, formatESTDate } from "@/lib/dates";
import { PART_CATEGORIES, getCategoryMeta, verdictFromMargin } from "@/components/AddPCDealModal";
import type { PCDealPart, PCDealWithParts, PCPartCategory } from "@/lib/types";

interface PCDealDetailsSheetProps {
  isOpen: boolean;
  deal: PCDealWithParts | null;
  onClose: () => void;
  onEdit: (deal: PCDealWithParts) => void;
  onDelete: (id: string) => Promise<void>;
  onAddPart: (
    dealId: string,
    data: { category: PCPartCategory; name: string; estimated_value: number }
  ) => Promise<PCDealPart | null>;
  onUpdatePart: (id: string, data: Partial<PCDealPart>) => Promise<void>;
  onDeletePart: (id: string) => Promise<void>;
  onMarkPurchased: (id: string, args: { purchasedPrice: number; purchasedDate: string }) => Promise<void>;
  onMarkSold: (id: string, args: { soldFor: number; soldDate: string; sellingFees?: number }) => Promise<void>;
  onMarkRejected: (id: string) => Promise<void>;
  onResetToEvaluating: (id: string) => Promise<void>;
}

function buildEbaySoldUrl(name: string): string {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(name)}&LH_Sold=1&LH_Complete=1`;
}

function verdictHeroClasses(key: "great" | "good" | "fair" | "skip"): string {
  switch (key) {
    case "great":
      return "bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/50 dark:to-green-900/30";
    case "good":
      return "bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30";
    case "fair":
      return "bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/50 dark:to-amber-900/30";
    case "skip":
      return "bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/50 dark:to-red-900/30";
  }
}

function verdictHeroText(key: "great" | "good" | "fair" | "skip"): string {
  switch (key) {
    case "great": return "text-green-700 dark:text-green-300";
    case "good": return "text-blue-700 dark:text-blue-300";
    case "fair": return "text-amber-700 dark:text-amber-300";
    case "skip": return "text-red-700 dark:text-red-300";
  }
}

function verdictHeroHeadline(key: "great" | "good" | "fair" | "skip"): string {
  switch (key) {
    case "great": return "This is a great deal!";
    case "good": return "Good buy";
    case "fair": return "Fair margin";
    case "skip": return "Skip this one";
  }
}

export default function PCDealDetailsSheet({
  isOpen,
  deal,
  onClose,
  onEdit,
  onDelete,
  onAddPart,
  onUpdatePart,
  onDeletePart,
  onMarkPurchased,
  onMarkSold,
  onMarkRejected,
  onResetToEvaluating,
}: PCDealDetailsSheetProps) {
  const confirm = useConfirm();
  const toast = useToast();

  // Inline editing state — full edit (name + category + value)
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<{ name: string; category: PCPartCategory; value: string }>({
    name: "",
    category: "gpu",
    value: "",
  });

  // Per-part eBay lookup state
  type LookupSample = { title: string; price: number; url: string | null; condition: string | null };
  const [lookups, setLookups] = useState<Record<string, { status: "idle" | "loading" | "ok" | "error"; median?: number; sampleCount?: number; low?: number; high?: number; samples?: LookupSample[]; error?: string }>>({});

  const lookupPrice = async (partId: string, name: string, applyToValue: boolean) => {
    const q = name.trim();
    if (q.length < 3) return;
    setLookups((prev) => ({ ...prev, [partId]: { status: "loading" } }));
    try {
      const res = await fetch("/api/pc-parts/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        const reason = data?.error || `eBay lookup failed (${res.status})`;
        setLookups((prev) => ({ ...prev, [partId]: { status: "error", error: reason } }));
        toast.error(reason);
        return;
      }
      if (data.median === null || data.sampleCount === 0) {
        setLookups((prev) => ({ ...prev, [partId]: { status: "error", error: data.error || "No sold listings found" } }));
        return;
      }
      setLookups((prev) => ({
        ...prev,
        [partId]: {
          status: "ok",
          median: Number(data.median),
          sampleCount: Number(data.sampleCount),
          low: Number(data.low),
          high: Number(data.high),
          samples: Array.isArray(data.samples) ? data.samples : [],
        },
      }));
      if (applyToValue) {
        await onUpdatePart(partId, { estimated_value: Number(data.median) });
        toast.success(`${q}: $${Number(data.median).toFixed(2)} (eBay median, ${data.sampleCount} sold)`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setLookups((prev) => ({ ...prev, [partId]: { status: "error", error: msg } }));
      toast.error(`Lookup failed: ${msg}`);
    }
  };

  // Add-part inline draft
  const [adding, setAdding] = useState(false);
  const [newPart, setNewPart] = useState<{ category: PCPartCategory; name: string; estimated_value: string }>({
    category: "gpu",
    name: "",
    estimated_value: "",
  });

  // Inline status prompt (mark purchased / mark sold)
  const [prompt, setPrompt] = useState<"purchased" | "sold" | null>(null);
  const [promptForm, setPromptForm] = useState({
    purchasedPrice: "",
    purchasedDate: todayEST(),
    soldFor: "",
    soldDate: todayEST(),
    sellingFees: "",
  });

  useEffect(() => {
    if (!isOpen) {
      setEditingPartId(null);
      setEditingDraft({ name: "", category: "gpu", value: "" });
      setAdding(false);
      setNewPart({ category: "gpu", name: "", estimated_value: "" });
      setPrompt(null);
      setPromptForm({
        purchasedPrice: "",
        purchasedDate: todayEST(),
        soldFor: "",
        soldDate: todayEST(),
        sellingFees: "",
      });
    }
  }, [isOpen]);

  // Preload prompt fields from the deal whenever the opened deal changes.
  // Intentionally depends on identity (id) + status — not the full deal object —
  // to avoid re-seeding on unrelated realtime refreshes that might stomp
  // on the user's in-progress edits.
  const dealId = deal?.id ?? null;
  const dealStatus = deal?.status ?? null;
  const dealAskingPrice = deal?.asking_price ?? null;
  const dealPurchasedPrice = deal?.purchased_price ?? null;
  const dealPurchasedDate = deal?.purchased_date ?? null;
  const dealSoldFor = deal?.sold_for ?? null;
  const dealSoldDate = deal?.sold_date ?? null;
  const dealSellingFees = deal?.selling_fees ?? 0;
  useEffect(() => {
    if (!dealId) return;
    setPromptForm((prev) => ({
      purchasedPrice: dealPurchasedPrice != null ? String(dealPurchasedPrice) : String(dealAskingPrice ?? ""),
      purchasedDate: dealPurchasedDate ?? prev.purchasedDate,
      soldFor: dealSoldFor != null ? String(dealSoldFor) : "",
      soldDate: dealSoldDate ?? prev.soldDate,
      sellingFees: dealSellingFees ? String(dealSellingFees) : "",
    }));
    // Only re-seed when the deal identity/status shifts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId, dealStatus]);

  if (!deal) return null;

  const verdict = verdictFromMargin(deal.profitMargin);
  const askingPrice = Number(deal.asking_price);

  const handleStartEditPart = (p: PCDealPart) => {
    setEditingPartId(p.id);
    setEditingDraft({ name: p.name, category: p.category, value: String(p.estimated_value) });
  };

  const handleSavePartEdit = async (p: PCDealPart) => {
    const value = parseFloat(editingDraft.value);
    if (!Number.isFinite(value) || value < 0) {
      setEditingPartId(null);
      return;
    }
    const name = editingDraft.name.trim();
    if (!name) {
      setEditingPartId(null);
      return;
    }
    try {
      await onUpdatePart(p.id, { estimated_value: value, name, category: editingDraft.category });
      toast.success("Part updated");
    } catch {
      toast.error("Couldn't update part");
    }
    setEditingPartId(null);
  };

  const handleDeletePart = async (p: PCDealPart) => {
    const ok = await confirm({
      title: `Remove "${p.name}"?`,
      destructive: true,
      confirmLabel: "Remove",
    });
    if (!ok) return;
    try {
      await onDeletePart(p.id);
      toast.success("Part removed");
    } catch {
      toast.error("Couldn't remove part");
    }
  };

  const handleAddPartSubmit = async () => {
    if (!newPart.name.trim()) return;
    const val = parseFloat(newPart.estimated_value) || 0;
    try {
      await onAddPart(deal.id, { category: newPart.category, name: newPart.name.trim(), estimated_value: val });
      toast.success("Part added");
      setNewPart({ category: newPart.category, name: "", estimated_value: "" });
      setAdding(false);
    } catch {
      toast.error("Couldn't add part");
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete "${deal.name}"?`,
      message: "All parts for this deal will be removed too.",
      destructive: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await onDelete(deal.id);
      toast.success("Deal deleted");
      onClose();
    } catch {
      toast.error("Couldn't delete deal");
    }
  };

  const handleMarkPurchased = async () => {
    const price = parseFloat(promptForm.purchasedPrice);
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Enter a valid purchase price");
      return;
    }
    try {
      await onMarkPurchased(deal.id, {
        purchasedPrice: price,
        purchasedDate: promptForm.purchasedDate || todayEST(),
      });
      toast.success("Marked as purchased");
      setPrompt(null);
    } catch {
      toast.error("Couldn't update deal");
    }
  };

  const handleMarkSold = async () => {
    const soldFor = parseFloat(promptForm.soldFor);
    if (!Number.isFinite(soldFor) || soldFor < 0) {
      toast.error("Enter a valid sold-for amount");
      return;
    }
    try {
      await onMarkSold(deal.id, {
        soldFor,
        soldDate: promptForm.soldDate || todayEST(),
        sellingFees: parseFloat(promptForm.sellingFees) || 0,
      });
      toast.success("Marked as sold");
      setPrompt(null);
    } catch {
      toast.error("Couldn't update deal");
    }
  };

  const handleMarkRejected = async () => {
    try {
      await onMarkRejected(deal.id);
      toast.info("Deal rejected");
    } catch {
      toast.error("Couldn't update deal");
    }
  };

  const handleReset = async () => {
    try {
      await onResetToEvaluating(deal.id);
      toast.info("Reset to evaluating");
    } catch {
      toast.error("Couldn't update deal");
    }
  };

  const statusChipClass =
    deal.status === "evaluating" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" :
    deal.status === "purchased" ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300" :
    deal.status === "sold" ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" :
    "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400";

  const inputClass =
    "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 text-sm";

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} size="lg" title={deal.name}>
      <div className="space-y-5">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 260 }}
          className="flex items-start gap-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Cpu size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{deal.name}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
              {deal.source && <span>{deal.source}</span>}
              {deal.listing_url && (
                <a
                  href={deal.listing_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  View listing <ExternalLink size={10} />
                </a>
              )}
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusChipClass}`}>
                {deal.status}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Verdict hero */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 260, delay: 0.04 }}
          className={`rounded-2xl px-5 py-5 ${verdictHeroClasses(verdict.key)}`}
        >
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${verdictHeroText(verdict.key)}`}>
            Verdict
          </p>
          <p className={`text-2xl font-bold mt-0.5 ${verdictHeroText(verdict.key)}`}>
            {verdictHeroHeadline(verdict.key)}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Asking</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">${askingPrice.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Parts total</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">${deal.totalPartsValue.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Profit</p>
              <p className={`text-sm font-bold tabular-nums ${deal.potentialProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {deal.potentialProfit >= 0 ? "+" : "-"}${Math.abs(deal.potentialProfit).toFixed(2)}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">{deal.profitMargin.toFixed(0)}% margin</p>
            </div>
          </div>
        </motion.div>

        {/* Actual profit (when sold) */}
        {deal.status === "sold" && deal.actualProfit != null && (
          <div className={`rounded-2xl border p-4 ${
            deal.actualProfit >= 0
              ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Actual profit</p>
                <p className="text-2xl font-bold tabular-nums mt-0.5">
                  {deal.actualProfit >= 0 ? "+" : "-"}${Math.abs(deal.actualProfit).toFixed(2)}
                </p>
                <p className="text-[11px] mt-1 opacity-90 tabular-nums">
                  Sold for ${Number(deal.sold_for ?? 0).toFixed(2)} &middot; Paid ${Number(deal.purchased_price ?? 0).toFixed(2)}
                  {Number(deal.selling_fees) > 0 && <> &middot; ${Number(deal.selling_fees).toFixed(2)} fees</>}
                </p>
              </div>
              {deal.actualProfit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </div>
          </div>
        )}

        {/* Parts list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Parts ({deal.parts.length})
            </h3>
            {!adding && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                <Plus size={12} /> Add part
              </button>
            )}
          </div>

          {deal.parts.length === 0 && !adding ? (
            <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 px-4 py-5 text-center text-xs text-gray-500 dark:text-gray-400">
              No parts yet. Add each component to calculate the deal&rsquo;s potential.
            </div>
          ) : (
            <div className="space-y-1.5">
              {deal.parts.map((p) => {
                const meta = getCategoryMeta(p.category);
                const isEditing = editingPartId === p.id;
                if (isEditing) {
                  return (
                    <div key={p.id} className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/30 p-3 space-y-2">
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-4">
                          <select
                            value={editingDraft.category}
                            onChange={(e) => setEditingDraft((d) => ({ ...d, category: e.target.value as PCPartCategory }))}
                            className={inputClass + " !px-2 !py-2 text-xs"}
                            aria-label="Category"
                          >
                            {PART_CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-8">
                          <input
                            type="text"
                            autoFocus
                            value={editingDraft.name}
                            onChange={(e) => setEditingDraft((d) => ({ ...d, name: e.target.value }))}
                            className={inputClass + " !py-2 text-xs"}
                            placeholder="Part name"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); void handleSavePartEdit(p); }
                              else if (e.key === "Escape") setEditingPartId(null);
                            }}
                          />
                        </div>
                        <div className="col-span-7">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-xs">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editingDraft.value}
                              onChange={(e) => setEditingDraft((d) => ({ ...d, value: e.target.value }))}
                              className={inputClass + " !pl-6 !py-2 text-xs"}
                              placeholder="Estimated value"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); void handleSavePartEdit(p); }
                                else if (e.key === "Escape") setEditingPartId(null);
                              }}
                            />
                          </div>
                        </div>
                        <div className="col-span-5 flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => { lookupPrice(p.id, editingDraft.name, false); }}
                            disabled={!editingDraft.name.trim() || lookups[p.id]?.status === "loading"}
                            title="Auto-fill from eBay"
                            className="px-2 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-xs flex items-center gap-1"
                          >
                            {lookups[p.id]?.status === "loading" ? (
                              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/><path fill="currentColor" d="M4 12a8 8 0 018-8V2.5a9.5 9.5 0 00-9.5 9.5H4z"/></svg>
                            ) : (
                              <Zap size={12} />
                            )}
                            <span className="hidden sm:inline">Lookup</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPartId(null)}
                            className="px-2 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-900"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSavePartEdit(p)}
                            className="px-2 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs flex items-center gap-1"
                            aria-label="Save"
                          >
                            <Check size={12} /> Save
                          </button>
                        </div>
                      </div>
                      {/* Lookup result + recent sales while editing */}
                      {lookups[p.id]?.status === "ok" && (
                        <div className="rounded-lg bg-white/70 dark:bg-gray-900/70 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
                          <div className="flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                            <Zap size={11} />
                            <span>eBay median ${lookups[p.id].median?.toFixed(2)} · {lookups[p.id].sampleCount} sold · ${lookups[p.id].low?.toFixed(0)}–${lookups[p.id].high?.toFixed(0)}</span>
                            <button
                              type="button"
                              onClick={() => setEditingDraft((d) => ({ ...d, value: String(lookups[p.id].median) }))}
                              className="ml-auto text-emerald-700 dark:text-emerald-300 hover:underline"
                            >
                              Use median
                            </button>
                          </div>
                          {lookups[p.id].samples && lookups[p.id].samples!.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">Recent sales</p>
                              {lookups[p.id].samples!.slice(0, 5).map((s, i) => (
                                <div key={i} className="flex items-center gap-2 text-[11px]">
                                  <span className="font-bold text-gray-900 dark:text-gray-100 tabular-nums w-14">${s.price.toFixed(2)}</span>
                                  <a href={s.url || "#"} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                                    {s.title}
                                  </a>
                                  {s.condition && <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">{s.condition}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <div
                    key={p.id}
                    className="group flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => handleStartEditPart(p)}
                      className="w-8 h-8 rounded-lg bg-white dark:bg-gray-900 flex items-center justify-center text-base shrink-0 hover:ring-2 hover:ring-blue-400"
                      title="Edit part"
                      aria-label="Edit part category"
                    >
                      {meta.emoji}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartEditPart(p)}
                      className="flex-1 min-w-0 text-left"
                      title="Tap to edit"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.name || meta.label}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">{meta.label}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartEditPart(p)}
                      className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-gray-900 transition-colors"
                      title="Tap to edit"
                    >
                      ${Number(p.estimated_value).toFixed(2)}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); lookupPrice(p.id, p.name, true); }}
                      disabled={!p.name.trim() || lookups[p.id]?.status === "loading"}
                      className="text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 p-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-900 disabled:opacity-30 disabled:hover:text-gray-400"
                      title="Auto-fill from eBay sold listings"
                    >
                      {lookups[p.id]?.status === "loading" ? (
                        <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/><path fill="currentColor" d="M4 12a8 8 0 018-8V2.5a9.5 9.5 0 00-9.5 9.5H4z"/></svg>
                      ) : (
                        <Zap size={13} />
                      )}
                    </button>
                    <a
                      href={buildEbaySoldUrl(p.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 p-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-900"
                      title="Open eBay sold listings"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Search size={13} />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeletePart(p)}
                      className="text-gray-300 dark:text-gray-600 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove part"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {adding && (
            <div className="mt-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 space-y-2">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-4 sm:col-span-3">
                  <select
                    value={newPart.category}
                    onChange={(e) => setNewPart((p) => ({ ...p, category: e.target.value as PCPartCategory }))}
                    className={inputClass + " !px-2 text-xs"}
                  >
                    {PART_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-8 sm:col-span-6">
                  <input
                    type="text"
                    autoFocus
                    value={newPart.name}
                    onChange={(e) => setNewPart((p) => ({ ...p, name: e.target.value }))}
                    className={inputClass + " text-xs"}
                    placeholder="Part name"
                  />
                </div>
                <div className="col-span-12 sm:col-span-3">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-xs">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newPart.estimated_value}
                      onChange={(e) => setNewPart((p) => ({ ...p, estimated_value: e.target.value }))}
                      className={inputClass + " !pl-6 text-xs"}
                      placeholder="Value"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setAdding(false); setNewPart({ category: "gpu", name: "", estimated_value: "" }); }}
                  className="px-3 py-1.5 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddPartSubmit}
                  disabled={!newPart.name.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Inline status prompts */}
        {prompt === "purchased" && (
          <div className="rounded-2xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">Mark as purchased</p>
              <button type="button" onClick={() => setPrompt(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">
                  <DollarSign size={10} className="inline mr-0.5" /> Paid
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={promptForm.purchasedPrice}
                  onChange={(e) => setPromptForm((f) => ({ ...f, purchasedPrice: e.target.value }))}
                  className={inputClass}
                  placeholder={String(askingPrice)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">
                  <Calendar size={10} className="inline mr-0.5" /> Date
                </label>
                <input
                  type="date"
                  value={promptForm.purchasedDate}
                  onChange={(e) => setPromptForm((f) => ({ ...f, purchasedDate: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleMarkPurchased}
              className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm"
            >
              Confirm purchase
            </button>
          </div>
        )}

        {prompt === "sold" && (
          <div className="rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-green-700 dark:text-green-300">Mark as sold</p>
              <button type="button" onClick={() => setPrompt(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">
                  <DollarSign size={10} className="inline mr-0.5" /> Sold for
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={promptForm.soldFor}
                  onChange={(e) => setPromptForm((f) => ({ ...f, soldFor: e.target.value }))}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">
                  Fees
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={promptForm.sellingFees}
                  onChange={(e) => setPromptForm((f) => ({ ...f, sellingFees: e.target.value }))}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">
                <Calendar size={10} className="inline mr-0.5" /> Sold date
              </label>
              <input
                type="date"
                value={promptForm.soldDate}
                onChange={(e) => setPromptForm((f) => ({ ...f, soldDate: e.target.value }))}
                className={inputClass}
              />
            </div>
            <button
              type="button"
              onClick={handleMarkSold}
              className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm"
            >
              Confirm sale
            </button>
          </div>
        )}

        {/* Purchase/sale summary */}
        {deal.status !== "evaluating" && prompt === null && (deal.purchased_date || deal.sold_date) && (
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
            {deal.purchased_date && (
              <p>
                Purchased on {formatESTDate(deal.purchased_date, { month: "short", day: "numeric", year: "numeric" })}
                {deal.purchased_price != null && <> for <span className="font-semibold text-gray-900 dark:text-gray-100">${Number(deal.purchased_price).toFixed(2)}</span></>}
              </p>
            )}
            {deal.sold_date && (
              <p>
                Sold on {formatESTDate(deal.sold_date, { month: "short", day: "numeric", year: "numeric" })}
                {deal.sold_for != null && <> for <span className="font-semibold text-gray-900 dark:text-gray-100">${Number(deal.sold_for).toFixed(2)}</span></>}
              </p>
            )}
          </div>
        )}

        {/* Seller notes + internal notes */}
        {(deal.seller_notes || deal.notes) && (
          <div className="space-y-2">
            {deal.seller_notes && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Seller notes</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">{deal.seller_notes}</p>
              </div>
            )}
            {deal.notes && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">My notes</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">{deal.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Action row */}
        {prompt === null && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {deal.status === "evaluating" && (
              <>
                <button
                  type="button"
                  onClick={() => setPrompt("purchased")}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium"
                >
                  <CheckCircle2 size={14} /> Mark purchased
                </button>
                <button
                  type="button"
                  onClick={handleMarkRejected}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium"
                >
                  <XCircle size={14} /> Reject
                </button>
              </>
            )}
            {deal.status === "purchased" && (
              <>
                <button
                  type="button"
                  onClick={() => setPrompt("sold")}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium"
                >
                  <CheckCircle2 size={14} /> Mark sold
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium"
                >
                  <RotateCcw size={14} /> Reset
                </button>
              </>
            )}
            {deal.status === "rejected" && (
              <button
                type="button"
                onClick={handleReset}
                className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
              >
                <RotateCcw size={14} /> Reset to evaluating
              </button>
            )}
            {deal.status === "sold" && (
              <button
                type="button"
                onClick={handleReset}
                className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium"
              >
                <RotateCcw size={14} /> Reopen as evaluating
              </button>
            )}

            <button
              type="button"
              onClick={() => onEdit(deal)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium"
            >
              <Pencil size={14} /> Edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
