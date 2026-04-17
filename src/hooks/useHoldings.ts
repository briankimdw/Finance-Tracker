"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useMetalPrices } from "@/hooks/useMetalPrices";
import { METAL_KEYS } from "@/lib/metals";
import type { Holding, HoldingStatus, PortfolioStats, MetalMetrics, MetalType } from "@/lib/types";

export function useHoldings(status?: HoldingStatus) {
  const { user } = useAuth();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchHoldings = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from("holdings").select("*").order("created_at", { ascending: false });
      if (user) query = query.eq("user_id", user.id);
      else query = query.is("user_id", null);
      if (status) query = query.eq("status", status);
      const { data } = await query;
      setHoldings((data as Holding[]) || []);
    } catch {
      setHoldings([]);
    }
    setLoading(false);
  }, [user, status, supabase]);

  useEffect(() => {
    fetchHoldings();
  }, [fetchHoldings]);

  const deleteHolding = async (id: string) => {
    await supabase.from("holdings").delete().eq("id", id);
    await fetchHoldings();
  };

  return { holdings, loading, refetch: fetchHoldings, deleteHolding };
}

export function usePortfolioStats() {
  const { holdings, loading: loadingHoldings, refetch } = useHoldings("active");
  const { prices, loading: loadingPrices } = useMetalPrices();

  const stats = useMemo<PortfolioStats>(() => {
    const breakdown: Record<MetalType, MetalMetrics> = {
      gold: { totalOz: 0, totalCost: 0, currentValue: 0, pnl: 0, pnlPercent: 0, count: 0 },
      silver: { totalOz: 0, totalCost: 0, currentValue: 0, pnl: 0, pnlPercent: 0, count: 0 },
      platinum: { totalOz: 0, totalCost: 0, currentValue: 0, pnl: 0, pnlPercent: 0, count: 0 },
      palladium: { totalOz: 0, totalCost: 0, currentValue: 0, pnl: 0, pnlPercent: 0, count: 0 },
    };

    for (const h of holdings) {
      const m = breakdown[h.metal];
      const oz = Number(h.quantity);
      const cost = oz * Number(h.cost_per_oz);
      m.totalOz += oz;
      m.totalCost += cost;
      m.count += 1;
    }

    let totalValue = 0;
    let totalCost = 0;
    for (const k of METAL_KEYS) {
      const m = breakdown[k];
      m.currentValue = m.totalOz * prices[k];
      m.pnl = m.currentValue - m.totalCost;
      m.pnlPercent = m.totalCost > 0 ? (m.pnl / m.totalCost) * 100 : 0;
      totalValue += m.currentValue;
      totalCost += m.totalCost;
    }

    const totalPnl = totalValue - totalCost;
    const pnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    return { totalValue, totalCost, totalPnl, pnlPercent, metalBreakdown: breakdown };
  }, [holdings, prices]);

  return { stats, loading: loadingHoldings || loadingPrices, refetch };
}

export function useRealizedMetalProfit() {
  const { user } = useAuth();
  const [monthlyProfit, setMonthlyProfit] = useState(0);
  const [lifetimeProfit, setLifetimeProfit] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchProfit = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const endMonth = now.getMonth() + 2;
    const endYear = endMonth > 12 ? now.getFullYear() + 1 : now.getFullYear();
    const endDate = `${endYear}-${String(endMonth > 12 ? 1 : endMonth).padStart(2, "0")}-01`;

    try {
      let query = supabase.from("holdings").select("quantity, cost_per_oz, sale_price_per_oz, sale_date, fees").eq("status", "sold");
      if (user) query = query.eq("user_id", user.id);
      else query = query.is("user_id", null);
      const { data } = await query;
      const rows = (data || []) as { quantity: number; cost_per_oz: number; sale_price_per_oz: number; sale_date: string; fees: number }[];

      let monthly = 0;
      let lifetime = 0;
      for (const r of rows) {
        const profit = (Number(r.sale_price_per_oz) - Number(r.cost_per_oz)) * Number(r.quantity) - Number(r.fees || 0);
        lifetime += profit;
        if (r.sale_date && r.sale_date >= startDate && r.sale_date < endDate) {
          monthly += profit;
        }
      }
      setMonthlyProfit(monthly);
      setLifetimeProfit(lifetime);
    } catch {
      setMonthlyProfit(0);
      setLifetimeProfit(0);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchProfit();
  }, [fetchProfit]);

  return { monthlyProfit, lifetimeProfit, loading, refetch: fetchProfit };
}
