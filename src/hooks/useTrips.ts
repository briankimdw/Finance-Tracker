"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeRefetch } from "@/lib/useRealtimeRefetch";
import type {
  Trip,
  TripItem,
  TripItemSplit,
  TripMember,
  TripWithStats,
  TripItemCategory,
  TripItemStatus,
  TripStatus,
  TripMemberBalance,
  TripSettlementEntry,
  SplitInput,
} from "@/lib/types";

/**
 * Given a total amount and participating user_ids, return equal shares
 * in integer cents, distributing rounding remainder to earlier participants.
 */
export function equalSplit(total: number, userIds: string[]): SplitInput[] {
  if (userIds.length === 0) return [];
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / userIds.length);
  const rem = totalCents - base * userIds.length;
  return userIds.map((uid, i) => ({
    user_id: uid,
    amount: (base + (i < rem ? 1 : 0)) / 100,
  }));
}

function daysBetween(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(dateStr + "T12:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Compute per-member balances + minimal settlement list from done items.
 * Uses per-item splits when present (custom or partial), falls back to
 * equal-split across all current members for any item missing splits
 * (e.g. legacy data).
 */
function computeSettlement(members: TripMember[], items: TripItem[]): { balances: TripMemberBalance[]; settlements: TripSettlementEntry[] } {
  if (members.length === 0) return { balances: [], settlements: [] };

  const memberIds = members.map((m) => m.user_id);
  const doneItems = items.filter((i) => i.status === "done");

  // paid per user
  const paidMap = new Map<string, number>();
  for (const uid of memberIds) paidMap.set(uid, 0);
  for (const it of doneItems) {
    const payer = it.paid_by || it.user_id || "";
    if (paidMap.has(payer)) {
      paidMap.set(payer, (paidMap.get(payer) || 0) + Number(it.actual_amount));
    }
  }

  // owed per user (from splits; fallback to equal among all members)
  const owedMap = new Map<string, number>();
  for (const uid of memberIds) owedMap.set(uid, 0);
  for (const it of doneItems) {
    const splits = it.splits || [];
    if (splits.length > 0) {
      for (const s of splits) {
        if (owedMap.has(s.user_id)) {
          owedMap.set(s.user_id, (owedMap.get(s.user_id) || 0) + Number(s.amount));
        }
      }
    } else {
      // Fallback: equal split among all current members
      const shares = equalSplit(Number(it.actual_amount), memberIds);
      for (const s of shares) {
        owedMap.set(s.user_id, (owedMap.get(s.user_id) || 0) + s.amount);
      }
    }
  }

  const balances: TripMemberBalance[] = memberIds.map((uid) => {
    const paid = Math.round((paidMap.get(uid) || 0) * 100) / 100;
    const share = Math.round((owedMap.get(uid) || 0) * 100) / 100;
    return { userId: uid, paid, share, balance: Math.round((paid - share) * 100) / 100 };
  });

  // Greedy settlement: repeatedly match the most-owed creditor to the most-indebted debtor
  const creditors = balances.filter((b) => b.balance > 0.01).map((b) => ({ ...b }));
  const debtors = balances.filter((b) => b.balance < -0.01).map((b) => ({ ...b }));
  const settlements: TripSettlementEntry[] = [];
  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort((a, b) => b.balance - a.balance);
    debtors.sort((a, b) => a.balance - b.balance);
    const c = creditors[0];
    const d = debtors[0];
    const amount = Math.round(Math.min(c.balance, -d.balance) * 100) / 100;
    if (amount <= 0) break;
    settlements.push({ fromUserId: d.userId, toUserId: c.userId, amount });
    c.balance = Math.round((c.balance - amount) * 100) / 100;
    d.balance = Math.round((d.balance + amount) * 100) / 100;
    if (Math.abs(c.balance) < 0.01) creditors.shift();
    if (Math.abs(d.balance) < 0.01) debtors.shift();
  }

  return { balances, settlements };
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
        .select("*, trip_members(id, trip_id, user_id, role, joined_at)")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      let itemsQ = supabase
        .from("trip_items")
        .select("*, trip_item_splits(id, trip_item_id, user_id, amount, created_at)")
        .order("item_date", { ascending: true, nullsFirst: false })
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (!user) {
        tripsQ = tripsQ.is("user_id", null);
        itemsQ = itemsQ.is("user_id", null);
      }

      const [tripsRes, itemsRes] = await Promise.all([tripsQ, itemsQ]);
      if (tripsRes.error) console.error("[useTrips] trips error:", tripsRes.error);
      if (itemsRes.error) console.error("[useTrips] items error:", itemsRes.error);

      const rawTrips = (tripsRes.data || []) as (Trip & { trip_members: TripMember[] })[];
      const rawItems = ((itemsRes.data || []) as (TripItem & { trip_item_splits: TripItemSplit[] })[]).map(
        (i) => ({ ...i, splits: i.trip_item_splits || [] })
      );

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
        const members = t.trip_members || [];
        const myMember = user ? members.find((m) => m.user_id === user.id) : null;
        const isOwner = user ? (t.user_id === user.id || myMember?.role === "owner") : false;
        const { balances, settlements } = computeSettlement(members, items);
        return {
          ...t,
          items,
          members,
          isOwner,
          myRole: myMember?.role ?? null,
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
          balances,
          settlements,
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
  useRealtimeRefetch(
    ["trips", "trip_items", "trip_item_splits", "trip_members", "trip_invites"],
    fetchTrips
  );

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
    goal_id?: string | null;
    is_shared?: boolean;
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
        goal_id: data.goal_id || null,
        is_shared: !!data.is_shared && !!user,
        display_order: maxOrder + 1,
      })
      .select()
      .single();
    if (error) console.error("[useTrips] createTrip error:", error);

    // Add creator as owner member row
    if (!error && inserted && user) {
      await supabase.from("trip_members").insert({
        trip_id: inserted.id,
        user_id: user.id,
        role: "owner",
      });
    }
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
      end_date?: string | null;
      start_time?: string | null;
      end_time?: string | null;
      location?: string | null;
      confirmation_code?: string | null;
      status?: TripItemStatus;
      notes?: string;
      url?: string;
      paid_by?: string | null;
      splits?: SplitInput[];   // if omitted and done+shared, we auto-generate equal splits
    }
  ) => {
    const trip = trips.find((t) => t.id === tripId);
    const tripItems = trip?.items ?? [];
    const maxOrder = tripItems.length > 0 ? Math.max(...tripItems.map((i) => i.display_order)) : 0;
    const actual = data.actual_amount ?? 0;
    const { data: inserted, error } = await supabase
      .from("trip_items")
      .insert({
        trip_id: tripId,
        user_id: user?.id ?? null,
        paid_by: data.paid_by ?? user?.id ?? null,
        name: data.name,
        category: data.category || "activity",
        planned_amount: data.planned_amount,
        actual_amount: actual,
        item_date: data.item_date || null,
        end_date: data.end_date || null,
        start_time: data.start_time || null,
        end_time: data.end_time || null,
        location: data.location || null,
        confirmation_code: data.confirmation_code || null,
        status: data.status || "planned",
        notes: data.notes || null,
        url: data.url || null,
        display_order: maxOrder + 1,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[useTrips] addItem error:", error);
      await fetchTrips();
      return;
    }

    // Write splits if it's a done shared-trip item
    if (inserted && data.status === "done" && actual > 0) {
      let splits = data.splits;
      if (!splits && trip && trip.members.length > 0) {
        // Default: equal split among all members
        const memberIds = trip.members.map((m) => m.user_id);
        splits = equalSplit(actual, memberIds);
      }
      if (splits && splits.length > 0) {
        await supabase.from("trip_item_splits").insert(
          splits.map((s) => ({ trip_item_id: inserted.id, user_id: s.user_id, amount: s.amount }))
        );
      }
    }
    await fetchTrips();
  };

  /**
   * Fast path for a one-click purchase: creates a done item with the given
   * amount, default category food, paid_by = current user (or override).
   * Used for "I just bought X" on the fly.
   */
  const quickLogPurchase = async (
    tripId: string,
    data: { name: string; amount: number; category?: TripItemCategory; paid_by?: string; notes?: string; splits?: SplitInput[] }
  ) => {
    await addItem(tripId, {
      name: data.name,
      category: data.category || "other",
      planned_amount: data.amount,
      actual_amount: data.amount,
      status: "done",
      paid_by: data.paid_by ?? user?.id,
      notes: data.notes,
      splits: data.splits,
    });
  };

  const updateItem = async (id: string, data: Partial<TripItem> & { splits?: SplitInput[] }) => {
    const { splits, ...itemData } = data;
    // splits isn't a column on trip_items, so strip it; ditto 'splits' field from our TripItem type
    const { splits: _strip, ...safe } = itemData as typeof itemData & { splits?: unknown };
    void _strip;
    const { error } = await supabase.from("trip_items").update(safe).eq("id", id);
    if (error) console.error("[useTrips] updateItem error:", error);

    // If caller passed new splits, replace existing
    if (splits) {
      await supabase.from("trip_item_splits").delete().eq("trip_item_id", id);
      if (splits.length > 0) {
        await supabase.from("trip_item_splits").insert(
          splits.map((s) => ({ trip_item_id: id, user_id: s.user_id, amount: s.amount }))
        );
      }
    }
    await fetchTrips();
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("trip_items").delete().eq("id", id);
    if (error) console.error("[useTrips] deleteItem error:", error);
    await fetchTrips();
  };

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

  // ---------- Members / invites ----------
  const inviteToTrip = async (
    tripId: string,
    email: string
  ): Promise<{ token: string; joinUrl: string; emailSent: boolean; reason?: string } | null> => {
    try {
      const res = await fetch("/api/trips/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, email }),
      });
      const body = await res.json();
      if (!res.ok) {
        console.error("[useTrips] inviteToTrip error:", body.error);
        return null;
      }
      return body;
    } catch (err) {
      console.error("[useTrips] inviteToTrip threw:", err);
      return null;
    }
  };

  /**
   * Invite a known friend (by user_id) to a trip. No email is sent —
   * they'll see the pending invite on their Friends page and accept it.
   */
  const inviteFriendToTrip = async (
    tripId: string,
    friendUserId: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: "Sign in first" };
    // Mark trip shared so the UI reflects it
    await supabase.from("trips").update({ is_shared: true }).eq("id", tripId);
    // Check no pending invite already exists for this friend on this trip
    const { data: existing } = await supabase
      .from("trip_invites")
      .select("*")
      .eq("trip_id", tripId)
      .eq("target_user_id", friendUserId)
      .is("accepted_at", null)
      .maybeSingle();
    if (existing) return { ok: false, error: "Invite already pending" };

    // Generate token (still required by schema, even though friend flow doesn't use it)
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    for (let i = 0; i < 20; i++) token += chars[Math.floor(Math.random() * chars.length)];

    const { error } = await supabase.from("trip_invites").insert({
      trip_id: tripId,
      token,
      target_user_id: friendUserId,
      invited_by: user.id,
    });
    if (error) return { ok: false, error: error.message };
    await fetchTrips();
    return { ok: true };
  };

  const removeTripMember = async (tripId: string, memberUserId: string) => {
    await supabase.from("trip_members").delete().eq("trip_id", tripId).eq("user_id", memberUserId);
    await fetchTrips();
  };

  const leaveTrip = async (tripId: string) => {
    if (!user) return;
    await supabase.from("trip_members").delete().eq("trip_id", tripId).eq("user_id", user.id);
    await fetchTrips();
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
    quickLogPurchase,
    inviteToTrip,
    inviteFriendToTrip,
    removeTripMember,
    leaveTrip,
  };
}
