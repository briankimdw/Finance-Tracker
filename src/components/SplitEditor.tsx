"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, Equal, Sliders, User, AlertCircle, CheckCircle } from "lucide-react";
import type { TripMember, Profile, SplitInput } from "@/lib/types";
import { equalSplit } from "@/hooks/useTrips";

type Mode = "equal" | "custom";

interface SplitEditorProps {
  total: number;
  members: TripMember[];
  currentUserId: string | null;
  /** Existing splits when editing; drives initial mode detection. */
  initialSplits?: SplitInput[];
  onChange: (splits: SplitInput[], valid: boolean) => void;
}

/**
 * Reusable editor for picking how to split a purchase across members.
 * Two modes: equal-split (toggle participants via avatars) or custom
 * (type the dollar amount for each person). Always emits a splits array
 * + a "valid" flag indicating whether the amounts sum to `total`.
 */
export default function SplitEditor({ total, members, currentUserId, initialSplits, onChange }: SplitEditorProps) {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [mode, setMode] = useState<Mode>("equal");

  // For equal mode: which members are included
  const [included, setIncluded] = useState<Set<string>>(() => new Set(members.map((m) => m.user_id)));

  // For custom mode: per-user amount string
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  // Load profiles once for nicer labels
  useEffect(() => {
    if (members.length === 0) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").in("id", members.map((m) => m.user_id));
      const map: Record<string, Profile> = {};
      for (const p of (data as Profile[]) || []) map[p.id] = p;
      setProfiles(map);
    })();
  }, [members, supabase]);

  // Initialize ONCE per mount. Parent passes a new `initialSplits` array
  // reference on every keystroke, so a naive effect would reset state
  // constantly. Use a ref to only run the init logic the first time we
  // have enough data (members loaded). The parent should remount this
  // component when switching items (via `key={item.id}`) if it wants
  // fresh state.
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    if (members.length === 0) return;  // wait for members to load
    didInitRef.current = true;

    if (!initialSplits || initialSplits.length === 0) {
      setIncluded(new Set(members.map((m) => m.user_id)));
      setCustomAmounts({});
      setMode("equal");
      return;
    }
    const amounts = initialSplits.map((s) => s.amount);
    const minA = Math.min(...amounts);
    const maxA = Math.max(...amounts);
    const looksEqual = maxA - minA <= 0.01;
    if (looksEqual) {
      setIncluded(new Set(initialSplits.map((s) => s.user_id)));
      setMode("equal");
    } else {
      const cm: Record<string, string> = {};
      for (const s of initialSplits) cm[s.user_id] = s.amount.toFixed(2);
      setCustomAmounts(cm);
      setMode("custom");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members]);

  const labelFor = (uid: string) => {
    const p = profiles[uid];
    if (uid === currentUserId) return "You";
    return p?.display_name || p?.username || uid.slice(0, 8);
  };
  const initialFor = (uid: string) => (labelFor(uid) || "?").charAt(0).toUpperCase();
  const colorFor = (uid: string) => {
    const p = profiles[uid];
    if (p?.color) return p.color;
    const palette = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#84cc16"];
    return palette[(initialFor(uid).charCodeAt(0) || 0) % palette.length];
  };

  // Computed splits based on mode
  const splits: SplitInput[] = useMemo(() => {
    if (mode === "equal") {
      const ids = members.map((m) => m.user_id).filter((uid) => included.has(uid));
      if (ids.length === 0 || total <= 0) return [];
      return equalSplit(total, ids);
    }
    // custom mode
    return members
      .map((m) => ({ user_id: m.user_id, amount: parseFloat(customAmounts[m.user_id] || "0") || 0 }))
      .filter((s) => s.amount > 0);
  }, [mode, included, customAmounts, members, total]);

  const sumCents = splits.reduce((s, x) => s + Math.round(x.amount * 100), 0);
  const totalCents = Math.round(total * 100);
  const diffCents = sumCents - totalCents;
  const valid = diffCents === 0 && splits.length > 0;

  // Push updates upward
  useEffect(() => {
    onChange(splits, valid);
    // Only re-fire when splits or valid actually change. Serialize to minimize noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(splits), valid]);

  const toggleIncluded = (uid: string) => {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const setJustMe = () => {
    if (!currentUserId) return;
    setMode("equal");
    setIncluded(new Set([currentUserId]));
  };

  const setEveryone = () => {
    setMode("equal");
    setIncluded(new Set(members.map((m) => m.user_id)));
  };

  const setCustomFromEqual = () => {
    // Seed custom inputs from the current equal split so the user can tweak
    const current = splits;
    const cm: Record<string, string> = {};
    for (const m of members) {
      const match = current.find((s) => s.user_id === m.user_id);
      cm[m.user_id] = match ? match.amount.toFixed(2) : "0.00";
    }
    setCustomAmounts(cm);
    setMode("custom");
  };

  if (members.length < 2) return null;

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50/60 p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <Users size={12} className="text-gray-400 dark:text-gray-500" />
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Split this</p>
          <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">${total.toFixed(2)}</span>
        </div>
        <div className="inline-flex items-center border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900 p-0.5">
          <button type="button" onClick={() => setMode("equal")}
            className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md transition-colors ${mode === "equal" ? "bg-gray-900 text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"}`}>
            <Equal size={10} /> Equal
          </button>
          <button type="button" onClick={setCustomFromEqual}
            className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md transition-colors ${mode === "custom" ? "bg-gray-900 text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"}`}>
            <Sliders size={10} /> Custom
          </button>
        </div>
      </div>

      {/* Quick shortcuts for equal mode */}
      {mode === "equal" && (
        <div className="flex items-center gap-1.5 text-[10px]">
          <button type="button" onClick={setEveryone}
            className="px-2 py-1 rounded-full font-medium bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700">Everyone</button>
          <button type="button" onClick={setJustMe}
            className="px-2 py-1 rounded-full font-medium bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 flex items-center gap-1">
            <User size={10} /> Just me
          </button>
          <span className="text-gray-400 dark:text-gray-500 ml-1">or tap people to include</span>
        </div>
      )}

      {/* Members list */}
      <div className="space-y-1.5">
        {members.map((m) => {
          const isIncluded = included.has(m.user_id);
          const label = labelFor(m.user_id);
          const initial = initialFor(m.user_id);
          const color = colorFor(m.user_id);
          const splitForUser = splits.find((s) => s.user_id === m.user_id);
          const amount = splitForUser?.amount ?? 0;
          if (mode === "equal") {
            return (
              <button key={m.user_id} type="button"
                onClick={() => toggleIncluded(m.user_id)}
                className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all ${isIncluded ? "bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 ring-1 ring-blue-100" : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 opacity-50 hover:opacity-80"}`}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white font-semibold text-[11px]"
                  style={{ background: color }}>{initial}</div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{label}</p>
                  {isIncluded ? (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">Owes ${amount.toFixed(2)}</p>
                  ) : (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">Excluded</p>
                  )}
                </div>
                <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors shrink-0 ${isIncluded ? "bg-blue-600 text-white" : "border border-gray-300 dark:border-gray-700"}`}>
                  {isIncluded && <CheckCircle size={10} />}
                </div>
              </button>
            );
          }
          // custom mode
          return (
            <div key={m.user_id} className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white font-semibold text-[11px]"
                style={{ background: color }}>{initial}</div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex-1 min-w-0 truncate">{label}</p>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500">$</span>
                <input
                  type="number" min="0" step="0.01"
                  value={customAmounts[m.user_id] ?? "0.00"}
                  onChange={(e) => setCustomAmounts((p) => ({ ...p, [m.user_id]: e.target.value }))}
                  className="w-24 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md pl-5 pr-2 py-1 text-right text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 tabular-nums"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Total line */}
      <div className={`flex items-center justify-between text-[11px] px-2 py-1.5 rounded-md ${
        valid ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300" : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
      }`}>
        <span className="flex items-center gap-1">
          {valid ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
          {valid ? "Splits match total" : `${diffCents > 0 ? "$" + (diffCents / 100).toFixed(2) + " over" : "$" + (-diffCents / 100).toFixed(2) + " short"}`}
        </span>
        <span className="font-bold tabular-nums">
          ${(sumCents / 100).toFixed(2)} / ${total.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
