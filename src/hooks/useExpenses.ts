"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeRefetch } from "@/lib/useRealtimeRefetch";
import { adjustAccountBalance } from "@/lib/updateBalance";
import type { Expense } from "@/lib/types";

export function useExpenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from("expenses").select("*").order("date", { ascending: false });
      if (user) query = query.eq("user_id", user.id);
      else query = query.is("user_id", null);
      const { data } = await query;
      setExpenses((data as Expense[]) || []);
    } catch {
      setExpenses([]);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);
  useRealtimeRefetch(["expenses"], fetchExpenses);

  const deleteExpense = async (id: string) => {
    // Look up the expense before deleting so we can reverse any cash-account
    // debit it caused. Pure credit-card charges (payment_method=credit AND
    // is_card_payment=false) didn't touch a cash account, so nothing to revert.
    const { data: row } = await supabase
      .from("expenses")
      .select("amount, payment_method, is_card_payment, cash_account_id")
      .eq("id", id)
      .maybeSingle();
    await supabase.from("expenses").delete().eq("id", id);
    if (row) {
      const e = row as { amount: number; payment_method: string; is_card_payment: boolean; cash_account_id: string | null };
      const fundedFromCash = e.is_card_payment || e.payment_method !== "credit";
      if (fundedFromCash && e.cash_account_id) {
        // Original effect was -amount on the account; reversal is +amount.
        await adjustAccountBalance(e.cash_account_id, Number(e.amount));
      }
    }
    await fetchExpenses();
  };

  return { expenses, loading, refetch: fetchExpenses, deleteExpense };
}

export function useExpenseStats() {
  const { user } = useAuth();
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      // Exclude card payments — they're transferring debt to cash, not new spending
      let query = supabase.from("expenses").select("*").eq("is_card_payment", false);
      if (user) query = query.eq("user_id", user.id);
      else query = query.is("user_id", null);
      const { data } = await query;
      const items = (data as Expense[]) || [];
      setTotal(items.reduce((sum, e) => sum + Number(e.amount), 0));
      setCount(items.length);
    } catch {
      setTotal(0);
      setCount(0);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useRealtimeRefetch(["expenses"], fetchStats);

  return { total, count, loading, refetch: fetchStats };
}

export function useMonthlyExpenseStats() {
  const { user } = useAuth();
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const endMonth = now.getMonth() + 2;
    const endYear = endMonth > 12 ? now.getFullYear() + 1 : now.getFullYear();
    const endDate = `${endYear}-${String(endMonth > 12 ? 1 : endMonth).padStart(2, "0")}-01`;
    try {
      // Exclude card payments from spending stats
      let query = supabase.from("expenses").select("amount").eq("is_card_payment", false).gte("date", startDate).lt("date", endDate);
      if (user) query = query.eq("user_id", user.id);
      else query = query.is("user_id", null);
      const { data } = await query;
      setTotal((data || []).reduce((sum: number, e: { amount: number }) => sum + Number(e.amount), 0));
    } catch { setTotal(0); }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useRealtimeRefetch(["expenses"], fetchStats);
  return { total, loading, refetch: fetchStats };
}

export interface ExpenseFilters {
  search: string;
  category: string;
  dateFrom: string;
  dateTo: string;
  // Payment method filter. Special values:
  //   ""               → no filter
  //   "credit"         → any credit-card charge (regardless of which card)
  //   "cash" / "debit" / "bank_transfer" / "other" → match payment_method exactly
  paidWith: string;
  // Specific credit card (overrides paidWith filter for credit charges)
  cardId: string;
  // Specific cash account (Checking / Savings / Cash on hand etc.)
  cashAccountId: string;
}

export function filterExpenses(
  expenses: Expense[],
  filters: ExpenseFilters
): Expense[] {
  return expenses.filter((e) => {
    if (filters.search && !e.name.toLowerCase().includes(filters.search.toLowerCase()) && !(e.notes || "").toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.category && e.category !== filters.category) return false;
    if (filters.dateFrom && e.date < filters.dateFrom) return false;
    if (filters.dateTo && e.date > filters.dateTo) return false;
    if (filters.paidWith) {
      // For "credit" filter we match any credit-card charge (ignore card payments)
      if (filters.paidWith === "credit") {
        if (e.payment_method !== "credit" || e.is_card_payment) return false;
      } else if (e.payment_method !== filters.paidWith) {
        return false;
      }
    }
    if (filters.cardId && e.credit_card_id !== filters.cardId) return false;
    if (filters.cashAccountId && e.cash_account_id !== filters.cashAccountId) return false;
    return true;
  });
}
