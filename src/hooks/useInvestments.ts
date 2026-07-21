"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeRefetch } from "@/lib/useRealtimeRefetch";
import { todayEST } from "@/lib/dates";
import type { InvestmentAccount, InvestmentPosition, InvestmentPositionWithStats, InvestmentSnapshot } from "@/lib/types";

function withStats(p: InvestmentPosition): InvestmentPositionWithStats {
  const qty = Number(p.quantity);
  const cost = Number(p.avg_cost);
  const price = p.last_price !== null ? Number(p.last_price) : cost;
  const marketValue = qty * price;
  const costBasis = qty * cost;
  const pnl = marketValue - costBasis;
  return { ...p, marketValue, costBasis, pnl, pnlPercent: costBasis > 0 ? (pnl / costBasis) * 100 : 0 };
}

export function useInvestments() {
  const { user } = useAuth();
  const supabase = createClient();
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [positions, setPositions] = useState<InvestmentPositionWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      let accQ = supabase.from("investment_accounts").select("*").order("display_order").order("created_at");
      let posQ = supabase.from("investment_positions").select("*").order("created_at");
      if (user) { accQ = accQ.eq("user_id", user.id); posQ = posQ.eq("user_id", user.id); }
      else { accQ = accQ.is("user_id", null); posQ = posQ.is("user_id", null); }
      const [{ data: accs }, { data: poss }] = await Promise.all([accQ, posQ]);
      setAccounts((accs as InvestmentAccount[]) || []);
      setPositions((((poss as InvestmentPosition[]) || []).map(withStats)).sort((a, b) => b.marketValue - a.marketValue));
    } catch {
      setAccounts([]);
      setPositions([]);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useRealtimeRefetch(["investment_accounts", "investment_positions"], fetchAll);

  const createAccount = async (data: Partial<InvestmentAccount>) => {
    const maxOrder = accounts.length ? Math.max(...accounts.map((a) => a.display_order)) : 0;
    await supabase.from("investment_accounts").insert({
      user_id: user?.id ?? null,
      provider: data.provider || "robinhood",
      nickname: data.nickname || null,
      account_type: data.account_type || "individual",
      trading_type: data.trading_type || null,
      mask: data.mask || null,
      total_value: data.total_value ?? 0,
      equity_value: data.equity_value ?? 0,
      options_value: data.options_value ?? 0,
      event_contracts_value: data.event_contracts_value ?? 0,
      crypto_value: data.crypto_value ?? 0,
      cash: data.cash ?? 0,
      display_order: maxOrder + 1,
      last_synced_at: new Date().toISOString(),
    });
    await fetchAll();
  };

  const updateAccount = async (id: string, patch: Partial<InvestmentAccount>) => {
    await supabase.from("investment_accounts").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    await fetchAll();
  };

  const deleteAccount = async (id: string) => {
    await supabase.from("investment_accounts").delete().eq("id", id);
    await fetchAll();
  };

  // Manual position edits keep the parent account's stored equity/total in
  // sync so the dashboard net-worth figure never drifts from the detail view.
  const recomputeAccountFromPositions = async (accountId: string) => {
    const { data } = await supabase.from("investment_positions").select("*").eq("account_id", accountId);
    const equity = ((data as InvestmentPosition[]) || []).reduce((s, p) => s + withStats(p).marketValue, 0);
    const { data: accRows } = await supabase.from("investment_accounts").select("*").eq("id", accountId);
    const acc = (accRows as InvestmentAccount[] | null)?.[0];
    if (!acc) return;
    const total = equity + Number(acc.options_value) + Number(acc.event_contracts_value) + Number(acc.crypto_value) + Number(acc.cash);
    await supabase.from("investment_accounts").update({
      equity_value: Math.round(equity * 100) / 100,
      total_value: Math.round(total * 100) / 100,
      updated_at: new Date().toISOString(),
    }).eq("id", accountId);
  };

  const savePosition = async (data: { id?: string; account_id: string; symbol: string; quantity: number; avg_cost: number; last_price: number | null }) => {
    if (data.id) {
      await supabase.from("investment_positions").update({
        account_id: data.account_id,
        symbol: data.symbol.toUpperCase(),
        quantity: data.quantity,
        avg_cost: data.avg_cost,
        last_price: data.last_price,
        price_updated_at: data.last_price !== null ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("id", data.id);
    } else {
      await supabase.from("investment_positions").insert({
        user_id: user?.id ?? null,
        account_id: data.account_id,
        symbol: data.symbol.toUpperCase(),
        quantity: data.quantity,
        avg_cost: data.avg_cost,
        last_price: data.last_price,
        price_updated_at: data.last_price !== null ? new Date().toISOString() : null,
      });
    }
    await recomputeAccountFromPositions(data.account_id);
    await fetchAll();
  };

  const deletePosition = async (id: string) => {
    const pos = positions.find((p) => p.id === id);
    await supabase.from("investment_positions").delete().eq("id", id);
    if (pos) await recomputeAccountFromPositions(pos.account_id);
    await fetchAll();
  };

  /** Pulls fresh quotes (best-effort, keyless) and updates stored prices. Returns # of positions updated. */
  const refreshPrices = async (): Promise<number> => {
    const symbols = [...new Set(positions.map((p) => p.symbol))];
    if (symbols.length === 0) return 0;
    const res = await fetch(`/api/stock-prices?symbols=${symbols.join(",")}`);
    if (!res.ok) return 0;
    const body = (await res.json()) as { prices?: Record<string, number> };
    const prices = body.prices || {};
    let updated = 0;
    for (const p of positions) {
      const price = prices[p.symbol];
      if (price && Math.abs(price - (p.last_price ?? 0)) > 0.0001) {
        await supabase.from("investment_positions").update({
          last_price: price,
          price_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", p.id);
        updated++;
      }
    }
    if (updated > 0) {
      const accountIds = [...new Set(positions.map((p) => p.account_id))];
      for (const id of accountIds) await recomputeAccountFromPositions(id);
      await fetchAll();
    }
    return updated;
  };

  const totals = useMemo(() => ({
    total: accounts.reduce((s, a) => s + Number(a.total_value), 0),
    equities: accounts.reduce((s, a) => s + Number(a.equity_value), 0),
    options: accounts.reduce((s, a) => s + Number(a.options_value), 0),
    eventContracts: accounts.reduce((s, a) => s + Number(a.event_contracts_value), 0),
    crypto: accounts.reduce((s, a) => s + Number(a.crypto_value), 0),
    cash: accounts.reduce((s, a) => s + Number(a.cash), 0),
  }), [accounts]);

  const lastSyncedAt = useMemo(() => {
    const times = accounts.map((a) => a.last_synced_at).filter(Boolean) as string[];
    return times.length ? times.sort()[times.length - 1] : null;
  }, [accounts]);

  return {
    accounts, positions, totals, lastSyncedAt, loading, refetch: fetchAll,
    createAccount, updateAccount, deleteAccount,
    savePosition, deletePosition, refreshPrices,
  };
}

/** Lightweight total for the dashboard's net-worth formula. */
export function useInvestmentTotals() {
  const { user } = useAuth();
  const supabase = createClient();
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchTotals = useCallback(async () => {
    try {
      let q = supabase.from("investment_accounts").select("total_value");
      if (user) q = q.eq("user_id", user.id);
      else q = q.is("user_id", null);
      const { data } = await q;
      setTotal(((data as { total_value: number }[]) || []).reduce((s, a) => s + Number(a.total_value), 0));
    } catch {
      setTotal(0);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => { fetchTotals(); }, [fetchTotals]);
  useRealtimeRefetch(["investment_accounts"], fetchTotals);

  return { total, loading, refetch: fetchTotals };
}

export function useInvestmentHistory(days: number = 90) {
  const { user } = useAuth();
  const supabase = createClient();
  const [snapshots, setSnapshots] = useState<InvestmentSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSnapshots = useCallback(async () => {
    setLoading(true);
    const start = new Date();
    start.setDate(start.getDate() - days);
    const startDate = start.toISOString().split("T")[0];
    try {
      let q = supabase.from("investment_snapshots").select("*").gte("date", startDate).order("date", { ascending: true });
      if (user) q = q.eq("user_id", user.id);
      else q = q.is("user_id", null);
      const { data } = await q;
      setSnapshots((data as InvestmentSnapshot[]) || []);
    } catch {
      setSnapshots([]);
    }
    setLoading(false);
  }, [user, days, supabase]);

  useEffect(() => { fetchSnapshots(); }, [fetchSnapshots]);
  useRealtimeRefetch(["investment_snapshots"], fetchSnapshots);

  return { snapshots, loading, refetch: fetchSnapshots };
}

/** Upserts today's investments snapshot (same daily pattern as net worth). */
export async function saveInvestmentSnapshot(
  userId: string | null,
  totals: { total: number; equities: number; options: number; eventContracts: number; crypto: number; cash: number }
) {
  const supabase = createClient();
  const date = todayEST();
  let q = supabase.from("investment_snapshots").select("id").eq("date", date);
  if (userId) q = q.eq("user_id", userId);
  else q = q.is("user_id", null);
  const { data: existing } = await q.maybeSingle();
  const row = {
    total_value: totals.total,
    equities: totals.equities,
    options: totals.options,
    event_contracts: totals.eventContracts,
    crypto: totals.crypto,
    cash: totals.cash,
  };
  if (existing) {
    await supabase.from("investment_snapshots").update(row).eq("id", existing.id);
  } else {
    await supabase.from("investment_snapshots").insert({ user_id: userId, date, ...row });
  }
}
