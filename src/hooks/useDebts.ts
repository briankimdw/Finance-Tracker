"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { todayEST } from "@/lib/dates";
import { useRealtimeRefetch } from "@/lib/useRealtimeRefetch";
import { adjustAccountBalance, adjustCheckingBalance } from "@/lib/updateBalance";
import type { Debt, DebtPayment, DebtWithStats } from "@/lib/types";

export function useDebts() {
  const { user } = useAuth();
  const [debts, setDebts] = useState<DebtWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchDebts = useCallback(async () => {
    setLoading(true);
    try {
      let debtsQ = supabase.from("debts").select("*").order("settled", { ascending: true }).order("created_at", { ascending: false });
      let paymentsQ = supabase.from("debt_payments").select("*").order("date", { ascending: false });
      if (user) { debtsQ = debtsQ.eq("user_id", user.id); paymentsQ = paymentsQ.eq("user_id", user.id); }
      else { debtsQ = debtsQ.is("user_id", null); paymentsQ = paymentsQ.is("user_id", null); }

      const [debtsRes, paymentsRes] = await Promise.all([debtsQ, paymentsQ]);
      const rawDebts = (debtsRes.data as Debt[]) || [];
      const allPayments = (paymentsRes.data as DebtPayment[]) || [];

      const enriched: DebtWithStats[] = rawDebts.map((d) => {
        const payments = allPayments.filter((p) => p.debt_id === d.id);
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const original = Number(d.original_amount);
        const remaining = Math.max(0, original - totalPaid);
        const progress = original > 0 ? Math.min(100, (totalPaid / original) * 100) : 0;
        return { ...d, totalPaid, remaining, progress, payments };
      });
      setDebts(enriched);
    } catch { setDebts([]); }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => { fetchDebts(); }, [fetchDebts]);
  useRealtimeRefetch(["debts", "debt_payments"], fetchDebts);

  const createDebt = async (data: { person: string; direction: "i_owe" | "they_owe"; description?: string; original_amount: number; date?: string; color?: string }) => {
    await supabase.from("debts").insert({
      user_id: user?.id ?? null, person: data.person, direction: data.direction,
      description: data.description || null, original_amount: data.original_amount,
      date: data.date || todayEST(), color: data.color || "#f59e0b",
    });
    await fetchDebts();
  };

  const updateDebt = async (id: string, data: Partial<Debt>) => {
    await supabase.from("debts").update(data).eq("id", id);
    await fetchDebts();
  };

  const deleteDebt = async (id: string) => {
    await supabase.from("debts").delete().eq("id", id);
    await fetchDebts();
  };

  const addPayment = async (debtId: string, amount: number, notes?: string, date?: string, accountId?: string) => {
    const { error } = await supabase.from("debt_payments").insert({
      debt_id: debtId, user_id: user?.id ?? null, amount,
      date: date || todayEST(), notes: notes || null,
    });

    if (!error) {
      const debt = debts.find((d) => d.id === debtId);
      if (debt) {
        // Adjust cash account:
        // - I owe them (I'm paying back): money LEAVES my account (negative)
        // - They owe me (I'm receiving payment): money ENTERS my account (positive)
        const signed = debt.direction === "i_owe" ? -amount : amount;
        if (accountId) {
          await adjustAccountBalance(accountId, signed);
        } else {
          await adjustCheckingBalance(user?.id ?? null, signed);
        }

        // Auto-settle if fully paid
        if (debt.remaining <= amount) {
          await supabase.from("debts").update({ settled: true, settled_date: todayEST() }).eq("id", debtId);
        }
      }
    }

    await fetchDebts();
  };

  const deletePayment = async (id: string) => {
    await supabase.from("debt_payments").delete().eq("id", id);
    await fetchDebts();
  };

  const totalIOwe = debts.filter((d) => !d.settled && d.direction === "i_owe").reduce((s, d) => s + d.remaining, 0);
  const totalTheyOwe = debts.filter((d) => !d.settled && d.direction === "they_owe").reduce((s, d) => s + d.remaining, 0);

  return { debts, loading, refetch: fetchDebts, createDebt, updateDebt, deleteDebt, addPayment, deletePayment, totalIOwe, totalTheyOwe };
}
