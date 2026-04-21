"use client";

import { useState, useEffect } from "react";
import {
  X, Bed, Plane, Utensils, MapPin, ShoppingBag, Package,
  DollarSign, Calendar, Link as LinkIcon, Clock, Hash,
} from "lucide-react";
import type { TripItem, TripItemCategory, TripItemStatus } from "@/lib/types";

const CATEGORIES: { value: TripItemCategory; label: string; Icon: typeof Bed }[] = [
  { value: "lodging", label: "Lodging", Icon: Bed },
  { value: "transport", label: "Transport", Icon: Plane },
  { value: "food", label: "Food", Icon: Utensils },
  { value: "activity", label: "Activity", Icon: MapPin },
  { value: "shopping", label: "Shopping", Icon: ShoppingBag },
  { value: "other", label: "Other", Icon: Package },
];

const STATUSES: { value: TripItemStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "done", label: "Done" },
  { value: "skipped", label: "Skipped" },
];

interface AddTripItemModalProps {
  isOpen: boolean;
  tripId: string;
  tripColor?: string;
  item?: TripItem | null;
  remainingBudget: number;
  onClose: () => void;
  onSave: (data: {
    name: string;
    category?: TripItemCategory;
    planned_amount: number;
    actual_amount?: number;
    item_date?: string | null;
    end_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    location?: string | null;
    confirmation_code?: string | null;
    status?: TripItemStatus;
    notes?: string;
    url?: string;
  }) => Promise<void>;
}

export default function AddTripItemModal({ isOpen, item, tripColor = "#3b82f6", remainingBudget, onClose, onSave }: AddTripItemModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "activity" as TripItemCategory,
    planned_amount: "",
    actual_amount: "",
    item_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    location: "",
    confirmation_code: "",
    status: "planned" as TripItemStatus,
    notes: "",
    url: "",
  });

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name,
        category: item.category,
        planned_amount: String(item.planned_amount ?? ""),
        actual_amount: String(item.actual_amount ?? ""),
        item_date: item.item_date ?? "",
        end_date: item.end_date ?? "",
        start_time: item.start_time ?? "",
        end_time: item.end_time ?? "",
        location: item.location ?? "",
        confirmation_code: item.confirmation_code ?? "",
        status: item.status,
        notes: item.notes ?? "",
        url: item.url ?? "",
      });
    } else {
      setForm({
        name: "",
        category: "activity",
        planned_amount: "",
        actual_amount: "",
        item_date: "",
        end_date: "",
        start_time: "",
        end_time: "",
        location: "",
        confirmation_code: "",
        status: "planned",
        notes: "",
        url: "",
      });
    }
  }, [item, isOpen]);

  if (!isOpen) return null;

  const update = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    await onSave({
      name: form.name.trim(),
      category: form.category,
      planned_amount: parseFloat(form.planned_amount) || 0,
      actual_amount: form.status === "done" ? (parseFloat(form.actual_amount) || parseFloat(form.planned_amount) || 0) : 0,
      item_date: form.item_date || null,
      end_date: form.end_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      location: form.location.trim() || null,
      confirmation_code: form.confirmation_code.trim() || null,
      status: form.status,
      notes: form.notes.trim() || undefined,
      url: form.url.trim() || undefined,
    });
    setLoading(false);
    onClose();
  };

  const input = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm";
  const planned = parseFloat(form.planned_amount) || 0;
  const existingPlanned = item ? Number(item.planned_amount) : 0;
  const afterThisItem = remainingBudget - (planned - existingPlanned);

  const isLodging = form.category === "lodging";
  const isTransport = form.category === "transport";
  const isActivity = form.category === "activity" || form.category === "food";

  // Placeholders adapt to category
  const placeholderName =
    isLodging ? "Hotel Gracery, Shibuya" :
    isTransport ? "United flight SFO → NRT" :
    form.category === "food" ? "Sushi at Jiro" :
    form.category === "shopping" ? "Harajuku shopping" :
    "Fushimi Inari temple";

  const placeholderLocation =
    isLodging ? "1-19-1 Udagawacho, Shibuya, Tokyo" :
    isTransport ? "SFO → NRT" :
    "Address, neighborhood, or area";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl shadow-gray-900/10 border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">{item ? "Edit Item" : "Add to Itinerary"}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">What?</label>
            <input type="text" required value={form.name} onChange={(e) => update("name", e.target.value)} className={input} placeholder={placeholderName} />
          </div>

          {/* Category */}
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

          {/* Planned amount */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
              <DollarSign size={11} /> Planned amount
            </label>
            <input type="number" min="0" step="0.01" value={form.planned_amount} onChange={(e) => update("planned_amount", e.target.value)} className={input} placeholder="150.00" />
            {planned > 0 && (
              <p className={`text-[11px] mt-1 ${afterThisItem < 0 ? "text-red-600" : "text-gray-400"}`}>
                {afterThisItem >= 0
                  ? `After this: $${afterThisItem.toFixed(2)} left unallocated`
                  : `Over budget by $${Math.abs(afterThisItem).toFixed(2)}`}
              </p>
            )}
          </div>

          {/* Date(s) — lodging gets check-in + check-out, others just one date */}
          {isLodging ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><Calendar size={11} /> Check-in</label>
                <input type="date" value={form.item_date} onChange={(e) => update("item_date", e.target.value)} className={input} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><Calendar size={11} /> Check-out</label>
                <input type="date" value={form.end_date} onChange={(e) => update("end_date", e.target.value)} className={input} />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><Calendar size={11} /> Date <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="date" value={form.item_date} onChange={(e) => update("item_date", e.target.value)} className={input} />
            </div>
          )}

          {/* Times — transport (dep/arr), lodging (check-in/out), activity (start/end) */}
          {(isLodging || isTransport || isActivity) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><Clock size={11} />
                  {isTransport ? "Departure" : isLodging ? "Check-in time" : "Starts"}
                </label>
                <input type="time" value={form.start_time} onChange={(e) => update("start_time", e.target.value)} className={input} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><Clock size={11} />
                  {isTransport ? "Arrival" : isLodging ? "Check-out time" : "Ends"}
                </label>
                <input type="time" value={form.end_time} onChange={(e) => update("end_time", e.target.value)} className={input} />
              </div>
            </div>
          )}

          {/* Location / route */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><MapPin size={11} />
              {isTransport ? "Route" : "Location / address"} <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input type="text" value={form.location} onChange={(e) => update("location", e.target.value)} className={input} placeholder={placeholderLocation} />
          </div>

          {/* Confirmation code */}
          {(isLodging || isTransport) && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><Hash size={11} /> Confirmation / booking code <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="text" value={form.confirmation_code} onChange={(e) => update("confirmation_code", e.target.value)} className={input} placeholder={isTransport ? "Airline PNR / flight no." : "Booking ref"} />
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
            <div className="grid grid-cols-3 gap-1.5">
              {STATUSES.map((s) => (
                <button key={s.value} type="button" onClick={() => update("status", s.value)}
                  className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                    form.status === s.value
                      ? s.value === "done" ? "bg-green-50 border-green-300 text-green-700"
                      : s.value === "skipped" ? "bg-gray-100 border-gray-300 text-gray-700"
                      : "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actual amount when done */}
          {form.status === "done" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                <DollarSign size={11} /> Actual amount spent
              </label>
              <input type="number" min="0" step="0.01" value={form.actual_amount} onChange={(e) => update("actual_amount", e.target.value)} className={input} placeholder={form.planned_amount || "0.00"} />
              <p className="text-[11px] text-gray-400 mt-1">Leave blank to use the planned amount.</p>
            </div>
          )}

          {/* URL */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><LinkIcon size={11} /> Link <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="url" value={form.url} onChange={(e) => update("url", e.target.value)} className={input} placeholder="Booking URL, map link, menu..." />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} className={input + " resize-none"} placeholder="Phone number, special requests..." />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 px-4 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 px-4 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-all hover:shadow-lg"
              style={{ background: tripColor, boxShadow: loading ? undefined : `0 4px 12px ${tripColor}33` }}>
              {loading ? "Saving..." : item ? "Save changes" : "Add item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
