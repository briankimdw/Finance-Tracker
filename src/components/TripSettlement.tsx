"use client";

import { useEffect, useState } from "react";
import { Receipt, Scale, ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { TripWithStats, Profile } from "@/lib/types";

interface TripSettlementProps {
  trip: TripWithStats;
  currentUserId: string | null;
}

function Avatar({ name, size = 28 }: { name: string | null | undefined; size?: number }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  const palette = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#84cc16"];
  const color = palette[(initial.charCodeAt(0) || 0) % palette.length];
  return (
    <div className="rounded-full flex items-center justify-center text-white font-semibold shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}>
      {initial}
    </div>
  );
}

export default function TripSettlement({ trip, currentUserId }: TripSettlementProps) {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

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

  const nameFor = (uid: string) => {
    const p = profiles[uid];
    if (uid === currentUserId) return "You";
    return p?.display_name || p?.username || uid.slice(0, 8);
  };

  const sortedBalances = [...trip.balances].sort((a, b) => b.balance - a.balance);
  const totalPool = trip.totalActual;
  const share = trip.balances[0]?.share ?? 0;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Scale size={14} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Who paid what</h3>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Even split</p>
          <p className="text-xs font-bold text-gray-900 tabular-nums">${share.toFixed(2)}/person</p>
        </div>
      </div>

      {totalPool === 0 ? (
        <div className="p-5 text-center">
          <Receipt size={18} className="text-gray-300 mx-auto mb-1.5" />
          <p className="text-xs text-gray-400">No purchases logged yet. Log one with the Quick-add button.</p>
        </div>
      ) : (
        <>
          {/* Balance per person */}
          <div className="divide-y divide-gray-50">
            {sortedBalances.map((b) => {
              const name = nameFor(b.userId);
              const positive = b.balance > 0.01;
              const negative = b.balance < -0.01;
              const even = !positive && !negative;
              return (
                <div key={b.userId} className="flex items-center gap-3 px-5 py-2.5">
                  <Avatar name={name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                    <p className="text-[11px] text-gray-400 tabular-nums">Paid ${b.paid.toFixed(2)} · share ${b.share.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    {positive && (
                      <span className="text-sm font-bold text-green-600 flex items-center justify-end gap-0.5 tabular-nums">
                        <TrendingUp size={12} /> +${b.balance.toFixed(2)}
                      </span>
                    )}
                    {negative && (
                      <span className="text-sm font-bold text-red-600 flex items-center justify-end gap-0.5 tabular-nums">
                        <TrendingDown size={12} /> −${Math.abs(b.balance).toFixed(2)}
                      </span>
                    )}
                    {even && (
                      <span className="text-sm font-semibold text-gray-400 flex items-center justify-end gap-0.5">
                        <Minus size={12} /> Even
                      </span>
                    )}
                    <p className="text-[10px] text-gray-400">
                      {positive ? "is owed" : negative ? "owes" : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Settlement suggestions */}
          {trip.settlements.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3 space-y-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Settle up</p>
              {trip.settlements.map((s, i) => {
                const from = nameFor(s.fromUserId);
                const to = nameFor(s.toUserId);
                const involvesMe = s.fromUserId === currentUserId || s.toUserId === currentUserId;
                return (
                  <div key={i} className={`flex items-center gap-2 p-2.5 rounded-lg ${involvesMe ? "bg-white border border-blue-100 ring-1 ring-blue-50" : "bg-white border border-gray-100"}`}>
                    <Avatar name={from} size={24} />
                    <span className={`text-sm ${s.fromUserId === currentUserId ? "font-semibold text-red-600" : "text-gray-700"}`}>{from}</span>
                    <ArrowRight size={13} className="text-gray-400 shrink-0" />
                    <Avatar name={to} size={24} />
                    <span className={`text-sm flex-1 ${s.toUserId === currentUserId ? "font-semibold text-green-600" : "text-gray-700"}`}>{to}</span>
                    <span className="text-sm font-bold text-gray-900 tabular-nums">${s.amount.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
