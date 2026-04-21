"use client";

import { useEffect, useMemo, useState } from "react";
import { User, Bed, Plane, Utensils, MapPin, ShoppingBag, Package, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import SplitEditor from "@/components/SplitEditor";
import { BottomSheet } from "@/components/ui/BottomSheet";
import NumericInput from "@/components/ui/NumericInput";
import { equalSplit } from "@/hooks/useTrips";
import type { TripItemCategory, TripMember, Profile, SplitInput } from "@/lib/types";

const CATEGORIES: { value: TripItemCategory; label: string; Icon: typeof Bed }[] = [
  { value: "food", label: "Food", Icon: Utensils },
  { value: "transport", label: "Transport", Icon: Plane },
  { value: "lodging", label: "Lodging", Icon: Bed },
  { value: "activity", label: "Activity", Icon: MapPin },
  { value: "shopping", label: "Shopping", Icon: ShoppingBag },
  { value: "other", label: "Other", Icon: Package },
];

interface QuickLogPurchaseModalProps {
  isOpen: boolean;
  tripColor?: string;
  tripName?: string;
  members: TripMember[];
  currentUserId: string | null;
  onClose: () => void;
  onSave: (data: { name: string; amount: number; category: TripItemCategory; paid_by: string; notes?: string; splits?: SplitInput[] }) => Promise<void>;
}

export default function QuickLogPurchaseModal({ isOpen, tripColor = "#3b82f6", tripName, members, currentUserId, onClose, onSave }: QuickLogPurchaseModalProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [splits, setSplits] = useState<SplitInput[]>([]);
  const [splitsValid, setSplitsValid] = useState(true);
  const [form, setForm] = useState({
    name: "",
    amount: "",
    category: "food" as TripItemCategory,
    paid_by: currentUserId || "",
    notes: "",
  });
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      name: "",
      amount: "",
      category: "food",
      paid_by: currentUserId || (members[0]?.user_id ?? ""),
      notes: "",
    });
    setShowSplit(false);
    setSplits([]);
    setSplitsValid(true);
  }, [isOpen, currentUserId, members]);

  useEffect(() => {
    if (!isOpen || members.length === 0) return;
    (async () => {
      const ids = members.map((m) => m.user_id);
      const { data } = await supabase.from("profiles").select("*").in("id", ids);
      const map: Record<string, Profile> = {};
      for (const p of (data as Profile[]) || []) map[p.id] = p;
      setProfiles(map);
    })();
  }, [isOpen, members, supabase]);

  const update = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const amountNum = parseFloat(form.amount) || 0;
  const hasMembers = members.length >= 2;

  // Live equal-split preview for the chip
  const perPersonPreview = useMemo(() => {
    if (!hasMembers || amountNum <= 0) return null;
    const ids = members.map((m) => m.user_id);
    const shares = equalSplit(amountNum, ids);
    if (shares.length === 0) return null;
    // All shares are near-equal; use the first as the display value
    return { perPerson: shares[0].amount, ways: ids.length };
  }, [amountNum, hasMembers, members]);

  const canSubmit = !!form.name.trim() && amountNum > 0 && !loading && (!showSplit || splitsValid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.amount) return;
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) return;
    setLoading(true);
    await onSave({
      name: form.name.trim(),
      amount,
      category: form.category,
      paid_by: form.paid_by || currentUserId || "",
      notes: form.notes.trim() || undefined,
      splits: showSplit && splitsValid && splits.length > 0 ? splits : undefined,
    });
    setLoading(false);
    onClose();
  };

  const input = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm";

  const sheetTitle = tripName ? `${tripName} · Log a purchase` : "Log a purchase";

  const submitLabel = loading
    ? "Logging..."
    : amountNum > 0
      ? `Log $${amountNum.toFixed(2)}`
      : "Log purchase";

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={sheetTitle} size="sm">
      <form onSubmit={handleSubmit} className="space-y-3">
          {/* 1. Hero amount input */}
          <div className="flex flex-col items-center">
            <NumericInput
              size="hero"
              value={form.amount}
              onChange={(v) => update("amount", v)}
              autoFocus
              required
              ariaLabel="Amount"
              placeholder="0.00"
            />

            {/* 2. Live split preview chip (shared trips with members only) */}
            {hasMembers && perPersonPreview && !showSplit && (
              <button
                type="button"
                onClick={() => setShowSplit(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 -mt-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-medium border border-blue-100 hover:bg-blue-100 transition-colors"
              >
                <Users size={11} />
                <span className="tabular-nums">
                  ${perPersonPreview.perPerson.toFixed(2)} per person · {perPersonPreview.ways} ways
                </span>
              </button>
            )}
          </div>

          {/* 3. Description / name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">What did you buy?</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className={input}
              placeholder="Taxi to hotel, street snacks, museum tickets..."
              autoCapitalize="words"
            />
          </div>

          {/* 4. Category */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Category</label>
            <div className="grid grid-cols-3 gap-1.5">
              {CATEGORIES.map(({ value, label, Icon }) => (
                <button key={value} type="button" onClick={() => update("category", value)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all ${form.category === value ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Paid by */}
          {hasMembers && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1"><User size={11} /> Who paid</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {members.map((m) => {
                  const p = profiles[m.user_id];
                  const name = p?.display_name || p?.username || (m.user_id === currentUserId ? "You" : m.user_id.slice(0, 8));
                  const initial = (m.user_id === currentUserId ? "Y" : name).charAt(0).toUpperCase();
                  const color = p?.color || "#3b82f6";
                  const isSelected = form.paid_by === m.user_id;
                  const isCurrentUser = m.user_id === currentUserId;
                  return (
                    <button key={m.user_id} type="button" onClick={() => update("paid_by", m.user_id)}
                      className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        isSelected ? "bg-white ring-2 ring-blue-400 shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ background: color }}>{initial}</div>
                      <span className={isSelected ? "text-gray-900" : ""}>{isCurrentUser ? "You" : name}</span>
                      {isCurrentUser && <span className="text-[9px] text-blue-500 font-semibold">(default)</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="text" value={form.notes} onChange={(e) => update("notes", e.target.value)} className={input} placeholder="Quick note..." />
          </div>

          {/* Expanded split editor (when user taps the preview chip) */}
          {hasMembers && showSplit && (
            amountNum <= 0 ? (
              <p className="text-[11px] text-gray-400 text-center py-2">Enter an amount to customize the split</p>
            ) : (
              <SplitEditor
                key="quicklog"
                total={amountNum}
                members={members}
                currentUserId={currentUserId}
                onChange={(s, valid) => {
                  setSplits(s);
                  setSplitsValid(valid);
                }}
              />
            )
          )}

          {/* 7. Submit */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 px-4 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium">Cancel</button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-[2] py-2.5 px-4 rounded-lg text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg tabular-nums"
              style={{ background: tripColor, boxShadow: loading ? undefined : `0 4px 12px ${tripColor}33` }}
            >
              {submitLabel}
            </button>
          </div>
        </form>
    </BottomSheet>
  );
}
