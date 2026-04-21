"use client";

import { useState, useEffect } from "react";
import { X, Mail, Copy, Users, Check, Trash2, CheckCircle, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { GoalWithStats, GoalInvite, GoalMember } from "@/lib/types";

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
  onRemoveMember?: (goalId: string, userId: string) => Promise<void>;
}

export default function InviteGoalMembersModal({ isOpen, goal, onClose, onInvite, onRemoveMember }: InviteGoalMembersModalProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<GoalInvite[]>([]);
  const [memberEmails, setMemberEmails] = useState<Record<string, string>>({});
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "warn" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !goal) return;
    const fetchData = async () => {
      const { data: invites } = await supabase
        .from("goal_invites")
        .select("*")
        .eq("goal_id", goal.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      setPendingInvites((invites as GoalInvite[]) || []);
    };
    fetchData();
  }, [isOpen, goal, supabase]);

  if (!isOpen || !goal) return null;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const buildJoinUrl = (token: string) => `${baseUrl}/goals/join/${token}`;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setNotice(null);
    const result = await onInvite(goal.id, email.trim());
    setLoading(false);
    if (!result) {
      setNotice({ kind: "error", text: "Couldn't create the invite. Please try again." });
      return;
    }
    if (result.emailSent) {
      setNotice({ kind: "success", text: `Invite sent to ${email.trim()}.` });
    } else {
      // Invite row was created but email didn't send — show the copy-link path
      setNotice({
        kind: "warn",
        text: `Invite created, but email didn't send${result.reason ? ` (${result.reason})` : ""}. Copy the link below to share it.`,
      });
    }
    setEmail("");
    // Refresh pending list
    const { data: invites } = await supabase
      .from("goal_invites")
      .select("*")
      .eq("goal_id", goal.id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    setPendingInvites((invites as GoalInvite[]) || []);
  };

  const handleCopy = async (token: string) => {
    const url = buildJoinUrl(token);
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleRevoke = async (inviteId: string) => {
    await supabase.from("goal_invites").delete().eq("id", inviteId);
    setPendingInvites(pendingInvites.filter((i) => i.id !== inviteId));
  };

  const handleRemoveMember = async (m: GoalMember) => {
    if (!onRemoveMember) return;
    if (!confirm("Remove this member from the goal?")) return;
    await onRemoveMember(goal.id, m.user_id);
  };

  const inputClass = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl shadow-gray-900/10 border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Invite to Goal</h2>
            <p className="text-xs text-gray-400 truncate">{goal.name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={20} /></button>
        </div>

        <form onSubmit={handleInvite} className="p-5 space-y-3 border-b border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Mail size={14} className="text-gray-400" />
              Invite by email
            </span>
          </label>
          <div className="flex gap-2">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} placeholder="friend@example.com" />
            <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-lg transition-all hover:shadow-lg hover:shadow-blue-600/20 shrink-0">
              {loading ? "Sending..." : "Send invite"}
            </button>
          </div>
          {notice ? (
            <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
              notice.kind === "success" ? "bg-green-50 text-green-700 border border-green-100" :
              notice.kind === "warn" ? "bg-amber-50 text-amber-700 border border-amber-100" :
              "bg-red-50 text-red-700 border border-red-100"
            }`}>
              {notice.kind === "success" ? <CheckCircle size={13} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} className="mt-0.5 shrink-0" />}
              <span>{notice.text}</span>
            </div>
          ) : (
            <p className="text-xs text-gray-400">We&apos;ll email them a link from NetWorth. Replies go to your inbox ({user?.email}).</p>
          )}
        </form>

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <div className="p-5 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pending invites</h3>
            <div className="space-y-2">
              {pendingInvites.map((inv) => (
                <div key={inv.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50">
                  <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <Mail size={12} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{inv.email || "(no email)"}</p>
                    <p className="text-[10px] text-gray-400">Expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => handleCopy(inv.token)} className="text-xs text-blue-600 hover:text-blue-700 p-1.5 rounded" title="Copy link">
                    {copiedToken === inv.token ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                  <button onClick={() => handleRevoke(inv.id)} className="text-gray-300 hover:text-red-500 p-1.5 rounded" title="Revoke">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current members */}
        <div className="p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Users size={12} /> Members ({goal.members.length})
          </h3>
          <div className="space-y-2">
            {goal.members.map((m) => {
              const initial = (memberEmails[m.user_id] || m.user_id).charAt(0).toUpperCase();
              const isMe = user?.id === m.user_id;
              return (
                <div key={m.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-[11px] font-semibold text-blue-700">
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      {isMe ? "You" : (memberEmails[m.user_id] || m.user_id.slice(0, 8))}
                      {m.role === "owner" && <span className="ml-1.5 text-[10px] font-semibold text-amber-600">OWNER</span>}
                    </p>
                    <p className="text-[10px] text-gray-400">Joined {new Date(m.joined_at).toLocaleDateString()}</p>
                  </div>
                  {goal.isOwner && m.role !== "owner" && onRemoveMember && (
                    <button onClick={() => handleRemoveMember(m)} className="text-gray-300 hover:text-red-500 p-1.5 rounded" title="Remove">
                      <Trash2 size={13} />
                    </button>
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
