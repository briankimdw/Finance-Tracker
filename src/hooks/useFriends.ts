"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeRefetch } from "@/lib/useRealtimeRefetch";
import type { Friend, FriendRequest, Profile } from "@/lib/types";

interface FriendRequestWithProfiles extends FriendRequest {
  from_profile: Profile | null;
  to_profile: Profile | null;
}

export function useFriends() {
  const { user } = useAuth();
  const supabase = createClient();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestWithProfiles[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestWithProfiles[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setFriends([]);
      setIncoming([]);
      setOutgoing([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Pull all requests involving me
    const { data: requests, error } = await supabase
      .from("friend_requests")
      .select("*")
      .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("[useFriends] requests error:", error);
      setLoading(false);
      return;
    }

    const reqs = (requests as FriendRequest[]) || [];
    // Collect the "other party" user IDs to look up profiles in one query
    const otherIds = new Set<string>();
    reqs.forEach((r) => otherIds.add(r.from_user === user.id ? r.to_user : r.from_user));
    reqs.forEach((r) => {
      otherIds.add(r.from_user);
      otherIds.add(r.to_user);
    });
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", Array.from(otherIds));
    const profileMap = new Map<string, Profile>();
    for (const p of (profiles as Profile[]) || []) profileMap.set(p.id, p);

    const enriched: FriendRequestWithProfiles[] = reqs.map((r) => ({
      ...r,
      from_profile: profileMap.get(r.from_user) ?? null,
      to_profile: profileMap.get(r.to_user) ?? null,
    }));

    const acceptedList: Friend[] = enriched
      .filter((r) => r.status === "accepted")
      .map((r) => {
        const iAmSender = r.from_user === user.id;
        const otherId = iAmSender ? r.to_user : r.from_user;
        return {
          requestId: r.id,
          userId: otherId,
          profile: iAmSender ? r.to_profile : r.from_profile,
          since: r.updated_at,
          direction: iAmSender ? "outgoing" : "incoming",
        };
      });
    const incomingList = enriched.filter((r) => r.status === "pending" && r.to_user === user.id);
    const outgoingList = enriched.filter((r) => r.status === "pending" && r.from_user === user.id);

    setFriends(acceptedList);
    setIncoming(incomingList);
    setOutgoing(outgoingList);
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  useRealtimeRefetch(["friend_requests", "profiles"], fetchAll);

  // Send a friend request by username or email
  const sendRequest = async (
    identifier: string
  ): Promise<{ ok: boolean; error?: string; info?: string }> => {
    if (!user) return { ok: false, error: "Sign in first" };
    const cleaned = identifier.trim();
    if (!cleaned) return { ok: false, error: "Enter a username or email" };

    // Look up target user via SECURITY DEFINER helper
    const { data: found, error: lookupErr } = await supabase.rpc("find_user_by_identifier", { p_identifier: cleaned });
    if (lookupErr) {
      console.error("[useFriends] lookup error:", lookupErr);
      return { ok: false, error: lookupErr.message };
    }
    const targetProfile = Array.isArray(found) && found.length > 0 ? (found[0] as Profile) : null;
    if (!targetProfile) return { ok: false, error: "No user with that username or email" };
    if (targetProfile.id === user.id) return { ok: false, error: "You can't add yourself" };

    // Check for any existing relationship in either direction
    const { data: existing } = await supabase
      .from("friend_requests")
      .select("*")
      .or(
        `and(from_user.eq.${user.id},to_user.eq.${targetProfile.id}),and(from_user.eq.${targetProfile.id},to_user.eq.${user.id})`
      )
      .maybeSingle();

    if (existing) {
      const row = existing as FriendRequest;
      if (row.status === "accepted") return { ok: false, info: "You're already friends" };
      if (row.status === "pending" && row.from_user === user.id) return { ok: false, info: "Request already sent" };
      if (row.status === "pending" && row.to_user === user.id) {
        // They already sent one — accept automatically
        const { error: upErr } = await supabase
          .from("friend_requests")
          .update({ status: "accepted", updated_at: new Date().toISOString() })
          .eq("id", row.id);
        if (upErr) return { ok: false, error: upErr.message };
        await fetchAll();
        return { ok: true, info: "They had already invited you — now you're friends!" };
      }
      // rejected — allow resending by updating
      const { error: resendErr } = await supabase
        .from("friend_requests")
        .update({ status: "pending", from_user: user.id, to_user: targetProfile.id, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (resendErr) return { ok: false, error: resendErr.message };
      await fetchAll();
      return { ok: true };
    }

    // Create new request
    const { error: insErr } = await supabase.from("friend_requests").insert({
      from_user: user.id,
      to_user: targetProfile.id,
      status: "pending",
    });
    if (insErr) return { ok: false, error: insErr.message };
    await fetchAll();
    return { ok: true };
  };

  const acceptRequest = async (requestId: string) => {
    const { error } = await supabase
      .from("friend_requests")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", requestId);
    if (error) console.error("[useFriends] accept error:", error);
    await fetchAll();
  };

  const rejectRequest = async (requestId: string) => {
    // Reject = delete (cleaner than keeping history)
    const { error } = await supabase.from("friend_requests").delete().eq("id", requestId);
    if (error) console.error("[useFriends] reject error:", error);
    await fetchAll();
  };

  const cancelRequest = async (requestId: string) => {
    const { error } = await supabase.from("friend_requests").delete().eq("id", requestId);
    if (error) console.error("[useFriends] cancel error:", error);
    await fetchAll();
  };

  const removeFriend = async (otherUserId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("friend_requests")
      .delete()
      .or(
        `and(from_user.eq.${user.id},to_user.eq.${otherUserId}),and(from_user.eq.${otherUserId},to_user.eq.${user.id})`
      );
    if (error) console.error("[useFriends] remove error:", error);
    await fetchAll();
  };

  return {
    friends,
    incoming,
    outgoing,
    loading,
    refetch: fetchAll,
    sendRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    removeFriend,
  };
}
