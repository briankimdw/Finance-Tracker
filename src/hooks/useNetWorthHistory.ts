"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeRefetch } from "@/lib/useRealtimeRefetch";
import { todayEST } from "@/lib/dates";
import type { NetWorthSnapshot } from "@/lib/types";

export function useNetWorthHistory(days: number = 90) {
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchSnapshots = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    const startDate = start.toISOString().split("T")[0];

    try {
      let query = supabase.from("net_worth_snapshots").select("*").gte("date", startDate).order("date", { ascending: true });
      if (user) query = query.eq("user_id", user.id);
      else query = query.is("user_id", null);
      const { data } = await query;
      setSnapshots((data as NetWorthSnapshot[]) || []);
    } catch {
      setSnapshots([]);
    }
    setLoading(false);
  }, [user, days, supabase]);

  useEffect(() => { fetchSnapshots(); }, [fetchSnapshots]);
  useRealtimeRefetch(["net_worth_snapshots"], fetchSnapshots);

  return { snapshots, loading, refetch: fetchSnapshots };
}

/**
 * Saves today's net worth snapshot (upserts by date).
 * Call this from the dashboard whenever stats change.
 */
export async function saveNetWorthSnapshot(
  userId: string | null,
  data: { cash: number; metals: number; inventory: number; owed_to_me: number; card_debt: number; i_owe: number; net_worth: number }
) {
  const supabase = createClient();
  const date = todayEST();

  // Check if snapshot for today already exists
  let query = supabase.from("net_worth_snapshots").select("id").eq("date", date);
  if (userId) query = query.eq("user_id", userId);
  else query = query.is("user_id", null);
  const { data: existing } = await query.maybeSingle();

  if (existing) {
    await supabase.from("net_worth_snapshots").update(data).eq("id", existing.id);
  } else {
    await supabase.from("net_worth_snapshots").insert({ user_id: userId, date, ...data });
  }
}
