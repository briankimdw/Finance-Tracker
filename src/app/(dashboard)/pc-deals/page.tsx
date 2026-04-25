"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Cpu, ExternalLink, Pencil, Trash2, CheckCircle2, XCircle,
  Sparkles, TrendingUp, Package, Zap,
} from "lucide-react";
import AddPCDealModal, { getCategoryMeta, type PCDealFormData } from "@/components/AddPCDealModal";
import PCDealDetailsSheet from "@/components/PCDealDetailsSheet";
import QuickFlipModal, { type QuickFlipData } from "@/components/QuickFlipModal";
import { usePCDeals } from "@/hooks/usePCDeals";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { PCDeal, PCDealStatus, PCDealVerdict, PCDealWithParts } from "@/lib/types";

function verdictPillClasses(v: PCDealVerdict): string {
  switch (v) {
    case "great": return "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300";
    case "good": return "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300";
    case "fair": return "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300";
    case "skip": return "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300";
  }
}

function verdictLabel(v: PCDealVerdict): string {
  switch (v) {
    case "great": return "Great deal";
    case "good": return "Good buy";
    case "fair": return "Fair";
    case "skip": return "Skip";
  }
}

const STATUS_GROUPS: { key: PCDealStatus; label: string }[] = [
  { key: "evaluating", label: "Evaluating" },
  { key: "purchased", label: "Purchased" },
  { key: "sold", label: "Sold" },
  { key: "rejected", label: "Rejected" },
];

export default function PCDealsPage() {
  const {
    deals,
    loading,
    createDeal,
    updateDeal,
    deleteDeal,
    addPart,
    updatePart,
    deletePart,
    markPurchased,
    markSold,
    markRejected,
    resetToEvaluating,
  } = usePCDeals();
  const { success, error: toastError } = useToast();
  const confirm = useConfirm();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editDeal, setEditDeal] = useState<PCDealWithParts | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showQuickFlip, setShowQuickFlip] = useState(false);

  // Live-bound selected deal so the details sheet reflects hook state.
  const selectedDeal = useMemo(
    () => deals.find((d) => d.id === selectedId) ?? null,
    [deals, selectedId]
  );

  // Stats
  const activeCount = deals.filter((d) => d.status === "evaluating").length;
  const purchasedCount = deals.filter((d) => d.status === "purchased" || d.status === "sold").length;
  const thisYear = new Date().getFullYear();
  const profitThisYear = deals
    .filter((d) => {
      if (d.status !== "sold" || d.actualProfit == null || !d.sold_date) return false;
      return d.sold_date.startsWith(String(thisYear));
    })
    .reduce((s, d) => s + (d.actualProfit ?? 0), 0);

  const grouped = useMemo(() => {
    const map: Record<PCDealStatus, PCDealWithParts[]> = {
      evaluating: [],
      purchased: [],
      sold: [],
      rejected: [],
    };
    for (const d of deals) map[d.status].push(d);
    return map;
  }, [deals]);

  const handleSave = async (data: PCDealFormData) => {
    try {
      if (editDeal) {
        await updateDeal(editDeal.id, {
          name: data.name,
          source: data.source,
          listing_url: data.listing_url,
          asking_price: data.asking_price,
          seller_notes: data.seller_notes,
          condition: data.condition,
        });
        // Apply part diffs
        for (const removed of data.removedPartIds) {
          await deletePart(removed);
        }
        for (const p of data.parts) {
          const value = parseFloat(p.estimated_value) || 0;
          if (p.id) {
            await updatePart(p.id, {
              category: p.category,
              name: p.name,
              estimated_value: value,
            });
          } else if (p.name.trim()) {
            await addPart(editDeal.id, {
              category: p.category,
              name: p.name.trim(),
              estimated_value: value,
            });
          }
        }
        success("Deal updated");
        setEditDeal(null);
      } else {
        const created = await createDeal({
          name: data.name,
          source: data.source,
          listing_url: data.listing_url,
          asking_price: data.asking_price,
          seller_notes: data.seller_notes,
          condition: data.condition,
        });
        if (created) {
          for (const p of data.parts) {
            if (!p.name.trim()) continue;
            await addPart(created.id, {
              category: p.category,
              name: p.name.trim(),
              estimated_value: parseFloat(p.estimated_value) || 0,
            });
          }
        }
        success("Deal created");
      }
      setShowAddModal(false);
    } catch {
      toastError(editDeal ? "Couldn't update deal" : "Couldn't create deal");
    }
  };

  const handleDeleteDeal = async (deal: PCDeal) => {
    const ok = await confirm({
      title: `Delete "${deal.name}"?`,
      message: "All parts for this deal will be removed too.",
      destructive: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await deleteDeal(deal.id);
      success("Deal deleted");
    } catch {
      toastError("Couldn't delete deal");
    }
  };

  const handleQuickFlipSave = async (data: QuickFlipData) => {
    try {
      const created = await createDeal({
        name: data.name,
        source: data.source,
        listing_url: data.listing_url,
        asking_price: data.asking_price,
        seller_notes: null,
        condition: "used",
        notes: data.notes,
      });
      if (created) {
        await addPart(created.id, {
          category: data.category,
          name: data.name,
          estimated_value: data.estimated_value,
        });
      }
      success(`Tracking "${data.name}"`);
    } catch {
      toastError("Couldn't save flip");
    }
  };

  const handleMarkPurchasedQuick = async (deal: PCDealWithParts) => {
    try {
      await markPurchased(deal.id, {
        purchasedPrice: Number(deal.asking_price),
        purchasedDate: new Date().toISOString().slice(0, 10),
      });
      success(`Marked "${deal.name}" as purchased`);
    } catch {
      toastError("Couldn't update deal");
    }
  };

  const handleMarkRejectedQuick = async (deal: PCDealWithParts) => {
    try {
      await markRejected(deal.id);
      success(`Rejected "${deal.name}"`);
    } catch {
      toastError("Couldn't update deal");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">PC Deals</h1>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5 break-words">
            {activeCount} active &middot; {purchasedCount} purchased &middot; ${profitThisYear.toFixed(2)} profit this year
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setShowQuickFlip(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all hover:shadow-lg hover:shadow-amber-500/20"
            title="Single-item flip — keyboard, mouse, GPU, etc."
          >
            <Zap size={15} /> <span>Quick Flip</span>
          </button>
          <button
            onClick={() => { setEditDeal(null); setShowAddModal(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-blue-600/20"
          >
            <Plus size={16} /> <span>New Deal</span>
          </button>
        </div>
      </div>


      {/* Summary tiles */}
      {deals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatTile
            icon={<Cpu size={14} />}
            label="Active evaluations"
            value={String(activeCount)}
            accent="text-blue-600 dark:text-blue-400"
          />
          <StatTile
            icon={<Package size={14} />}
            label="Deals purchased"
            value={String(purchasedCount)}
            accent="text-purple-600 dark:text-purple-400"
          />
          <StatTile
            icon={<TrendingUp size={14} />}
            label={`Profit realized in ${thisYear}`}
            value={`$${profitThisYear.toFixed(2)}`}
            accent={profitThisYear >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
          />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard className="hidden md:block" />
          <SkeletonCard className="hidden md:block" />
        </div>
      ) : deals.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No PC deals yet"
          description="Evaluate full PC builds (multi-part) or use Quick Flip for single items like a keyboard or GPU. eBay sold-prices are pulled in automatically."
          action={{ label: "Quick Flip a single item", onClick: () => setShowQuickFlip(true) }}
        />
      ) : (
        <div className="space-y-8">
          {STATUS_GROUPS.map(({ key, label }) => {
            const list = grouped[key];
            if (list.length === 0) return null;
            return (
              <section key={key} className="space-y-3">
                <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  {label} <span className="text-gray-300 dark:text-gray-600">&middot; {list.length}</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {list.map((d, i) => (
                    <DealCard
                      key={d.id}
                      deal={d}
                      index={i}
                      onOpen={() => setSelectedId(d.id)}
                      onEdit={() => { setEditDeal(d); setShowAddModal(true); }}
                      onDelete={() => handleDeleteDeal(d)}
                      onMarkPurchased={() => handleMarkPurchasedQuick(d)}
                      onMarkRejected={() => handleMarkRejectedQuick(d)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <AddPCDealModal
        isOpen={showAddModal}
        deal={editDeal}
        existingParts={editDeal?.parts}
        onClose={() => { setShowAddModal(false); setEditDeal(null); }}
        onSave={handleSave}
      />

      <QuickFlipModal
        isOpen={showQuickFlip}
        onClose={() => setShowQuickFlip(false)}
        onSave={handleQuickFlipSave}
      />

      <PCDealDetailsSheet
        isOpen={selectedDeal !== null}
        deal={selectedDeal}
        onClose={() => setSelectedId(null)}
        onEdit={(d) => {
          setSelectedId(null);
          setEditDeal(d);
          setShowAddModal(true);
        }}
        onDelete={async (id) => {
          await deleteDeal(id);
        }}
        onAddPart={addPart}
        onUpdatePart={updatePart}
        onDeletePart={deletePart}
        onMarkPurchased={markPurchased}
        onMarkSold={markSold}
        onMarkRejected={markRejected}
        onResetToEvaluating={resetToEvaluating}
      />
    </div>
  );
}

function StatTile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-1.5 mb-1 text-gray-400 dark:text-gray-500">
        <span className={accent}>{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-xl font-bold tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

interface DealCardProps {
  deal: PCDealWithParts;
  index: number;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMarkPurchased: () => void;
  onMarkRejected: () => void;
}

function DealCard({ deal, index, onOpen, onEdit, onDelete, onMarkPurchased, onMarkRejected }: DealCardProps) {
  const askingPrice = Number(deal.asking_price);
  const partsValue = deal.totalPartsValue;
  // Two-bar visual: ask vs parts worth. Normalize to the larger of the two.
  const maxValue = Math.max(askingPrice, partsValue, 1);
  const askPct = (askingPrice / maxValue) * 100;
  const partsPct = (partsValue / maxValue) * 100;
  const profitPositive = deal.potentialProfit >= 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };

  const firstThreeCategories = deal.parts.slice(0, 3).map((p) => getCategoryMeta(p.category));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 260, delay: index * 0.04 }}
      className="group relative"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={handleKeyDown}
        className="block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md rounded-2xl p-4 transition-all cursor-pointer hover:bg-gray-50/60 dark:hover:bg-gray-800/40"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Cpu size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {deal.name}
                  </h3>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${verdictPillClasses(deal.verdict)}`}>
                    {verdictLabel(deal.verdict)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {deal.source && <span className="truncate">{deal.source}</span>}
                  {deal.listing_url && (
                    <a
                      href={deal.listing_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 shrink-0"
                      title="Open listing"
                    >
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Big profit number */}
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <div>
                {profitPositive ? (
                  <p className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">
                    +${deal.potentialProfit.toFixed(2)} <span className="text-xs font-medium text-gray-500 dark:text-gray-400">potential</span>
                  </p>
                ) : (
                  <p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
                    -${Math.abs(deal.potentialProfit).toFixed(2)} <span className="text-xs font-medium text-gray-500 dark:text-gray-400">loss</span>
                  </p>
                )}
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                  {deal.profitMargin.toFixed(0)}% margin
                </p>
              </div>

              {/* Actual profit chip when sold */}
              {deal.status === "sold" && deal.actualProfit != null && (
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold tabular-nums ${
                  deal.actualProfit >= 0
                    ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                    : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                }`}>
                  {deal.actualProfit >= 0 ? "+" : "-"}${Math.abs(deal.actualProfit).toFixed(2)} actual
                </span>
              )}
            </div>

            {/* Progress-bar compare */}
            <div className="mt-3 space-y-1.5">
              <div>
                <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                  <span>Asking price</span>
                  <span className="tabular-nums">${askingPrice.toFixed(2)}</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-400 dark:bg-gray-600 rounded-full transition-all"
                    style={{ width: `${askPct}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                  <span>Parts estimated value</span>
                  <span className="tabular-nums">${partsValue.toFixed(2)}</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${profitPositive ? "bg-green-500" : "bg-red-500"}`}
                    style={{ width: `${partsPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Parts count + category preview */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                <Package size={11} />
                <span>{deal.parts.length} {deal.parts.length === 1 ? "part" : "parts"}</span>
                {firstThreeCategories.length > 0 && (
                  <span className="flex items-center gap-0.5 ml-1">
                    {firstThreeCategories.map((m, i) => (
                      <span key={i} aria-hidden className="text-sm leading-none">{m.emoji}</span>
                    ))}
                    {deal.parts.length > 3 && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-0.5">+{deal.parts.length - 3}</span>
                    )}
                  </span>
                )}
              </div>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-500">
                Tap for details
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Hover-reveal actions */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none group-hover:pointer-events-auto">
        {deal.status === "evaluating" && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMarkPurchased(); }}
              className="text-white bg-purple-600/90 hover:bg-purple-700 p-1.5 rounded backdrop-blur-sm"
              title="Mark purchased"
            >
              <CheckCircle2 size={12} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMarkRejected(); }}
              className="text-white bg-gray-600/90 hover:bg-gray-700 p-1.5 rounded backdrop-blur-sm"
              title="Reject"
            >
              <XCircle size={12} />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="text-white bg-black/40 hover:bg-black/60 p-1.5 rounded backdrop-blur-sm"
          title="Edit"
        >
          <Pencil size={12} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-white bg-black/40 hover:bg-red-600/80 p-1.5 rounded backdrop-blur-sm"
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </motion.div>
  );
}
