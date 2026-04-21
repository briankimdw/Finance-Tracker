"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeRefetch } from "@/lib/useRealtimeRefetch";
import type { Trip, Goal, Profile, TripInvite, GoalInvite } from "@/lib/types";

export interface PendingTripInvite {
  invite: TripInvite;
  trip: Trip | null;
  inviter: Profile | null;
}

export interface PendingGoalInvite {
  invite: GoalInvite;
  goal: Goal | null;
  inviter: Profile | null;
}

export function usePendingInvites() {
  const { user } = useAuth();
  const supabase = createClient();
  const [trips, setTrips] = useState<PendingTripInvite[]>([]);
  const [goals, setGoals] = useState<PendingGoalInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setTrips([]);
      setGoals([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const email = (user.email || "").toLowerCase();

    // Pull invites two ways:
    //  - friend-based: target_user_id = me
    //  - email-based: email matches (case-insensitive) AND target_user_id is null
    // Then dedupe by invite.id.
    const [tripsByUser, tripsByEmail, goalsByUser, goalsByEmail] = await Promise.all([
      supabase
        .from("trip_invites")
        .select("*")
        .eq("target_user_id", user.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
      email
        ? supabase
            .from("trip_invites")
            .select("*")
            .ilike("email", email)
            .is("target_user_id", null)
            .is("accepted_at", null)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase
        .from("goal_invites")
        .select("*")
        .eq("target_user_id", user.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
      email
        ? supabase
            .from("goal_invites")
            .select("*")
            .ilike("email", email)
            .is("target_user_id", null)
            .is("accepted_at", null)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    // Dedupe + drop any trips where the user is already a member
    const seenTripInvite = new Set<string>();
    const tripInvitesRaw = [
      ...((tripsByUser.data as TripInvite[]) || []),
      ...((tripsByEmail.data as TripInvite[]) || []),
    ].filter((i) => {
      if (seenTripInvite.has(i.id)) return false;
      seenTripInvite.add(i.id);
      return true;
    });
    const seenGoalInvite = new Set<string>();
    const goalInvitesRaw = [
      ...((goalsByUser.data as GoalInvite[]) || []),
      ...((goalsByEmail.data as GoalInvite[]) || []),
    ].filter((i) => {
      if (seenGoalInvite.has(i.id)) return false;
      seenGoalInvite.add(i.id);
      return true;
    });

    // Drop ones where user is already a member (auto-cleanup)
    const [existingTripMems, existingGoalMems] = await Promise.all([
      tripInvitesRaw.length > 0
        ? supabase
            .from("trip_members")
            .select("trip_id")
            .eq("user_id", user.id)
            .in("trip_id", tripInvitesRaw.map((i) => i.trip_id))
        : Promise.resolve({ data: [] }),
      goalInvitesRaw.length > 0
        ? supabase
            .from("goal_members")
            .select("goal_id")
            .eq("user_id", user.id)
            .in("goal_id", goalInvitesRaw.map((i) => i.goal_id))
        : Promise.resolve({ data: [] }),
    ]);
    const alreadyInTrip = new Set(((existingTripMems.data as { trip_id: string }[]) || []).map((r) => r.trip_id));
    const alreadyInGoal = new Set(((existingGoalMems.data as { goal_id: string }[]) || []).map((r) => r.goal_id));
    const tripInvites = tripInvitesRaw.filter((i) => !alreadyInTrip.has(i.trip_id));
    const goalInvites = goalInvitesRaw.filter((i) => !alreadyInGoal.has(i.goal_id));

    const tripIds = Array.from(new Set(tripInvites.map((i) => i.trip_id)));
    const goalIds = Array.from(new Set(goalInvites.map((i) => i.goal_id)));
    const inviterIds = Array.from(
      new Set(
        [...tripInvites, ...goalInvites]
          .map((i) => i.invited_by)
          .filter((id): id is string => !!id)
      )
    );

    const [tripsData, goalsData, profilesData] = await Promise.all([
      tripIds.length > 0 ? supabase.from("trips").select("*").in("id", tripIds) : Promise.resolve({ data: [] }),
      goalIds.length > 0 ? supabase.from("goals").select("*").in("id", goalIds) : Promise.resolve({ data: [] }),
      inviterIds.length > 0 ? supabase.from("profiles").select("*").in("id", inviterIds) : Promise.resolve({ data: [] }),
    ]);

    const tripMap = new Map<string, Trip>();
    for (const t of ((tripsData.data as Trip[]) || [])) tripMap.set(t.id, t);
    const goalMap = new Map<string, Goal>();
    for (const g of ((goalsData.data as Goal[]) || [])) goalMap.set(g.id, g);
    const profileMap = new Map<string, Profile>();
    for (const p of ((profilesData.data as Profile[]) || [])) profileMap.set(p.id, p);

    setTrips(
      tripInvites.map((i) => ({
        invite: i,
        trip: tripMap.get(i.trip_id) ?? null,
        inviter: i.invited_by ? profileMap.get(i.invited_by) ?? null : null,
      }))
    );
    setGoals(
      goalInvites.map((i) => ({
        invite: i,
        goal: goalMap.get(i.goal_id) ?? null,
        inviter: i.invited_by ? profileMap.get(i.invited_by) ?? null : null,
      }))
    );
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  useRealtimeRefetch(["trip_invites", "goal_invites", "trip_members", "goal_members"], fetchAll);

  const acceptTripInvite = async (invite: TripInvite) => {
    if (!user) return;
    // Insert membership
    await supabase.from("trip_members").insert({
      trip_id: invite.trip_id,
      user_id: user.id,
      role: "member",
    });
    // Mark invite accepted
    await supabase
      .from("trip_invites")
      .update({ accepted_by: user.id, accepted_at: new Date().toISOString() })
      .eq("id", invite.id);
    await fetchAll();
  };

  const declineTripInvite = async (invite: TripInvite) => {
    await supabase.from("trip_invites").delete().eq("id", invite.id);
    await fetchAll();
  };

  const acceptGoalInvite = async (invite: GoalInvite) => {
    if (!user) return;
    await supabase.from("goal_members").insert({
      goal_id: invite.goal_id,
      user_id: user.id,
      role: "member",
    });
    await supabase
      .from("goal_invites")
      .update({ accepted_by: user.id, accepted_at: new Date().toISOString() })
      .eq("id", invite.id);
    await fetchAll();
  };

  const declineGoalInvite = async (invite: GoalInvite) => {
    await supabase.from("goal_invites").delete().eq("id", invite.id);
    await fetchAll();
  };

  return {
    trips,
    goals,
    loading,
    refetch: fetchAll,
    acceptTripInvite,
    declineTripInvite,
    acceptGoalInvite,
    declineGoalInvite,
  };
}
