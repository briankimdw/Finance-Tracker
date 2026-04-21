"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { todayEST } from "@/lib/dates";
import { useRealtimeRefetch } from "@/lib/useRealtimeRefetch";
import type { Goal, GoalContribution, GoalWithStats, GoalCategory, GoalMember } from "@/lib/types";

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
      // RLS handles both owned and shared goals — no explicit user filter needed for authed users.
      // For anonymous mode, we still filter by null user_id.
      let goalsQ = supabase.from("goals").select("*, goal_members(id, goal_id, user_id, role, joined_at)").order("completed", { ascending: true }).order("display_order", { ascending: true }).order("created_at", { ascending: true });
      let contribQ = supabase.from("goal_contributions").select("*").order("date", { ascending: false });

      if (!user) {
        goalsQ = goalsQ.is("user_id", null);
        contribQ = contribQ.is("user_id", null);
      }

      const [goalsRes, contribRes] = await Promise.all([goalsQ, contribQ]);
      if (goalsRes.error) console.error("[useGoals] goals query error:", goalsRes.error);
      if (contribRes.error) console.error("[useGoals] contributions query error:", contribRes.error);
      const rawGoals = (goalsRes.data || []) as (Goal & { goal_members: GoalMember[] })[];
      const allContribs = (contribRes.data as GoalContribution[]) || [];

      const enriched: GoalWithStats[] = rawGoals.map((g) => {
        const contributions = allContribs.filter((c) => c.goal_id === g.id);
        const saved = contributions.reduce((sum, c) => sum + Number(c.amount), 0);
        const target = Number(g.target_amount);
        const remaining = Math.max(0, target - saved);
        const progress = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
        const members = g.goal_members || [];
        const myMember = user ? members.find((m) => m.user_id === user.id) : null;
        const isOwner = user ? (g.user_id === user.id || myMember?.role === "owner") : false;
        return {
          ...g,
          saved,
          remaining,
          progress,
          daysUntilTarget: calculateDays(g.target_date),
          contributions,
          members,
          isOwner,
          myRole: myMember?.role ?? null,
        };
      });

      setGoals(enriched);
    } catch (err) {
      console.error("[useGoals] fetchGoals threw:", err);
      setGoals([]);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);
  useRealtimeRefetch(["goals", "goal_contributions", "goal_members", "goal_invites"], fetchGoals);

  const createGoal = async (data: { name: string; target_amount: number; category?: GoalCategory; color?: string; icon?: string; notes?: string; target_date?: string | null; url?: string; image_url?: string; is_shared?: boolean }) => {
    const maxOrder = goals.length > 0 ? Math.max(...goals.map((g) => g.display_order)) : 0;
    const { data: inserted, error } = await supabase.from("goals").insert({
      user_id: user?.id ?? null,
      owner_id: user?.id ?? null,
      is_shared: !!data.is_shared && !!user, // can't share without auth
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
    }).select().single();

    if (!error && inserted && user) {
      // Add creator as a member with role='owner'
      await supabase.from("goal_members").insert({
        goal_id: inserted.id,
        user_id: user.id,
        role: "owner",
      });
    }
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
      date: date || todayEST(),
      notes: notes || null,
    });
    await fetchGoals();
  };

  const deleteContribution = async (id: string) => {
    await supabase.from("goal_contributions").delete().eq("id", id);
    await fetchGoals();
  };

  const inviteToGoal = async (
    goalId: string,
    email: string
  ): Promise<{ token: string; joinUrl: string; emailSent: boolean; reason?: string } | null> => {
    try {
      const res = await fetch("/api/goals/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId, email }),
      });
      const body = await res.json();
      if (!res.ok) {
        console.error("[useGoals] inviteToGoal error:", body.error);
        return null;
      }
      return body;
    } catch (err) {
      console.error("[useGoals] inviteToGoal threw:", err);
      return null;
    }
  };

  /** Invite a friend (by user_id) to a goal. No email sent; friend accepts in-app. */
  const inviteFriendToGoal = async (
    goalId: string,
    friendUserId: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: "Sign in first" };
    await supabase.from("goals").update({ is_shared: true }).eq("id", goalId);
    const { data: existing } = await supabase
      .from("goal_invites")
      .select("*")
      .eq("goal_id", goalId)
      .eq("target_user_id", friendUserId)
      .is("accepted_at", null)
      .maybeSingle();
    if (existing) return { ok: false, error: "Invite already pending" };
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    for (let i = 0; i < 20; i++) token += chars[Math.floor(Math.random() * chars.length)];
    const { error } = await supabase.from("goal_invites").insert({
      goal_id: goalId,
      token,
      target_user_id: friendUserId,
      invited_by: user.id,
    });
    if (error) return { ok: false, error: error.message };
    await fetchGoals();
    return { ok: true };
  };

  const removeMember = async (goalId: string, memberUserId: string) => {
    await supabase.from("goal_members").delete().eq("goal_id", goalId).eq("user_id", memberUserId);
    await fetchGoals();
  };

  const leaveGoal = async (goalId: string) => {
    if (!user) return;
    await supabase.from("goal_members").delete().eq("goal_id", goalId).eq("user_id", user.id);
    await fetchGoals();
  };

  return {
    goals, loading, refetch: fetchGoals,
    createGoal, updateGoal, deleteGoal, reorderGoals,
    addContribution, deleteContribution,
    inviteToGoal, inviteFriendToGoal, removeMember, leaveGoal,
  };
}
