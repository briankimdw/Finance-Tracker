"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Users, Target, CheckCircle, AlertCircle, LogIn, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { getGoalIcon } from "@/lib/goalIcons";
import type { Goal, GoalInvite } from "@/lib/types";

type Status = "loading" | "ready" | "expired" | "not-found" | "already-member" | "need-login" | "accepting" | "accepted" | "error";

export default function JoinGoalPage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params?.token === "string" ? params.token : "";
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const [invite, setInvite] = useState<GoalInvite | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [saved, setSaved] = useState<number>(0);

  const supabase = createClient();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setStatus("need-login");
      return;
    }

    const load = async () => {
      // Fetch invite
      const { data: inv, error: invErr } = await supabase
        .from("goal_invites")
        .select("*")
        .eq("token", token)
        .maybeSingle();
      if (invErr || !inv) {
        setStatus("not-found");
        return;
      }
      setInvite(inv as GoalInvite);

      // Check expired
      if (new Date(inv.expires_at).getTime() < Date.now()) {
        setStatus("expired");
        return;
      }
      if (inv.accepted_at) {
        // Already accepted — check if current user is a member
        const { data: existing } = await supabase
          .from("goal_members")
          .select("id")
          .eq("goal_id", inv.goal_id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (existing) {
          setStatus("already-member");
          return;
        }
      }

      // Fetch goal preview
      const { data: g } = await supabase.from("goals").select("*").eq("id", inv.goal_id).maybeSingle();
      if (!g) {
        setStatus("not-found");
        return;
      }
      setGoal(g as Goal);

      // Fetch how much is saved
      const { data: contribs } = await supabase.from("goal_contributions").select("amount").eq("goal_id", inv.goal_id);
      const total = (contribs || []).reduce((sum: number, c: { amount: number }) => sum + Number(c.amount), 0);
      setSaved(total);

      // Check if user is already a member
      const { data: membership } = await supabase
        .from("goal_members")
        .select("id")
        .eq("goal_id", inv.goal_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (membership) {
        setStatus("already-member");
        return;
      }

      setStatus("ready");
    };
    load();
  }, [authLoading, user, token, supabase]);

  const handleAccept = async () => {
    if (!invite || !user) return;
    setStatus("accepting");
    // Insert membership
    const { error: memErr } = await supabase.from("goal_members").insert({
      goal_id: invite.goal_id,
      user_id: user.id,
      role: "member",
    });
    if (memErr) {
      setErrorMsg(memErr.message);
      setStatus("error");
      return;
    }
    // Mark invite accepted
    await supabase.from("goal_invites").update({
      accepted_by: user.id,
      accepted_at: new Date().toISOString(),
    }).eq("id", invite.id);
    setStatus("accepted");
    setTimeout(() => router.push("/goals"), 1500);
  };

  const Icon = goal ? getGoalIcon(goal.icon) : Target;
  const progress = goal && Number(goal.target_amount) > 0 ? Math.min(100, (saved / Number(goal.target_amount)) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-purple-600" />
          <h1 className="text-lg font-semibold text-gray-900">Join Shared Goal</h1>
        </div>

        {status === "loading" && (
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 size={24} className="text-gray-400 animate-spin mb-3" />
            <p className="text-sm text-gray-500">Loading invitation...</p>
          </div>
        )}

        {status === "need-login" && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
              <LogIn size={22} className="text-blue-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Sign in to accept</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">You need an account to join a shared goal. We&apos;ll bring you back here after.</p>
            <Link
              href={`/login?redirect=/goals/join/${token}`}
              className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
            >
              <LogIn size={14} /> Sign in
            </Link>
            <p className="text-xs text-gray-400 mt-3">
              Don&apos;t have an account yet?{" "}
              <Link href={`/signup?redirect=/goals/join/${token}`} className="text-blue-600 hover:text-blue-700 font-medium">Sign up</Link>
            </p>
          </div>
        )}

        {status === "not-found" && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <AlertCircle size={22} className="text-red-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Invite not found</p>
            <p className="text-xs text-gray-400 mt-1">This link is invalid or has been revoked.</p>
            <Link href="/goals" className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-700 font-medium">Go to your goals →</Link>
          </div>
        )}

        {status === "expired" && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
              <AlertCircle size={22} className="text-amber-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Invite expired</p>
            <p className="text-xs text-gray-400 mt-1">Ask the goal owner to send you a new link.</p>
            <Link href="/goals" className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-700 font-medium">Go to your goals →</Link>
          </div>
        )}

        {status === "already-member" && goal && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={22} className="text-green-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900">You&apos;re already a member</p>
            <p className="text-xs text-gray-400 mt-1">You have access to &quot;{goal.name}&quot;.</p>
            <Link href="/goals" className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">View the goal →</Link>
          </div>
        )}

        {(status === "ready" || status === "accepting") && goal && (
          <>
            {/* Goal preview */}
            <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3 mb-5">
              {goal.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={goal.image_url} alt="" className="w-14 h-14 rounded-xl object-cover border border-gray-100 shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${goal.color}15`, color: goal.color }}>
                  <Icon size={26} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{goal.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  <span className="font-medium text-gray-700">${saved.toFixed(2)}</span>
                  <span> of ${Number(goal.target_amount).toFixed(2)}</span>
                </p>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1.5">
                  <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: goal.color }} />
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 text-center mb-4">
              You&apos;ll be able to contribute and see progress together. You won&apos;t see the owner&apos;s personal finances.
            </p>

            <button
              onClick={handleAccept}
              disabled={status === "accepting"}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              {status === "accepting" ? <><Loader2 size={16} className="animate-spin" /> Joining...</> : <>Accept Invite</>}
            </button>
            <Link href="/goals" className="block mt-2 text-center text-xs text-gray-400 hover:text-gray-600">No thanks</Link>
          </>
        )}

        {status === "accepted" && goal && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={22} className="text-green-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900">🎉 You joined &quot;{goal.name}&quot;!</p>
            <p className="text-xs text-gray-400 mt-1">Redirecting...</p>
          </div>
        )}

        {status === "error" && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <AlertCircle size={22} className="text-red-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Something went wrong</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">{errorMsg || "Please try again."}</p>
            <Link href="/goals" className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-700 font-medium">Go to your goals →</Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
