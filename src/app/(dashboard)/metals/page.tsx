"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2, History, Coins } from "lucide-react";
import AddHoldingModal from "@/components/AddHoldingModal";
import SellHoldingModal from "@/components/SellHoldingModal";
import EditHoldingModal from "@/components/EditHoldingModal";
import MetalPortfolioStats from "@/components/MetalPortfolioStats";
import MetalPriceHeader from "@/components/MetalPriceHeader";
import MetalBreakdown from "@/components/MetalBreakdown";
import { useHoldings, usePortfolioStats } from "@/hooks/useHoldings";
import { useMetalTransactions } from "@/hooks/useMetalTransactions";
import { useMetalPrices } from "@/hooks/useMetalPrices";
import { METALS } from "@/lib/metals";
import type { Holding } from "@/lib/types";

export default function MetalsPage() {
  const { holdings, loading, refetch, deleteHolding } = useHoldings("active");
  const { stats, refetch: refetchStats } = usePortfolioStats();
  const { prices } = useMetalPrices();
  const { createBuyTransaction, createSellTransaction } = useMetalTransactions();

  const [showAddModal, setShowAddModal] = useState(false);
  const [sellHolding, setSellHolding] = useState<Holding | null>(null);
  const [editHolding, setEditHolding] = useState<Holding | null>(null);

  const handleAdded = async (holdingId: string) => {
    await createBuyTransaction(holdingId);
    refetch();
    refetchStats();
  };

  const handleSold = async (holdingId: string, cashAmount: number) => {
    await createSellTransaction(holdingId, cashAmount);
    refetch();
    refetchStats();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Metals Portfolio</h1>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5 break-words">Track your precious metals holdings</p>
        </div>
        <div className="flex gap-2 shrink-0 self-start sm:self-auto">
          <Link href="/metals/history" className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 font-medium py-2 px-4 rounded-lg flex items-center gap-2">
            <History size={16} /><span>History</span>
          </Link>
          <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-blue-600/20">
            <Plus size={16} /><span>Add Holding</span>
          </button>
        </div>
      </div>

      <MetalPriceHeader />
      <MetalPortfolioStats stats={stats} />
      <MetalBreakdown stats={stats} />

      {/* Holdings table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Active Holdings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Metal</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Qty (oz)</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Cost/oz</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Value</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">P/L</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Loading...</td></tr>
              ) : holdings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                        <Coins size={20} className="text-gray-300 dark:text-gray-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-400 dark:text-gray-500">No holdings yet</p>
                      <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Add your first piece of metal to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                holdings.map((h) => {
                  const qty = Number(h.quantity);
                  const cost = qty * Number(h.cost_per_oz);
                  const value = qty * prices[h.metal];
                  const pnl = value - cost;
                  const meta = METALS[h.metal];
                  return (
                    <tr
                      key={h.id}
                      onClick={() => setEditHolding(h)}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 even:bg-gray-50/40 dark:even:bg-gray-800/20 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${meta.iconBg}`}>{meta.name}</span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400 capitalize">{h.type}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-900 dark:text-gray-100 font-medium">{h.description || "—"}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-700 dark:text-gray-300 tabular-nums">{qty.toFixed(4)}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400 tabular-nums">${Number(h.cost_per_oz).toFixed(2)}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-900 dark:text-gray-100 font-medium tabular-nums">${value.toFixed(2)}</td>
                      <td className="px-4 py-3.5 text-sm">
                        <span className={`font-semibold tabular-nums ${pnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditHolding(h); }}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-2.5 py-1 rounded-md transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSellHolding(h); }}
                            className="text-xs bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 hover:bg-green-100 border border-green-200 dark:border-green-800 px-2.5 py-1 rounded-md transition-colors"
                          >
                            Sell
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteHolding(h.id); }}
                            className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddHoldingModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onAdded={handleAdded} />
      <SellHoldingModal isOpen={!!sellHolding} holding={sellHolding} onClose={() => setSellHolding(null)} onSold={handleSold} />
      <EditHoldingModal isOpen={!!editHolding} holding={editHolding} onClose={() => setEditHolding(null)} onUpdated={() => { refetch(); refetchStats(); }} />
    </div>
  );
}
