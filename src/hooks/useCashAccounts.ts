"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeRefetch } from "@/lib/useRealtimeRefetch";
import type { CashAccount, CashAccountType } from "@/lib/types";

export function useCashAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from("cash_accounts").select("*").order("display_order", { ascending: true }).order("created_at", { ascending: true });
      if (user) q = q.eq("user_id", user.id);
      else q = q.is("user_id", null);

      // Pull contributions (that point at a cash account) + the goal.completed flag
      // so we can compute per-account "reserved for active goals" totals.
      let contribQ = supabase
        .from("goal_contributions")
        .select("source_cash_account_id, amount, goals(completed)")
        .not("source_cash_account_id", "is", null);
      if (user) contribQ = contribQ.eq("user_id", user.id);
      else contribQ = contribQ.is("user_id", null);

      const [{ data }, { data: contribs }] = await Promise.all([q, contribQ]);

      const reservedByAccount = new Map<string, number>();
      type ContribRow = { source_cash_account_id: string | null; amount: number | string; goals: { completed: boolean } | { completed: boolean }[] | null };
      for (const c of ((contribs || []) as ContribRow[])) {
        if (!c.source_cash_account_id) continue;
        const goalRef = c.goals;
        const completed = Array.isArray(goalRef) ? goalRef[0]?.completed : goalRef?.completed;
        if (completed) continue;  // completed goals release their reservation
        reservedByAccount.set(
          c.source_cash_account_id,
          (reservedByAccount.get(c.source_cash_account_id) || 0) + Number(c.amount)
        );
      }

      const raw = (data as CashAccount[]) || [];
      const withReserved: CashAccount[] = raw.map((a) => ({
        ...a,
        reserved: Math.max(0, Math.round((reservedByAccount.get(a.id) || 0) * 100) / 100),
      }));
      setAccounts(withReserved);
    } catch {
      setAccounts([]);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);
  useRealtimeRefetch(["cash_accounts", "goal_contributions", "goals"], fetchAccounts);

  const createAccount = async (data: { name: string; type: CashAccountType; balance: number; color?: string }) => {
    const maxOrder = accounts.length > 0 ? Math.max(...accounts.map((a) => a.display_order)) : 0;
    await supabase.from("cash_accounts").insert({
      user_id: user?.id ?? null,
      name: data.name,
      type: data.type,
      balance: data.balance,
      color: data.color || "#10b981",
      display_order: maxOrder + 1,
    });
    await fetchAccounts();
  };

  const updateAccount = async (id: string, data: Partial<{ name: string; type: CashAccountType; balance: number; color: string }>) => {
    await supabase.from("cash_accounts").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
    await fetchAccounts();
  };

  const deleteAccount = async (id: string) => {
    await supabase.from("cash_accounts").delete().eq("id", id);
    await fetchAccounts();
  };

  const reorderAccounts = async (newOrder: CashAccount[]) => {
    setAccounts(newOrder.map((a, i) => ({ ...a, display_order: i })));
    await Promise.all(newOrder.map((a, i) =>
      supabase.from("cash_accounts").update({ display_order: i }).eq("id", a.id)
    ));
  };

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const totalReserved = accounts.reduce((sum, a) => sum + (a.reserved ?? 0), 0);
  const totalFree = totalBalance - totalReserved;

  return {
    accounts, totalBalance, totalReserved, totalFree,
    loading, refetch: fetchAccounts,
    createAccount, updateAccount, deleteAccount, reorderAccounts,
  };
}
