"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { Profile } from "@/lib/types";

export function useProfile() {
  const { user } = useAuth();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) console.error("[useProfile] fetch error:", error);
    setProfile((data as Profile | null) ?? null);
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const setUsername = async (
    username: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: "Not signed in" };
    const cleaned = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(cleaned)) {
      return { ok: false, error: "Username must be 3–20 chars, a–z, 0–9, or _ only" };
    }
    // Check uniqueness (case-insensitive via index). Try to upsert; catch unique violation.
    const { error } = await supabase
      .from("profiles")
      .update({ username: cleaned, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) {
      // 23505 = unique violation
      if ((error as unknown as { code?: string }).code === "23505" || /duplicate key/i.test(error.message)) {
        return { ok: false, error: "Username is taken" };
      }
      return { ok: false, error: error.message };
    }
    await fetchProfile();
    return { ok: true };
  };

  const updateDisplayName = async (display_name: string) => {
    if (!user) return;
    await supabase.from("profiles").update({ display_name, updated_at: new Date().toISOString() }).eq("id", user.id);
    await fetchProfile();
  };

  const updateProfile = async (
    data: Partial<Pick<Profile, "display_name" | "bio" | "avatar_url" | "color">>
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: "Not signed in" };
    const { error } = await supabase
      .from("profiles")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) return { ok: false, error: error.message };
    await fetchProfile();
    return { ok: true };
  };

  /**
   * Upload an avatar image to Supabase Storage (bucket: avatars) under the
   * user's own folder, make it public, and write the URL back to profile.
   */
  const uploadAvatar = async (file: File): Promise<{ ok: boolean; error?: string; url?: string }> => {
    if (!user) return { ok: false, error: "Not signed in" };
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || undefined,
    });
    if (upErr) return { ok: false, error: upErr.message };
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) return { ok: false, error: "Couldn't get public URL" };
    // Add cache-buster so the UI picks up immediately
    const busted = `${publicUrl}?t=${Date.now()}`;
    const { error: updErr } = await supabase.from("profiles").update({ avatar_url: busted, updated_at: new Date().toISOString() }).eq("id", user.id);
    if (updErr) return { ok: false, error: updErr.message };
    await fetchProfile();
    return { ok: true, url: busted };
  };

  const removeAvatar = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ avatar_url: null, updated_at: new Date().toISOString() }).eq("id", user.id);
    await fetchProfile();
  };

  return { profile, loading, refetch: fetchProfile, setUsername, updateDisplayName, updateProfile, uploadAvatar, removeAvatar };
}
