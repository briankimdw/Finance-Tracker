"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Receipt, ArrowRight, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { TripWithStats, Profile } from "@/lib/types";

interface TripSettlementProps {
  trip: TripWithStats;
  currentUserId: string | null;
}

function Avatar({ name, size = 28, color, url }: { name: string | null | undefined; size?: number; color?: string; url?: string | null }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  const palette = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#84cc16"];
  const bg = color || palette[(initial.charCodeAt(0) || 0) % palette.length];
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }} />
    );
  }
  return (
    <div className="rounded-full flex items-center justify-center text-white font-semibold shrink-0"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.4 }}>
      {initial}
    </div>
  );
}

export default function TripSettlement({ trip, currentUserId }: TripSettlementProps) {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const ids = trip.members.map((m) => m.user_id);
    if (ids.length === 0) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").in("id", ids);
      const map: Record<string, Profile> = {};
      for (const p of (data as Profile[]) || []) map[p.id] = p;
      setProfiles(map);
    })();
  }, [trip.members, supabase]);

  if (trip.members.length < 2) return null;

  const profileFor = (uid: string) => profiles[uid];
  const nameFor = (uid: string) => {
    const p = profileFor(uid);
    if (uid === currentUserId) return "You";
    return p?.display_name || p?.username || uid.slice(0, 8);
  };
  const colorFor = (uid: string) => profileFor(uid)?.color || undefined;
  const avatarUrlFor = (uid: string) => profileFor(uid)?.avatar_url || null;

  const totalPool = trip.totalActual;

  // Your balance (positive = owed, negative = owe, zero = even)
  const myBalance = currentUserId ? trip.balances.find((b) => b.userId === currentUserId) : null;
  const myNet = myBalance?.balance ?? 0;

  // Settlements involving you
  const mySettlements = trip.settlements.filter(
    (s) => s.fromUserId === currentUserId || s.toUserId === currentUserId
  );
  const otherSettlements = trip.settlements.filter(
    (s) => s.fromUserId !== currentUserId && s.toUserId !== currentUserId
  );

  // Hero status
  const heroStatus: "owed" | "owes" | "even" | "empty" =
    totalPool === 0 ? "empty" :
    myNet > 0.01 ? "owed" :
    myNet < -0.01 ? "owes" : "even";

  // Put current user first in list
  const sortedBalances = [...trip.balances].sort((a, b) => {
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;
    return b.balance - a.balance;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm bg-white"
    >
      {/* HERO — Splitwise-style. Color + copy changes based on user's net position. */}
      <div className={`relative px-5 py-5 ${
        heroStatus === "owed" ? "bg-gradient-to-br from-green-50 to-green-100/40" :
        heroStatus === "owes" ? "bg-gradient-to-br from-red-50 to-red-100/40" :
        "bg-gradient-to-br from-gray-50 to-gray-100/40"
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${
              heroStatus === "owed" ? "text-green-700" :
              heroStatus === "owes" ? "text-red-700" :
              "text-gray-500"
            }`}>
              {heroStatus === "empty" ? "Your balance" : "Overall"}
            </p>
            {heroStatus === "empty" ? (
              <>
                <p className="text-xl font-bold text-gray-400 mt-1">No purchases yet</p>
                <p className="text-xs text-gray-500 mt-0.5">Tap <span className="font-medium">Log purchase</span> above to start tracking who owes what.</p>
              </>
            ) : heroStatus === "even" ? (
              <>
                <p className="text-2xl font-bold text-gray-700 mt-1">You&apos;re even</p>
                <p className="text-xs text-gray-500 mt-0.5">All squared up — no one owes anyone.</p>
              </>
            ) : heroStatus === "owed" ? (
              <>
                <p className="text-[11px] text-green-700 mt-1">You&apos;re owed</p>
                <p className="text-3xl font-bold text-green-700 tabular-nums">+${myNet.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  You paid more than your share. {mySettlements.length > 0 ? `See settlements below.` : ""}
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] text-red-700 mt-1">You owe</p>
                <p className="text-3xl font-bold text-red-700 tabular-nums">${Math.abs(myNet).toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  You spent less than your share. {mySettlements.length > 0 ? `See settlements below.` : ""}
                </p>
              </>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Trip total</p>
            <p className="text-base font-bold text-gray-900 tabular-nums mt-0.5">${totalPool.toFixed(2)}</p>
          </div>
        </div>

        {/* My settlement rows highlighted in the hero */}
        {mySettlements.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {mySettlements.map((s, i) => {
              const iAmPaying = s.fromUserId === currentUserId;
              const other = iAmPaying ? s.toUserId : s.fromUserId;
              return (
                <div key={i} className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-white/60 rounded-lg px-3 py-2 shadow-sm">
                  <Avatar name={nameFor(other)} color={colorFor(other)} url={avatarUrlFor(other)} size={24} />
                  <div className="flex-1 min-w-0 text-sm">
                    {iAmPaying ? (
                      <>You pay <span className="font-semibold text-gray-900">{nameFor(other)}</span></>
                    ) : (
                      <><span className="font-semibold text-gray-900">{nameFor(other)}</span> pays you</>
                    )}
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${iAmPaying ? "text-red-600" : "text-green-700"}`}>
                    {iAmPaying ? "−" : "+"}${s.amount.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Expand/collapse: per-member breakdown + other settlements */}
      {totalPool > 0 && (
        <>
          <button onClick={() => setExpanded((e) => !e)}
            className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors border-t border-gray-100">
            <span>{expanded ? "Hide breakdown" : "Show everyone's balance"}</span>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {expanded && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <div className="divide-y divide-gray-50">
                {sortedBalances.map((b) => {
                  const name = nameFor(b.userId);
                  const positive = b.balance > 0.01;
                  const negative = b.balance < -0.01;
                  const isMe = b.userId === currentUserId;
                  return (
                    <div key={b.userId} className={`flex items-center gap-3 px-5 py-2.5 ${isMe ? "bg-blue-50/30" : ""}`}>
                      <Avatar name={name} color={colorFor(b.userId)} url={avatarUrlFor(b.userId)} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${isMe ? "font-semibold text-gray-900" : "font-medium text-gray-900"}`}>{name}</p>
                        <p className="text-[11px] text-gray-400 tabular-nums">Paid ${b.paid.toFixed(2)} · owes ${b.share.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        {positive ? (
                          <span className="text-sm font-bold text-green-600 flex items-center justify-end gap-0.5 tabular-nums">
                            <TrendingUp size={12} /> +${b.balance.toFixed(2)}
                          </span>
                        ) : negative ? (
                          <span className="text-sm font-bold text-red-600 flex items-center justify-end gap-0.5 tabular-nums">
                            <TrendingDown size={12} /> −${Math.abs(b.balance).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-sm font-semibold text-gray-400 flex items-center justify-end gap-0.5">
                            <Minus size={12} /> Even
                          </span>
                        )}
                        <p className="text-[10px] text-gray-400">{positive ? "is owed" : negative ? "owes" : ""}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Other-party settlement suggestions (ones not involving me) */}
              {otherSettlements.length > 0 && (
                <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3 space-y-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Other people settle</p>
                  {otherSettlements.map((s, i) => {
                    const from = nameFor(s.fromUserId);
                    const to = nameFor(s.toUserId);
                    return (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-100">
                        <Avatar name={from} color={colorFor(s.fromUserId)} url={avatarUrlFor(s.fromUserId)} size={22} />
                        <span className="text-sm text-gray-700">{from}</span>
                        <ArrowRight size={12} className="text-gray-400 shrink-0" />
                        <Avatar name={to} color={colorFor(s.toUserId)} url={avatarUrlFor(s.toUserId)} size={22} />
                        <span className="text-sm text-gray-700 flex-1">{to}</span>
                        <span className="text-sm font-bold text-gray-900 tabular-nums">${s.amount.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </>
      )}

      {totalPool === 0 && (
        <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-2 text-[11px] text-gray-400">
          <Receipt size={12} />
          <span>Balances will show up once anyone logs a purchase as &quot;done&quot;.</span>
        </div>
      )}
    </motion.div>
  );
}
