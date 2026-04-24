"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribe to realtime changes on any number of Supabase tables and call refetch() whenever a change happens.
 * This gives us live cross-tab/cross-page updates without manual refetch calls.
 */
export function useRealtimeRefetch(tables: string[], refetch: () => void) {
  useEffect(() => {
    const supabase = createClient();
    const channelName = `rt-${tables.join("-")}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase.channel(channelName);

    for (const table of tables) {
      channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        () => {
          refetch();
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(","), refetch]);
}
