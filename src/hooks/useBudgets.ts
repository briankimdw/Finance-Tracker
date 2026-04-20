"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeRefetch } from "@/lib/useRealtimeRefetch";
import type { Budget, BudgetWithSpend, Expense } from "@/lib/types";

export function useBudgets() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<BudgetWithSpend[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const endMonth = now.getMonth() + 2;
    const endYear = endMonth > 12 ? now.getFullYear() + 1 : now.getFullYear();
    const endDate = `${endYear}-${String(endMonth > 12 ? 1 : endMonth).padStart(2, "0")}-01`;

    try {
      let budgetsQ = supabase.from("budgets").select("*").order("category", { ascending: true });
      let expensesQ = supabase.from("expenses").select("category, amount, is_card_payment").eq("is_card_payment", false).gte("date", startDate).lt("date", endDate);

      if (user) {
        budgetsQ = budgetsQ.eq("user_id", user.id);
        expensesQ = expensesQ.eq("user_id", user.id);
      } else {
        budgetsQ = budgetsQ.is("user_id", null);
        expensesQ = expensesQ.is("user_id", null);
      }

      const [budgetsRes, expensesRes] = await Promise.all([budgetsQ, expensesQ]);
      const raw = (budgetsRes.data as Budget[]) || [];
      const expenses = (expensesRes.data as Pick<Expense, "category" | "amount" | "is_card_payment">[]) || [];

      const enriched: BudgetWithSpend[] = raw.map((b) => {
        const spent = expenses.filter((e) => e.category === b.category).reduce((sum, e) => sum + Number(e.amount), 0);
        const monthly = Number(b.monthly_amount);
        const remaining = monthly - spent;
        const progress = monthly > 0 ? (spent / monthly) * 100 : 0;
        return { ...b, spent, remaining, progress, overBudget: spent > monthly };
      });

      setBudgets(enriched);
    } catch {
      setBudgets([]);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);
  useRealtimeRefetch(["budgets", "expenses"], fetchBudgets);

  const createBudget = async (data: { category: string; monthly_amount: number; color?: string }) => {
    await supabase.from("budgets").insert({ user_id: user?.id ?? null, category: data.category, monthly_amount: data.monthly_amount, color: data.color || "#3b82f6" });
    await fetchBudgets();
  };

  const updateBudget = async (id: string, data: Partial<Budget>) => {
    await supabase.from("budgets").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
    await fetchBudgets();
  };

  const deleteBudget = async (id: string) => {
    await supabase.from("budgets").delete().eq("id", id);
    await fetchBudgets();
  };

  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.monthly_amount), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);

  return { budgets, loading, refetch: fetchBudgets, createBudget, updateBudget, deleteBudget, totalBudget, totalSpent };
}
