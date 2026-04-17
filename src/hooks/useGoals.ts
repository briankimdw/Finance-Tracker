"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { Goal, GoalContribution, GoalWithStats, GoalCategory } from "@/lib/types";

function calculateDays(targetDate: string | null): number | null {
  if (!targetDate) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(targetDate + "T12:00:00");
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function useGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<GoalWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    try {
      let goalsQ = supabase.from("goals").select("*").order("completed", { ascending: true }).order("display_order", { ascending: true }).order("created_at", { ascending: true });
      let contribQ = supabase.from("goal_contributions").select("*").order("date", { ascending: false });

      if (user) {
        goalsQ = goalsQ.eq("user_id", user.id);
        contribQ = contribQ.eq("user_id", user.id);
      } else {
        goalsQ = goalsQ.is("user_id", null);
        contribQ = contribQ.is("user_id", null);
      }

      const [goalsRes, contribRes] = await Promise.all([goalsQ, contribQ]);
      const rawGoals = (goalsRes.data as Goal[]) || [];
      const allContribs = (contribRes.data as GoalContribution[]) || [];

      const enriched: GoalWithStats[] = rawGoals.map((g) => {
        const contributions = allContribs.filter((c) => c.goal_id === g.id);
        const saved = contributions.reduce((sum, c) => sum + Number(c.amount), 0);
        const target = Number(g.target_amount);
        const remaining = Math.max(0, target - saved);
        const progress = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
        return {
          ...g,
          saved,
          remaining,
          progress,
          daysUntilTarget: calculateDays(g.target_date),
          contributions,
        };
      });

      setGoals(enriched);
    } catch {
      setGoals([]);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const createGoal = async (data: { name: string; target_amount: number; category?: GoalCategory; color?: string; icon?: string; notes?: string; target_date?: string | null; url?: string; image_url?: string }) => {
    const maxOrder = goals.length > 0 ? Math.max(...goals.map((g) => g.display_order)) : 0;
    await supabase.from("goals").insert({
      user_id: user?.id ?? null,
      name: data.name,
      target_amount: data.target_amount,
      category: data.category || "savings",
      color: data.color || "#3b82f6",
      icon: data.icon || "Target",
      notes: data.notes || null,
      target_date: data.target_date || null,
      url: data.url || null,
      image_url: data.image_url || null,
      display_order: maxOrder + 1,
    });
    await fetchGoals();
  };

  const updateGoal = async (id: string, data: Partial<Goal>) => {
    await supabase.from("goals").update(data).eq("id", id);
    await fetchGoals();
  };

  const deleteGoal = async (id: string) => {
    await supabase.from("goals").delete().eq("id", id);
    await fetchGoals();
  };

  const reorderGoals = async (newOrder: GoalWithStats[]) => {
    setGoals(newOrder.map((g, i) => ({ ...g, display_order: i })));
    await Promise.all(newOrder.map((g, i) =>
      supabase.from("goals").update({ display_order: i }).eq("id", g.id)
    ));
  };

  const addContribution = async (goalId: string, amount: number, notes?: string, date?: string) => {
    await supabase.from("goal_contributions").insert({
      goal_id: goalId,
      user_id: user?.id ?? null,
      amount,
      date: date || new Date().toISOString().split("T")[0],
      notes: notes || null,
    });
    await fetchGoals();
  };

  const deleteContribution = async (id: string) => {
    await supabase.from("goal_contributions").delete().eq("id", id);
    await fetchGoals();
  };

  return {
    goals, loading, refetch: fetchGoals,
    createGoal, updateGoal, deleteGoal, reorderGoals,
    addContribution, deleteContribution,
  };
}
