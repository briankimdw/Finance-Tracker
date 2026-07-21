"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeRefetch } from "@/lib/useRealtimeRefetch";
import { hashActivityRows, type ParsedActivityRow } from "@/lib/predictions";
import type { PredictionActivity } from "@/lib/types";

export interface ImportSummary {
  imported: number;
  duplicates: number;
}

export function usePredictionActivities() {
  const { user } = useAuth();
  const supabase = createClient();
  const [activities, setActivities] = useState<PredictionActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from("prediction_activities").select("*").order("activity_date", { ascending: false }).limit(5000);
      if (user) q = q.eq("user_id", user.id);
      else q = q.is("user_id", null);
      const { data } = await q;
      setActivities((data as PredictionActivity[]) || []);
    } catch {
      setActivities([]);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);
  useRealtimeRefetch(["prediction_activities"], fetchActivities);

  /** Inserts parsed CSV rows, silently skipping anything already imported. */
  const importRows = async (rows: ParsedActivityRow[], sourceFile: string): Promise<ImportSummary> => {
    const userId = user?.id ?? null;
    const hashes = await hashActivityRows(rows);
    const payload = rows.map((r, i) => ({
      user_id: userId,
      ...r,
      source_file: sourceFile,
      dedupe_hash: hashes[i],
    }));

    let imported = 0;
    for (let i = 0; i < payload.length; i += 500) {
      const chunk = payload.slice(i, i + 500);
      const { data, error } = await supabase
        .from("prediction_activities")
        .upsert(chunk, { onConflict: "user_id,dedupe_hash", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(error.message);
      imported += (data || []).length;
    }
    await fetchActivities();
    return { imported, duplicates: rows.length - imported };
  };

  const clearAll = async () => {
    let q = supabase.from("prediction_activities").delete();
    if (user) q = q.eq("user_id", user.id);
    else q = q.is("user_id", null);
    await q;
    await fetchActivities();
  };

  return { activities, loading, refetch: fetchActivities, importRows, clearAll };
}
