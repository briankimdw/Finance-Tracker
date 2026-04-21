"use client";

import { useEffect, useState } from "react";
import { X, Zap, DollarSign, User, Bed, Plane, Utensils, MapPin, ShoppingBag, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { TripItemCategory, TripMember, Profile } from "@/lib/types";

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
  onSave: (data: { name: string; amount: number; category: TripItemCategory; paid_by: string; notes?: string }) => Promise<void>;
}

export default function QuickLogPurchaseModal({ isOpen, tripColor = "#3b82f6", tripName, members, currentUserId, onClose, onSave }: QuickLogPurchaseModalProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
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

  if (!isOpen) return null;

  const update = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

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
    });
    setLoading(false);
    onClose();
  };

  const input = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm";
  const hasMembers = members.length >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl shadow-gray-900/10 border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${tripColor}15`, color: tripColor }}>
              <Zap size={16} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Log a purchase</h2>
              {tripName && <p className="text-[11px] text-gray-400 truncate">{tripName}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">What did you buy?</label>
            <input type="text" required value={form.name} onChange={(e) => update("name", e.target.value)} className={input} placeholder="Taxi to hotel, street snacks, museum tickets..." autoFocus />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><DollarSign size={11} /> Amount</label>
            <input type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => update("amount", e.target.value)} className={input} placeholder="0.00" />
          </div>

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

          {hasMembers && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><User size={11} /> Who paid</label>
              <select value={form.paid_by} onChange={(e) => update("paid_by", e.target.value)} className={input}>
                {members.map((m) => {
                  const p = profiles[m.user_id];
                  const label = p?.display_name || p?.username || m.user_id.slice(0, 8);
                  return <option key={m.user_id} value={m.user_id}>{m.user_id === currentUserId ? `You (${label})` : label}</option>;
                })}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="text" value={form.notes} onChange={(e) => update("notes", e.target.value)} className={input} placeholder="Quick note..." />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 px-4 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 px-4 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-all hover:shadow-lg"
              style={{ background: tripColor, boxShadow: loading ? undefined : `0 4px 12px ${tripColor}33` }}>
              {loading ? "Logging..." : "Log purchase"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
