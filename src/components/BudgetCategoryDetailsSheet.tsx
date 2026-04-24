"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, CreditCard, Banknote, ArrowDownRight, ArrowUpRight, Receipt, TrendingUp, TrendingDown } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useCreditCards } from "@/hooks/useCreditCards";
import EditExpenseModal from "@/components/EditExpenseModal";
import type { Budget, Expense } from "@/lib/types";

const CATEGORY_ICON: Record<string, string> = {
  "Rent / Mortgage": "\u{1F3E0}",
  Utilities: "\u{1F4A1}",
  Groceries: "\u{1F6D2}",
  "Dining Out": "\u{1F354}",
  Transportation: "\u{1F697}",
  Gas: "\u26FD",
  Insurance: "\u{1F6E1}",
  Subscriptions: "\u{1F4FA}",
  Entertainment: "\u{1F3AC}",
  Shopping: "\u{1F6CD}",
  Health: "\u{1FA7A}",
  Education: "\u{1F4DA}",
  "Phone / Internet": "\u{1F4F1}",
  "Personal Care": "\u{1F484}",
  Gifts: "\u{1F381}",
  Travel: "\u2708",
  "Debt Payment": "\u{1F4B3}",
  Savings: "\u{1F4B0}",
  Taxes: "\u{1F4DC}",
  Other: "\u{1F4B8}",
};

interface MonthRange {
  start: string;
  end: string;
}

function monthRange(date: Date): MonthRange {
  const start = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const end = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end };
}

interface BudgetCategoryDetailsSheetProps {
  isOpen: boolean;
  budgetId: string | null;
  onClose: () => void;
  onEdit: (budgetId: string) => void;
  onDelete: (id: string) => void;
}

export default function BudgetCategoryDetailsSheet({
  isOpen,
  budgetId,
  onClose,
  onEdit,
  onDelete,
}: BudgetCategoryDetailsSheetProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const confirm = useConfirm();
  const { success, error: toastError } = useToast();
  const { cards } = useCreditCards();

  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(false);
  const [thisMonthExpenses, setThisMonthExpenses] = useState<Expense[]>([]);
  const [lastMonthTotal, setLastMonthTotal] = useState(0);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);

  const now = useMemo(() => new Date(), []);
  const thisMonth = useMemo(() => monthRange(now), [now]);
  const lastMonth = useMemo(() => monthRange(new Date(now.getFullYear(), now.getMonth() - 1, 1)), [now]);
  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const fetchData = useCallback(async () => {
    if (!budgetId) return;
    setLoading(true);
    try {
      // Load the budget
      let budgetQ = supabase.from("budgets").select("*").eq("id", budgetId).maybeSingle();
      if (user) budgetQ = budgetQ.eq("user_id", user.id);
      else budgetQ = budgetQ.is("user_id", null);
      const { data: budgetRow } = await budgetQ;
      const b = (budgetRow as Budget | null) ?? null;
      setBudget(b);

      if (!b) {
        setThisMonthExpenses([]);
        setLastMonthTotal(0);
        setRecentExpenses([]);
        return;
      }

      // This month's expenses in this category
      let thisQ = supabase
        .from("expenses")
        .select("*")
        .eq("category", b.category)
        .eq("is_card_payment", false)
        .gte("date", thisMonth.start)
        .lt("date", thisMonth.end)
        .order("date", { ascending: false });
      if (user) thisQ = thisQ.eq("user_id", user.id);
      else thisQ = thisQ.is("user_id", null);
      const { data: thisData } = await thisQ;

      // Last month's totals for comparison
      let lastQ = supabase
        .from("expenses")
        .select("amount")
        .eq("category", b.category)
        .eq("is_card_payment", false)
        .gte("date", lastMonth.start)
        .lt("date", lastMonth.end);
      if (user) lastQ = lastQ.eq("user_id", user.id);
      else lastQ = lastQ.is("user_id", null);
      const { data: lastData } = await lastQ;

      // Recent 10 across all time (limited)
      let recentQ = supabase
        .from("expenses")
        .select("*")
        .eq("category", b.category)
        .eq("is_card_payment", false)
        .order("date", { ascending: false })
        .limit(10);
      if (user) recentQ = recentQ.eq("user_id", user.id);
      else recentQ = recentQ.is("user_id", null);
      const { data: recentData } = await recentQ;

      setThisMonthExpenses((thisData as Expense[]) || []);
      setLastMonthTotal(((lastData as { amount: number }[]) || []).reduce((s, e) => s + Number(e.amount), 0));
      setRecentExpenses((recentData as Expense[]) || []);
    } catch {
      setBudget(null);
      setThisMonthExpenses([]);
      setLastMonthTotal(0);
      setRecentExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [budgetId, supabase, user, thisMonth.start, thisMonth.end, lastMonth.start, lastMonth.end]);

  useEffect(() => {
    if (isOpen && budgetId) fetchData();
  }, [isOpen, budgetId, fetchData]);

  const spent = useMemo(
    () => thisMonthExpenses.reduce((s, e) => s + Number(e.amount), 0),
    [thisMonthExpenses]
  );
  const monthly = budget ? Number(budget.monthly_amount) : 0;
  const progress = monthly > 0 ? (spent / monthly) * 100 : 0;
  const overBudget = spent > monthly;
  const remaining = monthly - spent;

  const delta = spent - lastMonthTotal;
  const deltaBetter = delta <= 0; // spending less is better
  const thisMonthName = now.toLocaleDateString("en-US", { month: "long" });

  // Color based on progress: <70% green, 70-100% amber, >100% red
  const progressColor = overBudget
    ? "bg-red-500"
    : progress >= 70
    ? "bg-amber-500"
    : "bg-green-500";
  const progressTextColor = overBudget
    ? "text-red-600 dark:text-red-400"
    : progress >= 70
    ? "text-amber-600 dark:text-amber-400"
    : "text-green-600 dark:text-green-400";

  // Build a 30-day sparkline of daily spend
  const sparkline = useMemo(() => {
    const days: { label: string; total: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      days.push({ label: key, total: 0 });
    }
    // Use recentExpenses (capped at 10) PLUS thisMonthExpenses so we cover the 30 days reasonably
    const pool = new Map<string, number>();
    [...thisMonthExpenses, ...recentExpenses].forEach((e) => {
      const k = (e.date || "").slice(0, 10);
      if (!k) return;
      pool.set(k, (pool.get(k) || 0) + Number(e.amount));
    });
    return days.map((d) => ({ ...d, total: pool.get(d.label) || 0 }));
  }, [thisMonthExpenses, recentExpenses, now]);

  const maxDaily = Math.max(1, ...sparkline.map((d) => d.total));

  const handleDelete = async () => {
    if (!budget) return;
    const ok = await confirm({
      title: `Delete ${budget.category} budget?`,
      message: "This only removes the budget target — expenses won't be affected.",
      destructive: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await onDelete(budget.id);
      success("Budget deleted");
      onClose();
    } catch {
      toastError("Couldn't delete budget");
    }
  };

  const handleEdit = () => {
    if (!budget) return;
    onEdit(budget.id);
  };

  const icon = budget ? CATEGORY_ICON[budget.category] || "\u{1F4B8}" : "\u{1F4B8}";

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={onClose} size="lg">
        {!budget || loading ? (
          <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">Loading...</div>
        ) : (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                style={{ background: `${budget.color}15` }}
              >
                <span>{icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{budget.category}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                  ${monthly.toFixed(2)} / month · {thisMonthName}
                </p>
              </div>
            </div>

            {/* This month spend */}
            <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4">
              <div className="flex items-baseline justify-between">
                <p className={`text-3xl font-bold tabular-nums ${progressTextColor}`}>
                  ${spent.toFixed(2)}
                </p>
                <p className={`text-sm font-semibold tabular-nums ${progressTextColor}`}>
                  {progress.toFixed(0)}%
                </p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
                ${spent.toFixed(2)} of ${monthly.toFixed(2)} budget · {progress.toFixed(0)}%
              </p>
              <div className="mt-3 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-700 ease-out rounded-full ${progressColor}`}
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs tabular-nums">
                <span className={overBudget ? "text-red-600 dark:text-red-400 font-medium" : "text-gray-500 dark:text-gray-400"}>
                  {overBudget
                    ? `$${Math.abs(remaining).toFixed(2)} over`
                    : `$${remaining.toFixed(2)} left`}
                </span>
                {/* Last month comparison chip */}
                {lastMonthTotal > 0 || spent > 0 ? (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      deltaBetter
                        ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300"
                        : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {deltaBetter ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                    {delta === 0
                      ? "Same as last month"
                      : `${delta > 0 ? "+" : "-"}$${Math.abs(delta).toFixed(2)} vs last month`}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Daily sparkline */}
            {sparkline.some((d) => d.total > 0) && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last 30 days</h3>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">Max ${maxDaily.toFixed(0)}</span>
                </div>
                <div className="flex items-end gap-0.5 h-16">
                  {sparkline.map((d, i) => {
                    const height = d.total > 0 ? Math.max(6, (d.total / maxDaily) * 100) : 2;
                    return (
                      <div
                        key={d.label}
                        className="flex-1 rounded-sm transition-all"
                        style={{
                          height: `${height}%`,
                          background: d.total > 0 ? budget.color : "currentColor",
                          opacity: d.total > 0 ? 1 : 0.1,
                        }}
                        title={`${d.label}: $${d.total.toFixed(2)}`}
                        aria-label={`${d.label}: $${d.total.toFixed(2)}`}
                      >
                        <span className="sr-only">
                          {d.label}: ${d.total.toFixed(2)} (bar {i + 1} of {sparkline.length})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent transactions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Recent transactions</h3>
                <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{recentExpenses.length}</span>
              </div>
              {recentExpenses.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl px-4 py-8 text-center">
                  <div className="mx-auto w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-2">
                    <Receipt size={16} className="text-gray-400 dark:text-gray-500" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">No expenses in this category yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  {recentExpenses.map((e) => {
                    const card = e.credit_card_id ? cardMap.get(e.credit_card_id) : null;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setEditExpense(e)}
                        className="w-full text-left px-3.5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-center gap-3 cursor-pointer"
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            e.is_card_payment
                              ? "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400"
                              : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                          }`}
                        >
                          {e.is_card_payment ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{e.name}</p>
                          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            <span>{new Date(e.date).toLocaleDateString()}</span>
                            {card ? (
                              <span className="inline-flex items-center gap-1">
                                <CreditCard size={10} />
                                {card.name}
                                {card.last_four ? ` ••${card.last_four}` : ""}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                <Banknote size={10} /> Cash
                              </span>
                            )}
                            {e.notes ? <span className="truncate">· {e.notes}</span> : null}
                          </div>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100 shrink-0">
                          ${Number(e.amount).toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleEdit}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors"
              >
                <Pencil size={14} /> Edit budget
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-red-600/20"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      <EditExpenseModal
        isOpen={!!editExpense}
        expense={editExpense}
        onClose={() => setEditExpense(null)}
        onUpdated={() => {
          setEditExpense(null);
          fetchData();
        }}
      />
    </>
  );
}
