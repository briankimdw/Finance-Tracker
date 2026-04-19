"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { adjustCheckingBalance } from "@/lib/updateBalance";
import { todayEST } from "@/lib/dates";
import { useRealtimeRefetch } from "@/lib/useRealtimeRefetch";
// Quick-add uses the default checking account since there's no picker
import type { Income, IncomeType, SavedIncome } from "@/lib/types";

export function useIncome(type?: IncomeType) {
  const { user } = useAuth();
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchIncomes = useCallback(async () => {
    setLoading(true);

    try {
      let query = supabase
        .from("income")
        .select("*")
        .order("date", { ascending: false });

      if (user) {
        query = query.eq("user_id", user.id);
      } else {
        query = query.is("user_id", null);
      }

      if (type) {
        query = query.eq("type", type);
      }

      const { data } = await query;
      setIncomes((data as Income[]) || []);
    } catch {
      setIncomes([]);
    }
    setLoading(false);
  }, [user, type, supabase]);

  useEffect(() => {
    fetchIncomes();
  }, [fetchIncomes]);
  useRealtimeRefetch(["income"], fetchIncomes);

  const deleteIncome = async (id: string) => {
    await supabase.from("income").delete().eq("id", id);
    await fetchIncomes();
  };

  return { incomes, loading, refetch: fetchIncomes, deleteIncome };
}

export function useIncomeStats() {
  const { user } = useAuth();
  const [mainTotal, setMainTotal] = useState(0);
  const [sideTotal, setSideTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchStats = useCallback(async () => {
    setLoading(true);

    try {
      let query = supabase.from("income").select("*");
      if (user) {
        query = query.eq("user_id", user.id);
      } else {
        query = query.is("user_id", null);
      }

      const { data } = await query;
      const items = (data as Income[]) || [];

      const main = items
        .filter((i) => i.type === "main")
        .reduce((sum, i) => sum + Number(i.amount), 0);
      const side = items
        .filter((i) => i.type === "side")
        .reduce((sum, i) => sum + Number(i.amount), 0);

      setMainTotal(main);
      setSideTotal(side);
      setCount(items.length);
    } catch {
      setMainTotal(0);
      setSideTotal(0);
      setCount(0);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);
  useRealtimeRefetch(["income"], fetchStats);

  return { mainTotal, sideTotal, count, loading, refetch: fetchStats };
}

export function useMonthlyIncomeStats() {
  const { user } = useAuth();
  const [mainTotal, setMainTotal] = useState(0);
  const [sideTotal, setSideTotal] = useState(0);
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
      let query = supabase.from("income").select("type, amount").gte("date", startDate).lt("date", endDate);
      if (user) query = query.eq("user_id", user.id);
      else query = query.is("user_id", null);
      const { data } = await query;
      const items = (data as { type: string; amount: number }[]) || [];
      setMainTotal(items.filter((i) => i.type === "main").reduce((s, i) => s + Number(i.amount), 0));
      setSideTotal(items.filter((i) => i.type === "side").reduce((s, i) => s + Number(i.amount), 0));
    } catch { setMainTotal(0); setSideTotal(0); }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useRealtimeRefetch(["income"], fetchStats);
  return { mainTotal, sideTotal, loading, refetch: fetchStats };
}

export function useSavedIncome() {
  const { user } = useAuth();
  const [savedIncomes, setSavedIncomes] = useState<SavedIncome[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchSaved = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from("saved_income").select("*").order("created_at", { ascending: false });
      if (user) {
        query = query.eq("user_id", user.id);
      } else {
        query = query.is("user_id", null);
      }
      const { data } = await query;
      setSavedIncomes((data as SavedIncome[]) || []);
    } catch {
      setSavedIncomes([]);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  const savePinned = async (saved: Omit<SavedIncome, "id" | "created_at">) => {
    await supabase.from("saved_income").insert(saved);
    await fetchSaved();
  };

  const deleteSaved = async (id: string) => {
    await supabase.from("saved_income").delete().eq("id", id);
    await fetchSaved();
  };

  const quickAdd = async (saved: SavedIncome) => {
    const { error } = await supabase.from("income").insert({
      user_id: user?.id ?? null,
      type: saved.type,
      source: saved.source,
      category: saved.category,
      amount: saved.amount,
      date: todayEST(),
      recurring: true,
      frequency: saved.frequency || "Monthly",
      notes: null,
    });
    if (!error) {
      await adjustCheckingBalance(user?.id ?? null, Number(saved.amount));
    }
  };

  return { savedIncomes, loading, savePinned, deleteSaved, quickAdd, refetch: fetchSaved };
}

export function filterIncomes(
  incomes: Income[],
  filters: {
    search: string;
    category: string;
    type: string;
    dateFrom: string;
    dateTo: string;
  }
): Income[] {
  return incomes.filter((inc) => {
    if (
      filters.search &&
      !inc.source.toLowerCase().includes(filters.search.toLowerCase()) &&
      !(inc.notes || "").toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false;
    }
    if (filters.category && inc.category !== filters.category) return false;
    if (filters.type && inc.type !== filters.type) return false;
    if (filters.dateFrom && inc.date < filters.dateFrom) return false;
    if (filters.dateTo && inc.date > filters.dateTo) return false;
    return true;
  });
}
