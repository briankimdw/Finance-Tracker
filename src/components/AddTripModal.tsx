"use client";

import { useState, useEffect } from "react";
import {
  Plane, Globe, MapPin, Compass, Mountain, Palmtree,
  Building2, Tent, Ship, Backpack, Camera, Heart,
  Image as ImageIcon, DollarSign, Calendar, Target, Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useGoals } from "@/hooks/useGoals";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { Trip, TripStatus } from "@/lib/types";

const COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#06b6d4", "#84cc16",
  "#1f2937", "#f97316",
];

const ICONS = [
  { name: "Plane", Icon: Plane },
  { name: "Globe", Icon: Globe },
  { name: "MapPin", Icon: MapPin },
  { name: "Compass", Icon: Compass },
  { name: "Mountain", Icon: Mountain },
  { name: "Palmtree", Icon: Palmtree },
  { name: "Building2", Icon: Building2 },
  { name: "Tent", Icon: Tent },
  { name: "Ship", Icon: Ship },
  { name: "Backpack", Icon: Backpack },
  { name: "Camera", Icon: Camera },
  { name: "Heart", Icon: Heart },
];

const STATUSES: { value: TripStatus; label: string }[] = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

interface AddTripModalProps {
  isOpen: boolean;
  trip?: Trip | null;
  defaultGoalId?: string | null;  // preselect a goal when invoked from Goals page
  onClose: () => void;
  onSave: (data: {
    name: string;
    destination?: string;
    start_date?: string | null;
    end_date?: string | null;
    total_budget: number;
    color?: string;
    icon?: string;
    notes?: string;
    image_url?: string;
    status?: TripStatus;
    goal_id?: string | null;
    is_shared?: boolean;
  }) => Promise<void>;
}

export default function AddTripModal({ isOpen, trip, defaultGoalId, onClose, onSave }: AddTripModalProps) {
  const { user } = useAuth();
  const { goals } = useGoals();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    destination: "",
    start_date: "",
    end_date: "",
    total_budget: "",
    color: "#3b82f6",
    icon: "Plane",
    notes: "",
    image_url: "",
    status: "planning" as TripStatus,
    goal_id: "",
    is_shared: false,
  });

  useEffect(() => {
    if (trip) {
      setForm({
        name: trip.name,
        destination: trip.destination ?? "",
        start_date: trip.start_date ?? "",
        end_date: trip.end_date ?? "",
        total_budget: String(trip.total_budget ?? ""),
        color: trip.color,
        icon: trip.icon,
        notes: trip.notes ?? "",
        image_url: trip.image_url ?? "",
        status: trip.status,
        goal_id: trip.goal_id ?? "",
        is_shared: !!trip.is_shared,
      });
    } else {
      // Preselect goal if provided; also prefill name/budget/destination from goal
      const g = defaultGoalId ? goals.find((x) => x.id === defaultGoalId) : null;
      setForm({
        name: g?.name ?? "",
        destination: "",
        start_date: "",
        end_date: g?.target_date ?? "",
        total_budget: g ? String(g.target_amount ?? "") : "",
        color: g?.color ?? "#3b82f6",
        icon: "Plane",
        notes: "",
        image_url: g?.image_url ?? "",
        status: "planning",
        goal_id: defaultGoalId ?? "",
        is_shared: false,
      });
    }
  }, [trip, isOpen, defaultGoalId, goals]);

  const update = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    await onSave({
      name: form.name.trim(),
      destination: form.destination.trim() || undefined,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      total_budget: parseFloat(form.total_budget) || 0,
      color: form.color,
      icon: form.icon,
      notes: form.notes.trim() || undefined,
      image_url: form.image_url.trim() || undefined,
      status: form.status,
      goal_id: form.goal_id || null,
      is_shared: form.is_shared,
    });
    setLoading(false);
    onClose();
  };

  const input = "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 text-sm";

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={trip ? "Edit Trip" : "New Trip"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Trip name</label>
            <input type="text" required value={form.name} onChange={(e) => update("name", e.target.value)} className={input} placeholder="Japan 2026, Summer road trip..." />
          </div>

          {/* Destination */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1"><MapPin size={11} /> Destination</label>
            <input type="text" value={form.destination} onChange={(e) => update("destination", e.target.value)} className={input} placeholder="Tokyo, Kyoto, Osaka" />
          </div>

          {/* Budget */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1"><DollarSign size={11} /> Total budget</label>
            <input type="number" min="0" step="0.01" required value={form.total_budget} onChange={(e) => update("total_budget", e.target.value)} className={input} placeholder="3000.00" />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1"><Calendar size={11} /> Start date</label>
              <input type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1"><Calendar size={11} /> End date</label>
              <input type="date" value={form.end_date} onChange={(e) => update("end_date", e.target.value)} className={input} />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
            <div className="grid grid-cols-4 gap-2">
              {STATUSES.map((s) => (
                <button key={s.value} type="button" onClick={() => update("status", s.value)}
                  className={`py-2 px-2 rounded-lg text-xs font-medium border transition-all ${form.status === s.value ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 text-blue-700 dark:text-blue-300" : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Color</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => update("color", c)}
                  className={`w-7 h-7 rounded-lg transition-all ${form.color === c ? "ring-2 ring-offset-1 ring-gray-900 scale-110" : "hover:scale-105"}`}
                  style={{ background: c }} aria-label="Pick color" />
              ))}
            </div>
          </div>

          {/* Icon */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Icon</label>
            <div className="grid grid-cols-6 gap-1.5">
              {ICONS.map(({ name, Icon }) => (
                <button key={name} type="button" onClick={() => update("icon", name)}
                  className={`aspect-square rounded-lg border flex items-center justify-center transition-all ${form.icon === name ? "border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1"><ImageIcon size={11} /> Cover image URL <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span></label>
            <input type="url" value={form.image_url} onChange={(e) => update("image_url", e.target.value)} className={input} placeholder="https://..." />
            {form.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.image_url} alt="" className="mt-2 w-full h-32 object-cover rounded-lg border border-gray-100 dark:border-gray-800" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span></label>
            <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} className={input + " resize-none"} placeholder="Travel companions, booking refs..." />
          </div>

          {/* Link to Goal */}
          {user && goals.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1"><Target size={11} /> Link to a savings goal <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span></label>
              <select value={form.goal_id} onChange={(e) => update("goal_id", e.target.value)} className={input}>
                <option value="">— None —</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} · ${g.saved.toFixed(0)} / ${Number(g.target_amount).toFixed(0)}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Track this trip against a savings goal — progress shown on both pages.</p>
            </div>
          )}

          {/* Share toggle */}
          {user && (
            <button type="button" onClick={() => update("is_shared", !form.is_shared)}
              className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${form.is_shared ? "border-purple-300 bg-purple-50 dark:bg-purple-950/40" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${form.is_shared ? "bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400" : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"}`}>
                  <Users size={14} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Share with travel companions</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Invite people to co-plan and track</p>
                </div>
              </div>
              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${form.is_shared ? "bg-purple-600" : "bg-gray-200"}`}>
                <div className={`w-4 h-4 bg-white dark:bg-gray-900 rounded-full transition-transform ${form.is_shared ? "translate-x-4" : ""}`} />
              </div>
            </button>
          )}

          {/* Submit */}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 px-4 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 px-4 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-all hover:shadow-lg"
              style={{ background: form.color, boxShadow: loading ? undefined : `0 4px 12px ${form.color}33` }}>
              {loading ? "Saving..." : trip ? "Save changes" : form.is_shared ? "Create shared trip" : "Create trip"}
            </button>
          </div>
        </form>
    </BottomSheet>
  );
}
