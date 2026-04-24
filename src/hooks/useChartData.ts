"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { Item, Income } from "@/lib/types";

export interface MonthlyData {
  month: string;
  reselling: number;
  main: number;
  side: number;
  /** Total inflow for the month: main + side + reselling profit */
  income: number;
  /** Total outflow for the month (excludes card payments, which are debt transfers). */
  expenses: number;
  /** income - expenses */
  profit: number;
}

export interface CategoryBreakdown {
  name: string;
  value: number;
  color: string;
}

const COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#06b6d4", "#ec4899", "#84cc16",
];

export function useChartData() {
  const { user } = useAuth();
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Get last 6 months date range
    const now = new Date();
    const months: { key: string; label: string; start: string; end: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endD = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      months.push({
        key: d.toISOString().slice(0, 7),
        label: d.toLocaleDateString("en-US", { month: "short" }),
        start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
        end: `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, "0")}-01`,
      });
    }

    const startDate = months[0].start;

    try {
      let itemsQ = supabase
        .from("items")
        .select("*")
        .eq("status", "sold")
        .gte("sale_date", startDate);

      let incomeQ = supabase
        .from("income")
        .select("*")
        .gte("date", startDate);

      // Exclude card payments — transfers of debt, not real spending.
      let expensesQ = supabase
        .from("expenses")
        .select("date, amount")
        .eq("is_card_payment", false)
        .gte("date", startDate);

      if (user) {
        itemsQ = itemsQ.eq("user_id", user.id);
        incomeQ = incomeQ.eq("user_id", user.id);
        expensesQ = expensesQ.eq("user_id", user.id);
      } else {
        itemsQ = itemsQ.is("user_id", null);
        incomeQ = incomeQ.is("user_id", null);
        expensesQ = expensesQ.is("user_id", null);
      }

      const [itemsRes, incomeRes, expensesRes] = await Promise.all([itemsQ, incomeQ, expensesQ]);
      const items = (itemsRes.data as Item[]) || [];
      const incomes = (incomeRes.data as Income[]) || [];
      const expenses = (expensesRes.data as { date: string; amount: number }[]) || [];

      // Monthly aggregation
      const monthly: MonthlyData[] = months.map((m) => {
        const monthItems = items.filter(
          (i) => i.sale_date && i.sale_date >= m.start && i.sale_date < m.end
        );
        const monthIncomes = incomes.filter(
          (i) => i.date >= m.start && i.date < m.end
        );
        const monthExpenses = expenses.filter(
          (e) => e.date >= m.start && e.date < m.end
        );

        const reselling = monthItems.reduce(
          (sum, i) =>
            sum +
            Number(i.sale_price) -
            Number(i.purchase_price) -
            Number(i.fees || 0) -
            Number(i.shipping_costs || 0),
          0
        );
        const main = monthIncomes
          .filter((i) => i.type === "main")
          .reduce((sum, i) => sum + Number(i.amount), 0);
        const side = monthIncomes
          .filter((i) => i.type === "side")
          .reduce((sum, i) => sum + Number(i.amount), 0);
        const expenseTotal = monthExpenses.reduce(
          (sum, e) => sum + Number(e.amount),
          0
        );
        const income = main + side + reselling;

        return {
          month: m.label,
          reselling,
          main,
          side,
          income,
          expenses: expenseTotal,
          profit: income - expenseTotal,
        };
      });

      setMonthlyData(monthly);

      // Category breakdown (all income sources)
      const catMap = new Map<string, number>();

      // Add reselling profit as a category
      const totalReselling = items.reduce(
        (sum, i) =>
          sum +
          Number(i.sale_price) -
          Number(i.purchase_price) -
          Number(i.fees || 0) -
          Number(i.shipping_costs || 0),
        0
      );
      if (totalReselling > 0) catMap.set("Reselling", totalReselling);

      for (const inc of incomes) {
        const key = inc.source;
        catMap.set(key, (catMap.get(key) || 0) + Number(inc.amount));
      }

      const categories: CategoryBreakdown[] = Array.from(catMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, value], i) => ({
          name,
          value,
          color: COLORS[i % COLORS.length],
        }));

      setCategoryData(categories);
    } catch {
      setMonthlyData([]);
      setCategoryData([]);
    }

    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { monthlyData, categoryData, loading, refetch: fetchData };
}
