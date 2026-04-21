"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Users, Plane, CheckCircle, AlertCircle, LogIn, Loader2, MapPin, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { getTripIcon } from "@/lib/tripIcons";
import type { Trip, TripInvite } from "@/lib/types";

type Status = "loading" | "ready" | "expired" | "not-found" | "already-member" | "need-login" | "accepting" | "accepted" | "error";

export default function JoinTripPage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params?.token === "string" ? params.token : "";
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const [invite, setInvite] = useState<TripInvite | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [spent, setSpent] = useState<number>(0);

  const supabase = createClient();

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setStatus("need-login"); return; }
    const load = async () => {
      const { data: inv, error: invErr } = await supabase
        .from("trip_invites")
        .select("*")
        .eq("token", token)
        .maybeSingle();
      if (invErr || !inv) { setStatus("not-found"); return; }
      setInvite(inv as TripInvite);
      if (new Date(inv.expires_at).getTime() < Date.now()) { setStatus("expired"); return; }

      const { data: existing } = await supabase
        .from("trip_members")
        .select("id")
        .eq("trip_id", inv.trip_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing) { setStatus("already-member"); return; }

      const { data: t } = await supabase.from("trips").select("*").eq("id", inv.trip_id).maybeSingle();
      if (!t) { setStatus("not-found"); return; }
      setTrip(t as Trip);

      const { data: items } = await supabase.from("trip_items").select("actual_amount, status").eq("trip_id", inv.trip_id);
      const total = (items || []).filter((i: { status: string }) => i.status === "done").reduce((s: number, i: { actual_amount: number }) => s + Number(i.actual_amount), 0);
      setSpent(total);

      setStatus("ready");
    };
    load();
  }, [authLoading, user, token, supabase]);

  const handleAccept = async () => {
    if (!invite || !user) return;
    setStatus("accepting");
    const { error: memErr } = await supabase.from("trip_members").insert({
      trip_id: invite.trip_id,
      user_id: user.id,
      role: "member",
    });
    if (memErr) { setErrorMsg(memErr.message); setStatus("error"); return; }
    await supabase.from("trip_invites").update({ accepted_by: user.id, accepted_at: new Date().toISOString() }).eq("id", invite.id);
    setStatus("accepted");
    setTimeout(() => router.push(`/trips/${invite.trip_id}`), 1200);
  };

  const Icon = trip ? getTripIcon(trip.icon) : Plane;
  const budget = trip ? Number(trip.total_budget) : 0;
  const progress = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-purple-600" />
          <h1 className="text-lg font-semibold text-gray-900">Join Trip</h1>
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
            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">You need an account to co-plan a trip.</p>
            <Link href={`/login?redirect=/trips/join/${token}`} className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">
              <LogIn size={14} /> Sign in
            </Link>
            <p className="text-xs text-gray-400 mt-3">
              Don&apos;t have an account?{" "}
              <Link href={`/signup?redirect=/trips/join/${token}`} className="text-blue-600 hover:text-blue-700 font-medium">Sign up</Link>
            </p>
          </div>
        )}

        {status === "not-found" && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3"><AlertCircle size={22} className="text-red-600" /></div>
            <p className="text-sm font-semibold text-gray-900">Invite not found</p>
            <p className="text-xs text-gray-400 mt-1">This link is invalid or was revoked.</p>
            <Link href="/trips" className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-700 font-medium">Go to your trips →</Link>
          </div>
        )}

        {status === "expired" && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3"><AlertCircle size={22} className="text-amber-600" /></div>
            <p className="text-sm font-semibold text-gray-900">Invite expired</p>
            <p className="text-xs text-gray-400 mt-1">Ask the trip owner to send a fresh link.</p>
            <Link href="/trips" className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-700 font-medium">Go to your trips →</Link>
          </div>
        )}

        {status === "already-member" && trip && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3"><CheckCircle size={22} className="text-green-600" /></div>
            <p className="text-sm font-semibold text-gray-900">You&apos;re already on this trip</p>
            <p className="text-xs text-gray-400 mt-1">&quot;{trip.name}&quot;</p>
            <Link href={`/trips/${trip.id}`} className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">View the trip →</Link>
          </div>
        )}

        {(status === "ready" || status === "accepting") && trip && (
          <>
            <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3 mb-5">
              {trip.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={trip.image_url} alt="" className="w-14 h-14 rounded-xl object-cover border border-gray-100 shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${trip.color}15`, color: trip.color }}>
                  <Icon size={26} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{trip.name}</p>
                {trip.destination && <p className="text-[11px] text-gray-400 flex items-center gap-1"><MapPin size={10} /> {trip.destination}</p>}
                {(trip.start_date || trip.end_date) && (
                  <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                    <Calendar size={10} />
                    {trip.start_date && new Date(trip.start_date + "T12:00:00").toLocaleDateString()}
                    {trip.start_date && trip.end_date && " → "}
                    {trip.end_date && new Date(trip.end_date + "T12:00:00").toLocaleDateString()}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  <span className="font-medium text-gray-700">${spent.toFixed(2)}</span>
                  <span> of ${budget.toFixed(2)}</span>
                </p>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1.5">
                  <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: trip.color }} />
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 text-center mb-4">
              You&apos;ll be able to add items, mark spending, and see progress together.
            </p>

            <button onClick={handleAccept} disabled={status === "accepting"}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-600/20 flex items-center justify-center gap-2">
              {status === "accepting" ? <><Loader2 size={16} className="animate-spin" /> Joining...</> : "Accept invite"}
            </button>
            <Link href="/trips" className="block mt-2 text-center text-xs text-gray-400 hover:text-gray-600">No thanks</Link>
          </>
        )}

        {status === "accepted" && trip && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3"><CheckCircle size={22} className="text-green-600" /></div>
            <p className="text-sm font-semibold text-gray-900">🎉 You joined &quot;{trip.name}&quot;!</p>
            <p className="text-xs text-gray-400 mt-1">Redirecting...</p>
          </div>
        )}

        {status === "error" && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3"><AlertCircle size={22} className="text-red-600" /></div>
            <p className="text-sm font-semibold text-gray-900">Something went wrong</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">{errorMsg || "Please try again."}</p>
            <Link href="/trips" className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-700 font-medium">Go to your trips →</Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
