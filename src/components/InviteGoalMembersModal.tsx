"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Mail, Copy, Users, Check, Trash2, CheckCircle, AlertCircle, UserPlus, Sparkles, Search, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useFriends } from "@/hooks/useFriends";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import type { GoalWithStats, GoalInvite, GoalMember, Profile } from "@/lib/types";

interface InviteResult {
  token: string;
  joinUrl: string;
  emailSent: boolean;
  reason?: string;
}

interface InviteGoalMembersModalProps {
  isOpen: boolean;
  goal: GoalWithStats | null;
  onClose: () => void;
  onInvite: (goalId: string, email: string) => Promise<InviteResult | null>;
  onInviteFriend?: (goalId: string, friendUserId: string) => Promise<{ ok: boolean; error?: string }>;
  onRemoveMember?: (goalId: string, userId: string) => Promise<void>;
}

export default function InviteGoalMembersModal({ isOpen, goal, onClose, onInvite, onInviteFriend, onRemoveMember }: InviteGoalMembersModalProps) {
  const { user } = useAuth();
  const { friends } = useFriends();
  const { success, info, error: toastError } = useToast();
  const confirm = useConfirm();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<GoalInvite[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, Profile>>({});
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "warn" | "error"; text: string } | null>(null);
  const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null);
  const [friendQuery, setFriendQuery] = useState("");

  useEffect(() => {
    if (!isOpen || !goal) return;
    (async () => {
      const { data: invites } = await supabase
        .from("goal_invites")
        .select("*")
        .eq("goal_id", goal.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      setPendingInvites((invites as GoalInvite[]) || []);

      const memberIds = goal.members.map((m) => m.user_id);
      if (memberIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("*").in("id", memberIds);
        const map: Record<string, Profile> = {};
        for (const p of (profs as Profile[]) || []) map[p.id] = p;
        setMemberProfiles(map);
      } else {
        setMemberProfiles({});
      }
    })();
  }, [isOpen, goal, supabase]);

  if (!isOpen || !goal) return null;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const buildJoinUrl = (token: string) => `${baseUrl}/goals/join/${token}`;

  const refreshPending = async () => {
    const { data } = await supabase
      .from("goal_invites")
      .select("*")
      .eq("goal_id", goal.id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    setPendingInvites((data as GoalInvite[]) || []);
  };

  const handleInviteFriend = async (friendUserId: string) => {
    if (!onInviteFriend) return;
    setInvitingFriendId(friendUserId);
    setNotice(null);
    const res = await onInviteFriend(goal.id, friendUserId);
    setInvitingFriendId(null);
    if (res.ok) {
      setNotice({ kind: "success", text: "Invite sent — they'll see it on their Friends page." });
      success("Invite sent");
    } else {
      setNotice({ kind: "warn", text: res.error || "Couldn't send invite." });
      toastError(res.error || "Couldn't send invite");
    }
    const { data } = await supabase
      .from("goal_invites")
      .select("*")
      .eq("goal_id", goal.id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    setPendingInvites((data as GoalInvite[]) || []);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setNotice(null);
    const result = await onInvite(goal.id, email.trim());
    setLoading(false);
    if (!result) {
      setNotice({ kind: "error", text: "Couldn't create the invite. Please try again." });
      toastError("Couldn't create invite");
      return;
    }
    if (result.emailSent) {
      setNotice({ kind: "success", text: `Invite sent to ${email.trim()}.` });
      success("Invite sent");
    } else {
      const reason = result.reason || "";
      let friendly = reason;
      if (/only send testing emails|own email|verify a domain/i.test(reason)) {
        friendly = "Resend's default sender only emails your own address. Verify a domain at resend.com/domains. For now, use the Copy link button below.";
      } else if (/API key/i.test(reason) || reason === "RESEND_API_KEY not configured") {
        friendly = "Email service isn't configured. Add RESEND_API_KEY in Vercel → Settings → Environment Variables.";
      }
      setNotice({ kind: "warn", text: `Email didn't send. ${friendly} Your invite link is ready below — just hit Copy.` });
    }
    setEmail("");
    await refreshPending();
  };

  const handleCopy = async (token: string) => {
    await navigator.clipboard.writeText(buildJoinUrl(token));
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleRevoke = async (inviteId: string) => {
    await supabase.from("goal_invites").delete().eq("id", inviteId);
    setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
  };

  const handleRemoveMember = async (m: GoalMember) => {
    if (!onRemoveMember) return;
    const ok = await confirm({
      title: "Remove this member from the goal?",
      destructive: true,
      confirmLabel: "Remove",
    });
    if (!ok) return;
    try {
      await onRemoveMember(goal.id, m.user_id);
      info("Member removed");
    } catch {
      toastError("Couldn't remove member");
    }
  };

  const inputClass = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm";

  const memberIds = new Set(goal.members.map((m) => m.user_id));
  const pendingUserIds = new Set(pendingInvites.map((p) => p.target_user_id).filter((id): id is string => !!id));
  const pendingEmails = new Set(pendingInvites.map((p) => (p.email || "").toLowerCase()));
  const q = friendQuery.trim().toLowerCase();
  const invitableFriends = friends
    .filter((f) => !memberIds.has(f.userId))
    .filter((f) => {
      if (!q) return true;
      const name = (f.profile?.display_name || "").toLowerCase();
      const username = (f.profile?.username || "").toLowerCase();
      const email = (f.profile?.email || "").toLowerCase();
      return name.includes(q) || username.includes(q) || email.includes(q);
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl shadow-gray-900/10 border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Invite to Goal</h2>
            <p className="text-xs text-gray-400 truncate">{goal.name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={20} /></button>
        </div>

        {/* Friends lookup + invite */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><Users size={12} /> Invite a friend</h3>
            <Link href="/friends" className="text-[11px] text-blue-600 hover:text-blue-700 font-medium">Manage →</Link>
          </div>
          {friends.length === 0 ? (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Sparkles size={14} className="text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-blue-900">No friends yet</p>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    <Link href="/friends" className="underline font-medium">Add friends</Link> by username or email. Then invite them here.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="relative mb-2">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={friendQuery} onChange={(e) => setFriendQuery(e.target.value)}
                  placeholder="Search friends…"
                  className="w-full bg-white border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-xs" />
              </div>
              {invitableFriends.length === 0 ? (
                <p className="text-xs text-gray-400">{q ? "No friends match." : "All your friends are already on this goal."}</p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {invitableFriends.map((f) => {
                    const initial = (f.profile?.display_name || f.profile?.username || "?").charAt(0).toUpperCase();
                    const pendingByEmail = f.profile?.email ? pendingEmails.has(f.profile.email.toLowerCase()) : false;
                    const pendingByFriend = pendingUserIds.has(f.userId);
                    const isPending = pendingByEmail || pendingByFriend;
                    return (
                      <div key={f.userId} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-xs font-semibold text-blue-700">{initial}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{f.profile?.display_name || f.profile?.username || "Friend"}</p>
                          <p className="text-[11px] text-gray-400 truncate">{f.profile?.username ? <>@{f.profile.username}</> : f.profile?.email}</p>
                        </div>
                        {isPending ? (
                          <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-1 px-2 py-1"><Clock size={10} /> PENDING</span>
                        ) : (
                          <button onClick={() => handleInviteFriend(f.userId)} disabled={invitingFriendId === f.userId}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-md flex items-center gap-1">
                            <UserPlus size={11} /> Invite
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-gray-400 mt-2">They&apos;ll see an invite on their Friends page and have to accept it to join.</p>
            </>
          )}
        </div>

        <form onSubmit={handleInvite} className="p-5 space-y-3 border-b border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <span className="flex items-center gap-1.5"><Mail size={14} className="text-gray-400" /> Or invite by email</span>
          </label>
          <div className="flex gap-2">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} placeholder="friend@example.com" />
            <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-lg shrink-0 transition-all hover:shadow-lg hover:shadow-blue-600/20">
              {loading ? "Sending..." : "Send"}
            </button>
          </div>
          {notice && (
            <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
              notice.kind === "success" ? "bg-green-50 text-green-700 border border-green-100" :
              notice.kind === "warn" ? "bg-amber-50 text-amber-700 border border-amber-100" :
              "bg-red-50 text-red-700 border border-red-100"
            }`}>
              {notice.kind === "success" ? <CheckCircle size={13} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} className="mt-0.5 shrink-0" />}
              <span>{notice.text}</span>
            </div>
          )}
          <p className="text-[11px] text-gray-400">For people who aren&apos;t your friends yet or don&apos;t have an account.</p>
        </form>

        {pendingInvites.length > 0 && (
          <div className="p-5 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pending email invites</h3>
            <div className="space-y-2">
              {pendingInvites.map((inv) => (
                <div key={inv.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50">
                  <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0"><Mail size={12} className="text-amber-600" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{inv.email || "(no email)"}</p>
                    <p className="text-[10px] text-gray-400">Expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => handleCopy(inv.token)} className="text-xs text-blue-600 hover:text-blue-700 p-1.5 rounded" title="Copy link">
                    {copiedToken === inv.token ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                  <button onClick={() => handleRevoke(inv.id)} className="text-gray-300 hover:text-red-500 p-1.5 rounded" title="Revoke"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Users size={12} /> Members ({goal.members.length})
          </h3>
          <div className="space-y-2">
            {goal.members.map((m) => {
              const p = memberProfiles[m.user_id];
              const displayName = p?.display_name || p?.username || (user?.id === m.user_id ? "You" : m.user_id.slice(0, 8));
              const initial = displayName.charAt(0).toUpperCase();
              const isMe = user?.id === m.user_id;
              return (
                <div key={m.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-[11px] font-semibold text-blue-700">{initial}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      {isMe ? "You" : displayName}
                      {m.role === "owner" && <span className="ml-1.5 text-[10px] font-semibold text-amber-600">OWNER</span>}
                    </p>
                    <p className="text-[10px] text-gray-400">{p?.username ? <>@{p.username} · </> : ""}Joined {new Date(m.joined_at).toLocaleDateString()}</p>
                  </div>
                  {goal.isOwner && m.role !== "owner" && onRemoveMember && (
                    <button onClick={() => handleRemoveMember(m)} className="text-gray-300 hover:text-red-500 p-1.5 rounded" title="Remove"><Trash2 size={13} /></button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
