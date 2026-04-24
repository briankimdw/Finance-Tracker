"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { MetalTransaction } from "@/lib/types";

export function useMetalTransactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<MetalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      let txQuery = supabase
        .from("metal_transactions")
        .select("*, metal_transaction_items(id, holding_id, direction, holdings:holding_id(*))")
        .order("created_at", { ascending: false });
      if (user) txQuery = txQuery.eq("user_id", user.id);
      else txQuery = txQuery.is("user_id", null);

      const { data } = await txQuery;
      const rows = (data || []) as unknown as Array<
        MetalTransaction & { metal_transaction_items?: Array<{ id: string; holding_id: string | null; direction: "in" | "out"; holdings: unknown }> }
      >;

      const mapped: MetalTransaction[] = rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        type: r.type,
        notes: r.notes,
        cash_amount: r.cash_amount,
        created_at: r.created_at,
        items: (r.metal_transaction_items || []).map((item) => ({
          id: item.id,
          transaction_id: r.id,
          holding_id: item.holding_id,
          direction: item.direction,
          holding: item.holdings as never,
        })),
      }));

      setTransactions(mapped);
    } catch {
      setTransactions([]);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const createBuyTransaction = async (holdingId: string, notes = "") => {
    const { data: tx } = await supabase
      .from("metal_transactions")
      .insert({ user_id: user?.id ?? null, type: "buy", notes, cash_amount: 0 })
      .select()
      .single();
    if (tx) {
      await supabase.from("metal_transaction_items").insert({ transaction_id: tx.id, holding_id: holdingId, direction: "in" });
    }
    await fetchTransactions();
  };

  const createSellTransaction = async (holdingId: string, cashAmount: number, notes = "") => {
    const { data: tx } = await supabase
      .from("metal_transactions")
      .insert({ user_id: user?.id ?? null, type: "sell", notes, cash_amount: cashAmount })
      .select()
      .single();
    if (tx) {
      await supabase.from("metal_transaction_items").insert({ transaction_id: tx.id, holding_id: holdingId, direction: "out" });
    }
    await fetchTransactions();
  };

  return { transactions, loading, refetch: fetchTransactions, createBuyTransaction, createSellTransaction };
}
