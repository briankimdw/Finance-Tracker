"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
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
      const { data } = await q;
      setAccounts((data as CashAccount[]) || []);
    } catch {
      setAccounts([]);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

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

  return { accounts, totalBalance, loading, refetch: fetchAccounts, createAccount, updateAccount, deleteAccount, reorderAccounts };
}
