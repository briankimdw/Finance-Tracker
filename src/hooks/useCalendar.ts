"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { Item, Income, Expense } from "@/lib/types";

export interface DayData {
  items: Item[];
  incomes: Income[];
  expenses: Expense[];
  total: number;
  earned: number;
  spent: number;
}

export function useCalendar(year: number, month: number) {
  const { user } = useAuth();
  const [dayMap, setDayMap] = useState<Map<string, DayData>>(new Map());
  const [monthTotal, setMonthTotal] = useState(0);
  const [monthEarned, setMonthEarned] = useState(0);
  const [monthSpent, setMonthSpent] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchMonth = useCallback(async () => {
    setLoading(true);

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endYear = month === 12 ? year + 1 : year;
    const endMonth = month === 12 ? 1 : month + 1;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

    try {
      let itemsQuery = supabase.from("items").select("*").eq("status", "sold").gte("sale_date", startDate).lt("sale_date", endDate);
      let incomeQuery = supabase.from("income").select("*").gte("date", startDate).lt("date", endDate);
      let expenseQuery = supabase.from("expenses").select("*").gte("date", startDate).lt("date", endDate);

      if (user) {
        itemsQuery = itemsQuery.eq("user_id", user.id);
        incomeQuery = incomeQuery.eq("user_id", user.id);
        expenseQuery = expenseQuery.eq("user_id", user.id);
      } else {
        itemsQuery = itemsQuery.is("user_id", null);
        incomeQuery = incomeQuery.is("user_id", null);
        expenseQuery = expenseQuery.is("user_id", null);
      }

      const [itemsResult, incomeResult, expenseResult] = await Promise.all([itemsQuery, incomeQuery, expenseQuery]);

      const items = (itemsResult.data as Item[]) || [];
      const incomes = (incomeResult.data as Income[]) || [];
      const expenses = (expenseResult.data as Expense[]) || [];

      const map = new Map<string, DayData>();
      let totalEarned = 0;
      let totalSpent = 0;

      for (const item of items) {
        const date = item.sale_date!;
        const profit = Number(item.sale_price) - Number(item.purchase_price) - Number(item.fees || 0) - Number(item.shipping_costs || 0);
        const existing = map.get(date) || { items: [], incomes: [], expenses: [], total: 0, earned: 0, spent: 0 };
        existing.items.push(item);
        existing.total += profit;
        existing.earned += profit;
        map.set(date, existing);
        totalEarned += profit;
      }

      for (const inc of incomes) {
        const date = inc.date;
        const amount = Number(inc.amount);
        const existing = map.get(date) || { items: [], incomes: [], expenses: [], total: 0, earned: 0, spent: 0 };
        existing.incomes.push(inc);
        existing.total += amount;
        existing.earned += amount;
        map.set(date, existing);
        totalEarned += amount;
      }

      for (const exp of expenses) {
        const date = exp.date;
        const amount = Number(exp.amount);
        const existing = map.get(date) || { items: [], incomes: [], expenses: [], total: 0, earned: 0, spent: 0 };
        existing.expenses.push(exp);
        existing.total -= amount;
        existing.spent += amount;
        map.set(date, existing);
        totalSpent += amount;
      }

      setDayMap(map);
      setMonthTotal(totalEarned - totalSpent);
      setMonthEarned(totalEarned);
      setMonthSpent(totalSpent);
    } catch {
      setDayMap(new Map());
      setMonthTotal(0);
      setMonthEarned(0);
      setMonthSpent(0);
    }

    setLoading(false);
  }, [user, year, month, supabase]);

  useEffect(() => { fetchMonth(); }, [fetchMonth]);

  return { dayMap, monthTotal, monthEarned, monthSpent, loading, refetch: fetchMonth };
}

export function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}
