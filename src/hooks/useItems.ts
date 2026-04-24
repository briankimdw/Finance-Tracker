"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { Item, DashboardStats } from "@/lib/types";
import type { Filters } from "@/components/FilterBar";

export function useItems(status?: "active" | "sold") {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchItems = useCallback(async () => {
    setLoading(true);

    try {
      let query = supabase
        .from("items")
        .select("*")
        .order("created_at", { ascending: false });

      if (user) {
        query = query.eq("user_id", user.id);
      } else {
        query = query.is("user_id", null);
      }

      if (status) {
        query = query.eq("status", status);
      }

      const { data } = await query;
      setItems((data as Item[]) || []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, [user, status, supabase]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const deleteItem = async (id: string) => {
    await supabase.from("items").delete().eq("id", id);
    await fetchItems();
  };

  return { items, loading, refetch: fetchItems, deleteItem };
}

export function useStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalInvested: 0,
    totalRevenue: 0,
    totalProfit: 0,
    roi: 0,
    activeItems: 0,
    soldItems: 0,
    inventoryValue: 0,
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchStats = useCallback(async () => {
    setLoading(true);

    let query = supabase.from("items").select("*");
    if (user) {
      query = query.eq("user_id", user.id);
    } else {
      query = query.is("user_id", null);
    }

    const { data: allItems } = await query;

    const items = (allItems as Item[]) || [];
    const active = items.filter((i) => i.status === "active");
    const sold = items.filter((i) => i.status === "sold");

    const totalInvested = items.reduce((sum, i) => sum + Number(i.purchase_price), 0);
    const totalRevenue = sold.reduce((sum, i) => sum + Number(i.sale_price || 0), 0);
    const totalFees = sold.reduce(
      (sum, i) => sum + Number(i.fees || 0) + Number(i.shipping_costs || 0),
      0
    );
    const soldCost = sold.reduce((sum, i) => sum + Number(i.purchase_price), 0);
    const totalProfit = totalRevenue - soldCost - totalFees;
    const roi = soldCost > 0 ? (totalProfit / soldCost) * 100 : 0;
    const inventoryValue = active.reduce((sum, i) => sum + Number(i.purchase_price), 0);

    setStats({
      totalInvested,
      totalRevenue,
      totalProfit,
      roi,
      activeItems: active.length,
      soldItems: sold.length,
      inventoryValue,
    });
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}

export function filterItems(items: Item[], filters: Filters): Item[] {
  return items.filter((item) => {
    if (
      filters.search &&
      !item.name.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false;
    }
    if (filters.category && item.category !== filters.category) {
      return false;
    }
    if (filters.platform) {
      if (
        item.platform_bought !== filters.platform &&
        item.platform_sold !== filters.platform
      ) {
        return false;
      }
    }
    if (filters.dateFrom) {
      const date = item.status === "sold" ? item.sale_date : item.purchase_date;
      if (date && date < filters.dateFrom) return false;
    }
    if (filters.dateTo) {
      const date = item.status === "sold" ? item.sale_date : item.purchase_date;
      if (date && date > filters.dateTo) return false;
    }
    return true;
  });
}
