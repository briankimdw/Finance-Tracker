"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  User as UserIcon, AtSign, Mail, AlertCircle, CheckCircle, Camera, Trash2,
  Palette, Save, Sparkles, ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";

const COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#06b6d4", "#84cc16",
  "#1f2937", "#f97316",
];

function Avatar({ name, url, size = 96, color }: { name: string; url?: string | null; size?: number; color?: string | null }) {
  const initial = name.charAt(0).toUpperCase();
  const palette = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#84cc16"];
  const bg = color || palette[(initial.charCodeAt(0) || 0) % palette.length];
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className="rounded-full object-cover ring-4 ring-white shadow-md"
        style={{ width: size, height: size }}
        onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
      />
    );
  }
  return (
    <div className="rounded-full flex items-center justify-center text-white font-semibold shadow-md ring-4 ring-white shrink-0"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.4 }}>
      {initial}
    </div>
  );
}

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { profile, loading, setUsername, updateProfile, uploadAvatar, removeAvatar } = useProfile();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    username: "",
    display_name: "",
    bio: "",
    color: "#3b82f6",
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setForm({
        username: profile.username ?? "",
        display_name: profile.display_name ?? "",
        bio: profile.bio ?? "",
        color: profile.color ?? "#3b82f6",
      });
      setDirty(false);
    }
  }, [profile]);

  if (!user) {
    return (
      <div className="text-center py-20">
        <UserIcon size={32} className="text-gray-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-gray-700">Sign in to manage your profile</p>
      </div>
    );
  }

  if (loading && !profile) {
    return <div className="text-center py-20 text-gray-400">Loading your profile…</div>;
  }

  const update = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
    setDirty(true);
    setNotice(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setNotice(null);

    // Username — only save if changed
    if (form.username !== (profile?.username ?? "")) {
      const res = await setUsername(form.username);
      if (!res.ok) {
        setSaving(false);
        setNotice({ kind: "error", text: res.error || "Couldn't save username" });
        return;
      }
    }

    const res = await updateProfile({
      display_name: form.display_name,
      bio: form.bio,
      color: form.color,
    });
    setSaving(false);
    if (res.ok) {
      setNotice({ kind: "success", text: "Profile saved." });
      setDirty(false);
      setTimeout(() => setNotice(null), 2500);
    } else {
      setNotice({ kind: "error", text: res.error || "Couldn't save" });
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice({ kind: "error", text: "Please pick an image file." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setNotice({ kind: "error", text: "Image must be under 5 MB." });
      return;
    }
    setUploading(true);
    setNotice(null);
    const res = await uploadAvatar(file);
    setUploading(false);
    if (res.ok) {
      setNotice({ kind: "success", text: "Avatar updated." });
      setTimeout(() => setNotice(null), 2500);
    } else {
      setNotice({ kind: "error", text: res.error || "Upload failed" });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRemoveAvatar = async () => {
    if (!confirm("Remove your avatar?")) return;
    await removeAvatar();
    setNotice({ kind: "success", text: "Avatar removed." });
    setTimeout(() => setNotice(null), 2500);
  };

  const displayNameForAvatar = form.display_name || form.username || user.email?.split("@")[0] || "?";
  const input = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/friends" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 w-fit">
          <ArrowLeft size={12} /> Friends
        </Link>
        <button onClick={signOut} className="text-xs text-gray-400 hover:text-red-600 font-medium">Sign out</button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Your profile</h1>
        <p className="text-gray-400 text-sm mt-0.5">How friends find you and what they see on shared trips & goals.</p>
      </div>

      {/* Avatar + preview hero */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative bg-white border border-gray-200 rounded-2xl p-6 shadow-sm overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-20 opacity-10" style={{ background: `linear-gradient(135deg, ${form.color}, ${form.color}aa)` }} />
        <div className="relative flex items-start gap-4">
          <div className="relative">
            <Avatar name={displayNameForAvatar} url={profile?.avatar_url} size={96} color={form.color} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-gray-900 hover:bg-gray-800 text-white rounded-full flex items-center justify-center shadow-lg disabled:opacity-50"
              title="Upload photo">
              {uploading ? <Sparkles size={14} className="animate-pulse" /> : <Camera size={14} />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h2 className="text-base font-bold text-gray-900 truncate">{form.display_name || user.email?.split("@")[0]}</h2>
            {form.username && <p className="text-xs text-gray-500">@{form.username}</p>}
            {form.bio && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{form.bio}</p>}
            {profile?.avatar_url && (
              <button onClick={handleRemoveAvatar} className="text-[11px] text-gray-400 hover:text-red-600 mt-2 flex items-center gap-1"><Trash2 size={10} /> Remove photo</button>
            )}
          </div>
        </div>
      </motion.div>

      {notice && (
        <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
          notice.kind === "success" ? "bg-green-50 text-green-700 border border-green-100" :
          "bg-red-50 text-red-700 border border-red-100"
        }`}>
          {notice.kind === "success" ? <CheckCircle size={13} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} className="mt-0.5 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Basic info */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Basic info</h3>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><AtSign size={11} /> Username</label>
          <input type="text" value={form.username} onChange={(e) => update("username", e.target.value.toLowerCase())} className={input}
            placeholder="yourname" maxLength={20} />
          <p className="text-[11px] text-gray-400 mt-1">3–20 chars, a–z, 0–9, and underscores. Unique.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><UserIcon size={11} /> Display name</label>
          <input type="text" value={form.display_name} onChange={(e) => update("display_name", e.target.value)} className={input}
            placeholder="Your name" maxLength={60} />
          <p className="text-[11px] text-gray-400 mt-1">Shown on invites and shared trips/goals.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><Sparkles size={11} /> Bio <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea value={form.bio} onChange={(e) => update("bio", e.target.value)} rows={2} maxLength={160}
            className={input + " resize-none"}
            placeholder="A short line about you…" />
          <p className="text-[11px] text-gray-400 mt-1">{form.bio.length}/160</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1"><Palette size={11} /> Accent color</label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => update("color", c)}
                className={`w-7 h-7 rounded-lg transition-all ${form.color === c ? "ring-2 ring-offset-1 ring-gray-900 scale-110" : "hover:scale-105"}`}
                style={{ background: c }} aria-label="Pick color" />
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">Used as the fallback color behind your initials when you don&apos;t have a photo.</p>
        </div>
      </div>

      {/* Account */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Account</h3>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
          <Mail size={16} className="text-gray-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-400 uppercase tracking-wider">Email</p>
            <p className="text-sm text-gray-900 truncate">{user.email}</p>
          </div>
          <span className="text-[11px] text-gray-400 uppercase">Read-only</span>
        </div>
      </div>

      {/* Save bar (sticky when dirty) */}
      {dirty && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="sticky bottom-4 z-10 bg-white border border-gray-200 shadow-lg rounded-xl p-3 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">You have unsaved changes.</p>
          <div className="flex items-center gap-2">
            <button onClick={() => {
              if (profile) {
                setForm({
                  username: profile.username ?? "",
                  display_name: profile.display_name ?? "",
                  bio: profile.bio ?? "",
                  color: profile.color ?? "#3b82f6",
                });
                setDirty(false);
                setNotice(null);
              }
            }} className="text-xs text-gray-500 hover:text-gray-700 font-medium px-3 py-2 rounded-md hover:bg-gray-50">Discard</button>
            <button onClick={handleSave} disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5">
              <Save size={13} /> {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
