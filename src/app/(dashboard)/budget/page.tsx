"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, PieChart, AlertCircle, CheckCircle, TrendingUp } from "lucide-react";
import AddBudgetModal from "@/components/AddBudgetModal";
import BudgetCategoryDetailsSheet from "@/components/BudgetCategoryDetailsSheet";
import { useBudgets } from "@/hooks/useBudgets";
import AnimatedNumber from "@/components/animated/AnimatedNumber";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import type { Budget } from "@/lib/types";

export default function BudgetPage() {
  const { budgets, loading, createBudget, updateBudget, deleteBudget, totalBudget, totalSpent } = useBudgets();
  const [showModal, setShowModal] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const [detailsBudgetId, setDetailsBudgetId] = useState<string | null>(null);
  const confirm = useConfirm();

  const handleSave = async (data: { category: string; monthly_amount: number; color?: string }) => {
    if (editBudget) {
      await updateBudget(editBudget.id, data);
      setEditBudget(null);
    } else {
      await createBudget(data);
    }
  };

  const handleQuickDelete = async (b: Budget) => {
    const ok = await confirm({
      title: `Delete ${b.category} budget?`,
      message: "This only removes the budget target — expenses won't be affected.",
      destructive: true,
      confirmLabel: "Delete",
    });
    if (ok) await deleteBudget(b.id);
  };

  const openDetails = (id: string) => setDetailsBudgetId(id);
  const openEditFromDetails = (id: string) => {
    const b = budgets.find((x) => x.id === id);
    if (!b) return;
    setDetailsBudgetId(null);
    setEditBudget(b);
    setShowModal(true);
  };

  const overallPct = totalBudget > 0 ? Math.min(200, (totalSpent / totalBudget) * 100) : 0;
  const remaining = Math.max(0, totalBudget - totalSpent);
  const monthName = new Date().toLocaleDateString("en-US", { month: "long" });

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Budget</h1>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5 break-words">Track spending against monthly limits</p>
        </div>
        <button onClick={() => { setEditBudget(null); setShowModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-blue-600/20 shrink-0 self-start sm:self-auto">
          <Plus size={16} /> <span>New Budget</span>
        </button>
      </motion.div>

      {/* Overall summary */}
      {budgets.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PieChart size={16} className="text-gray-400 dark:text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">{monthName} Overall</h2>
            </div>
            <span className={`text-sm font-bold ${totalSpent > totalBudget ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>
              {overallPct.toFixed(0)}%
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <AnimatedNumber value={totalSpent} prefix="$" className={`text-3xl font-bold ${totalSpent > totalBudget ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`} />
            <span className="text-sm text-gray-400 dark:text-gray-500 tabular-nums">of ${totalBudget.toFixed(2)}</span>
          </div>
          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${totalSpent > totalBudget ? "bg-gradient-to-r from-red-500 to-red-400" : "bg-gradient-to-r from-blue-500 to-purple-500"}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, overallPct)}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs">
            <span className="text-gray-500 dark:text-gray-400">${totalSpent.toFixed(2)} spent</span>
            <span className={totalSpent > totalBudget ? "text-red-600 dark:text-red-400 font-medium" : "text-gray-500 dark:text-gray-400"}>
              {totalSpent > totalBudget ? `$${(totalSpent - totalBudget).toFixed(2)} over` : `$${remaining.toFixed(2)} left`}
            </span>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-12 text-center text-gray-400 dark:text-gray-500 shadow-sm">Loading...</div>
      ) : budgets.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm"
        >
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mb-3">
              <PieChart size={22} className="text-blue-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No budgets set</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs text-center">Create category budgets to track your monthly spending against your goals</p>
            <button onClick={() => setShowModal(true)} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1">
              <Plus size={14} /> Create your first budget
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {budgets.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4, delay: 0.05 + i * 0.04 }}
                layout
                onClick={() => openDetails(b.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDetails(b.id);
                  }
                }}
                className="group cursor-pointer bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${b.color}15`, color: b.color }}>
                    {b.overBudget ? <AlertCircle size={20} /> : b.progress > 80 ? <TrendingUp size={20} /> : <CheckCircle size={20} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{b.category}</h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 tabular-nums">
                          <AnimatedNumber value={b.spent} prefix="$" className="font-medium text-gray-700 dark:text-gray-300" />
                          <span> of ${Number(b.monthly_amount).toFixed(2)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditBudget(b); setShowModal(true); }}
                          className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 p-1.5 rounded"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleQuickDelete(b); }}
                          className="text-gray-300 dark:text-gray-600 hover:text-red-500 p-1.5 rounded"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 relative h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: b.overBudget ? "#ef4444" : b.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, b.progress)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.05 }}
                      />
                      {b.overBudget && (
                        <motion.div
                          className="absolute inset-0 bg-red-500/20 rounded-full"
                          animate={{ opacity: [0.2, 0.5, 0.2] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="font-medium tabular-nums" style={{ color: b.overBudget ? "#dc2626" : b.color }}>
                        {b.progress.toFixed(0)}%
                      </span>
                      <span className={`tabular-nums ${b.overBudget ? "text-red-600 dark:text-red-400 font-medium" : "text-gray-500 dark:text-gray-400"}`}>
                        {b.overBudget ? `$${Math.abs(b.remaining).toFixed(2)} over budget` : `$${b.remaining.toFixed(2)} left`}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AddBudgetModal
        isOpen={showModal}
        budget={editBudget}
        existingCategories={budgets.map((b) => b.category)}
        onClose={() => { setShowModal(false); setEditBudget(null); }}
        onSave={handleSave}
      />

      <BudgetCategoryDetailsSheet
        isOpen={!!detailsBudgetId}
        budgetId={detailsBudgetId}
        onClose={() => setDetailsBudgetId(null)}
        onEdit={openEditFromDetails}
        onDelete={deleteBudget}
      />
    </div>
  );
}
