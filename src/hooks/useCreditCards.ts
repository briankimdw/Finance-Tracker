"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { CreditCard, CreditCardWithStats } from "@/lib/types";

function calculateNextDueDate(dueDay: number | null): { date: string | null; daysUntil: number | null } {
  if (!dueDay) return { date: null, daysUntil: null };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Try this month first
  let target = new Date(now.getFullYear(), now.getMonth(), dueDay);
  if (target < today) {
    // Move to next month
    target = new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
  }
  const daysUntil = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isoDate = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
  return { date: isoDate, daysUntil };
}

export function useCreditCards() {
  const { user } = useAuth();
  const [cards, setCards] = useState<CreditCardWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      let cardsQ = supabase.from("credit_cards").select("*").order("display_order", { ascending: true }).order("created_at", { ascending: true });
      let expensesQ = supabase.from("expenses").select("amount, credit_card_id, is_card_payment").not("credit_card_id", "is", null);

      if (user) {
        cardsQ = cardsQ.eq("user_id", user.id);
        expensesQ = expensesQ.eq("user_id", user.id);
      } else {
        cardsQ = cardsQ.is("user_id", null);
        expensesQ = expensesQ.is("user_id", null);
      }

      const [cardsRes, expensesRes] = await Promise.all([cardsQ, expensesQ]);
      const rawCards = (cardsRes.data as CreditCard[]) || [];
      const expenses = (expensesRes.data || []) as { amount: number; credit_card_id: string; is_card_payment: boolean }[];

      const enriched: CreditCardWithStats[] = rawCards.map((c) => {
        const cardExpenses = expenses.filter((e) => e.credit_card_id === c.id);
        const totalCharges = cardExpenses.filter((e) => !e.is_card_payment).reduce((sum, e) => sum + Number(e.amount), 0);
        const totalPayments = cardExpenses.filter((e) => e.is_card_payment).reduce((sum, e) => sum + Number(e.amount), 0);
        const balance = totalCharges - totalPayments;
        const utilization = c.credit_limit && Number(c.credit_limit) > 0 ? (balance / Number(c.credit_limit)) * 100 : 0;
        const { date: nextDueDate, daysUntil: daysUntilDue } = calculateNextDueDate(c.due_day);
        return { ...c, balance, totalCharges, totalPayments, utilization, nextDueDate, daysUntilDue };
      });

      setCards(enriched);
    } catch {
      setCards([]);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const createCard = async (data: { name: string; last_four?: string; color?: string; credit_limit?: number | null; due_day?: number | null; statement_day?: number | null }) => {
    const maxOrder = cards.length > 0 ? Math.max(...cards.map((c) => c.display_order)) : 0;
    await supabase.from("credit_cards").insert({
      user_id: user?.id ?? null,
      name: data.name,
      last_four: data.last_four || null,
      color: data.color || "#3b82f6",
      credit_limit: data.credit_limit ?? null,
      due_day: data.due_day ?? null,
      statement_day: data.statement_day ?? null,
      display_order: maxOrder + 1,
    });
    await fetchCards();
  };

  const updateCard = async (id: string, data: Partial<{ name: string; last_four: string | null; color: string; credit_limit: number | null; due_day: number | null; statement_day: number | null }>) => {
    await supabase.from("credit_cards").update(data).eq("id", id);
    await fetchCards();
  };

  const deleteCard = async (id: string) => {
    await supabase.from("credit_cards").delete().eq("id", id);
    await fetchCards();
  };

  const reorderCards = async (newOrder: CreditCardWithStats[]) => {
    // Optimistically update local state
    setCards(newOrder.map((c, i) => ({ ...c, display_order: i })));
    // Persist to DB
    await Promise.all(newOrder.map((c, i) =>
      supabase.from("credit_cards").update({ display_order: i }).eq("id", c.id)
    ));
  };

  return { cards, loading, refetch: fetchCards, createCard, updateCard, deleteCard, reorderCards };
}
