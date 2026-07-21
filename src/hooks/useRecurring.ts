"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeRefetch } from "@/lib/useRealtimeRefetch";
import { monthlyEquivalent } from "@/lib/recurring";
import type { RecurringRule } from "@/lib/types";

export type RecurringRuleInput = Omit<RecurringRule, "id" | "user_id" | "created_at" | "updated_at" | "last_applied_date">;

export function useRecurringRules() {
  const { user } = useAuth();
  const supabase = createClient();
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from("recurring_rules").select("*").order("next_due_date", { ascending: true });
      if (user) q = q.eq("user_id", user.id);
      else q = q.is("user_id", null);
      const { data } = await q;
      setRules((data as RecurringRule[]) || []);
    } catch {
      setRules([]);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => { fetchRules(); }, [fetchRules]);
  useRealtimeRefetch(["recurring_rules"], fetchRules);

  const createRule = async (input: RecurringRuleInput) => {
    const { error } = await supabase.from("recurring_rules").insert({ ...input, user_id: user?.id ?? null });
    if (error) throw new Error(error.message);
    await fetchRules();
  };

  const updateRule = async (id: string, patch: Partial<RecurringRuleInput>) => {
    const { error } = await supabase.from("recurring_rules").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
    await fetchRules();
  };

  const deleteRule = async (id: string) => {
    await supabase.from("recurring_rules").delete().eq("id", id);
    await fetchRules();
  };

  const totals = useMemo(() => {
    const active = rules.filter((r) => r.active);
    const monthlyExpenses = active.filter((r) => r.kind === "expense")
      .reduce((s, r) => s + monthlyEquivalent(Number(r.amount), r.frequency), 0);
    const monthlyIncome = active.filter((r) => r.kind === "income")
      .reduce((s, r) => s + monthlyEquivalent(Number(r.amount), r.frequency), 0);
    return { monthlyExpenses, monthlyIncome, monthlyNet: monthlyIncome - monthlyExpenses };
  }, [rules]);

  return { rules, totals, loading, refetch: fetchRules, createRule, updateRule, deleteRule };
}
