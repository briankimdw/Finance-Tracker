"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeRefetch } from "@/lib/useRealtimeRefetch";
import type {
  Trip,
  TripItem,
  TripWithStats,
  TripItemCategory,
  TripItemStatus,
  TripStatus,
} from "@/lib/types";

function daysBetween(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(dateStr + "T12:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

export function useTrips() {
  const { user } = useAuth();
  const supabase = createClient();
  const [trips, setTrips] = useState<TripWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try {
      let tripsQ = supabase
        .from("trips")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      let itemsQ = supabase
        .from("trip_items")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (!user) {
        tripsQ = tripsQ.is("user_id", null);
        itemsQ = itemsQ.is("user_id", null);
      }

      const [tripsRes, itemsRes] = await Promise.all([tripsQ, itemsQ]);
      if (tripsRes.error) console.error("[useTrips] trips error:", tripsRes.error);
      if (itemsRes.error) console.error("[useTrips] items error:", itemsRes.error);

      const rawTrips = (tripsRes.data || []) as Trip[];
      const rawItems = (itemsRes.data || []) as TripItem[];

      const enriched: TripWithStats[] = rawTrips.map((t) => {
        const items = rawItems.filter((i) => i.trip_id === t.id);
        const totalPlanned = items.reduce((s, i) => s + Number(i.planned_amount), 0);
        const totalActual = items
          .filter((i) => i.status === "done")
          .reduce((s, i) => s + Number(i.actual_amount), 0);
        const plannedUpcoming = items
          .filter((i) => i.status === "planned")
          .reduce((s, i) => s + Number(i.planned_amount), 0);
        const skippedSavings = items
          .filter((i) => i.status === "skipped")
          .reduce((s, i) => s + Number(i.planned_amount), 0);
        const budget = Number(t.total_budget);
        const available = budget - totalActual;
        const remaining = budget - totalActual - plannedUpcoming;
        const progress = budget > 0 ? Math.min(100, (totalActual / budget) * 100) : 0;
        const overBudget = totalActual + plannedUpcoming > budget && budget > 0;
        return {
          ...t,
          items,
          totalPlanned,
          totalActual,
          plannedUpcoming,
          skippedSavings,
          remaining,
          available,
          progress,
          overBudget,
          daysUntilStart: daysBetween(t.start_date),
          daysUntilEnd: daysBetween(t.end_date),
        };
      });

      setTrips(enriched);
    } catch (err) {
      console.error("[useTrips] fetch threw:", err);
      setTrips([]);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);
  useRealtimeRefetch(["trips", "trip_items"], fetchTrips);

  // ---------- Trip CRUD ----------
  const createTrip = async (data: {
    name: string;
    destination?: string;
    start_date?: string | null;
    end_date?: string | null;
    total_budget: number;
    color?: string;
    icon?: string;
    notes?: string;
    image_url?: string;
    status?: TripStatus;
  }) => {
    const maxOrder = trips.length > 0 ? Math.max(...trips.map((t) => t.display_order)) : 0;
    const { data: inserted, error } = await supabase
      .from("trips")
      .insert({
        user_id: user?.id ?? null,
        name: data.name,
        destination: data.destination || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        total_budget: data.total_budget,
        color: data.color || "#3b82f6",
        icon: data.icon || "Plane",
        notes: data.notes || null,
        image_url: data.image_url || null,
        status: data.status || "planning",
        display_order: maxOrder + 1,
      })
      .select()
      .single();
    if (error) console.error("[useTrips] createTrip error:", error);
    await fetchTrips();
    return inserted as Trip | null;
  };

  const updateTrip = async (id: string, data: Partial<Trip>) => {
    const { error } = await supabase.from("trips").update(data).eq("id", id);
    if (error) console.error("[useTrips] updateTrip error:", error);
    await fetchTrips();
  };

  const deleteTrip = async (id: string) => {
    const { error } = await supabase.from("trips").delete().eq("id", id);
    if (error) console.error("[useTrips] deleteTrip error:", error);
    await fetchTrips();
  };

  const reorderTrips = async (newOrder: TripWithStats[]) => {
    setTrips(newOrder.map((t, i) => ({ ...t, display_order: i })));
    await Promise.all(
      newOrder.map((t, i) => supabase.from("trips").update({ display_order: i }).eq("id", t.id))
    );
  };

  // ---------- Trip item CRUD ----------
  const addItem = async (
    tripId: string,
    data: {
      name: string;
      category?: TripItemCategory;
      planned_amount: number;
      actual_amount?: number;
      item_date?: string | null;
      status?: TripItemStatus;
      notes?: string;
      url?: string;
    }
  ) => {
    const tripItems = trips.find((t) => t.id === tripId)?.items ?? [];
    const maxOrder = tripItems.length > 0 ? Math.max(...tripItems.map((i) => i.display_order)) : 0;
    const { error } = await supabase.from("trip_items").insert({
      trip_id: tripId,
      user_id: user?.id ?? null,
      name: data.name,
      category: data.category || "activity",
      planned_amount: data.planned_amount,
      actual_amount: data.actual_amount ?? 0,
      item_date: data.item_date || null,
      status: data.status || "planned",
      notes: data.notes || null,
      url: data.url || null,
      display_order: maxOrder + 1,
    });
    if (error) console.error("[useTrips] addItem error:", error);
    await fetchTrips();
  };

  const updateItem = async (id: string, data: Partial<TripItem>) => {
    const { error } = await supabase.from("trip_items").update(data).eq("id", id);
    if (error) console.error("[useTrips] updateItem error:", error);
    await fetchTrips();
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("trip_items").delete().eq("id", id);
    if (error) console.error("[useTrips] deleteItem error:", error);
    await fetchTrips();
  };

  // Convenience: mark done with actual amount (or default to planned if not given)
  const markItemDone = async (item: TripItem, actual?: number) => {
    await updateItem(item.id, {
      status: "done",
      actual_amount: actual ?? Number(item.planned_amount),
    });
  };

  const markItemSkipped = async (id: string) => {
    await updateItem(id, { status: "skipped", actual_amount: 0 });
  };

  const markItemPlanned = async (id: string) => {
    await updateItem(id, { status: "planned", actual_amount: 0 });
  };

  const reorderItems = async (tripId: string, newOrder: TripItem[]) => {
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId
          ? { ...t, items: newOrder.map((i, idx) => ({ ...i, display_order: idx })) }
          : t
      )
    );
    await Promise.all(
      newOrder.map((i, idx) =>
        supabase.from("trip_items").update({ display_order: idx }).eq("id", i.id)
      )
    );
  };

  return {
    trips,
    loading,
    refetch: fetchTrips,
    createTrip,
    updateTrip,
    deleteTrip,
    reorderTrips,
    addItem,
    updateItem,
    deleteItem,
    markItemDone,
    markItemSkipped,
    markItemPlanned,
    reorderItems,
  };
}
