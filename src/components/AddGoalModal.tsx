"use client";

import { useState, useEffect } from "react";
import {
  Target, Plane, Home, Car, Smartphone, Gift, GraduationCap,
  Heart, Briefcase, Music, Camera, Gamepad2, ShoppingBag, Plus,
  Tv, Bike, Trophy, Sparkles, Link as LinkIcon, Image as ImageIcon, Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { Goal, GoalCategory } from "@/lib/types";

const COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#06b6d4", "#84cc16",
  "#1f2937", "#f97316",
];

const ICONS = [
  { name: "Target", Icon: Target },
  { name: "Plane", Icon: Plane },
  { name: "Home", Icon: Home },
  { name: "Car", Icon: Car },
  { name: "Smartphone", Icon: Smartphone },
  { name: "Gift", Icon: Gift },
  { name: "GraduationCap", Icon: GraduationCap },
  { name: "Heart", Icon: Heart },
  { name: "Briefcase", Icon: Briefcase },
  { name: "Music", Icon: Music },
  { name: "Camera", Icon: Camera },
  { name: "Gamepad2", Icon: Gamepad2 },
  { name: "ShoppingBag", Icon: ShoppingBag },
  { name: "Tv", Icon: Tv },
  { name: "Bike", Icon: Bike },
  { name: "Trophy", Icon: Trophy },
  { name: "Sparkles", Icon: Sparkles },
];

const CATEGORIES: { value: GoalCategory; label: string }[] = [
  { value: "savings", label: "Savings" },
  { value: "purchase", label: "Purchase" },
  { value: "travel", label: "Travel" },
  { value: "emergency", label: "Emergency Fund" },
  { value: "investment", label: "Investment" },
  { value: "other", label: "Other" },
];

interface AddGoalModalProps {
  isOpen: boolean;
  goal?: Goal | null;
  onClose: () => void;
  onSave: (data: { name: string; target_amount: number; category?: GoalCategory; color?: string; icon?: string; notes?: string; target_date?: string | null; url?: string; image_url?: string; is_shared?: boolean }) => Promise<void>;
}

export default function AddGoalModal({ isOpen, goal, onClose, onSave }: AddGoalModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    target_amount: "",
    category: "savings" as GoalCategory,
    color: COLORS[0],
    icon: "Target",
    notes: "",
    target_date: "",
    url: "",
    image_url: "",
    is_shared: false,
  });

  useEffect(() => {
    if (goal) {
      setForm({
        name: goal.name,
        target_amount: String(goal.target_amount),
        category: goal.category,
        color: goal.color,
        icon: goal.icon,
        notes: goal.notes || "",
        target_date: goal.target_date || "",
        url: goal.url || "",
        image_url: goal.image_url || "",
        is_shared: goal.is_shared || false,
      });
    } else if (isOpen) {
      setForm({ name: "", target_amount: "", category: "savings", color: COLORS[0], icon: "Target", notes: "", target_date: "", url: "", image_url: "", is_shared: false });
    }
  }, [goal, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave({
      name: form.name,
      target_amount: parseFloat(form.target_amount) || 0,
      category: form.category,
      color: form.color,
      icon: form.icon,
      notes: form.notes,
      target_date: form.target_date || null,
      url: form.url || undefined,
      image_url: form.image_url || undefined,
      is_shared: form.is_shared,
    });
    setLoading(false);
    onClose();
  };

  const update = (field: string, value: string | boolean) => setForm((p) => ({ ...p, [field]: value }));
  const inputClass = "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  const SelectedIcon = ICONS.find((i) => i.name === form.icon)?.Icon || Target;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={goal ? "Edit Goal" : "New Goal"} size="lg">
      <div className="space-y-4">
        {/* Preview */}
        <div>
          <div className="rounded-xl p-4 border-2 border-dashed border-gray-200 dark:border-gray-800 flex items-center gap-3">
            {form.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.image_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${form.color}20`, color: form.color }}>
                <SelectedIcon size={22} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{form.name || "Goal name"}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">${form.target_amount || "0"} target</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Shared toggle (only when signed in, and only for new goals or goals owned by user) */}
          {user && (!goal || goal.user_id === user.id) && (
            <button
              type="button"
              onClick={() => update("is_shared", !form.is_shared)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                form.is_shared ? "border-purple-400 bg-purple-50 dark:bg-purple-950/40 text-purple-800" : "border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700"
              }`}
            >
              <Users size={18} className={form.is_shared ? "text-purple-600 dark:text-purple-400" : "text-gray-400 dark:text-gray-500"} />
              <div className="text-left flex-1">
                <p className="text-sm font-medium">{form.is_shared ? "Shared Goal — invite others" : "Share with others?"}</p>
                <p className="text-xs opacity-70">{form.is_shared ? "Everyone can contribute. You stay the owner." : "Toggle to track a goal together with friends/family"}</p>
              </div>
            </button>
          )}

          <div>
            <label className={labelClass}>Goal Name *</label>
            <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)} required className={inputClass} placeholder="e.g. New MacBook, Trip to Japan" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Target Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
                <input type="number" step="0.01" min="0" value={form.target_amount} onChange={(e) => update("target_amount", e.target.value)} required className={`${inputClass} pl-7`} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Category</label>
              <select value={form.category} onChange={(e) => update("category", e.target.value)} className={inputClass}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Target Date</label>
            <input type="date" value={form.target_date} onChange={(e) => update("target_date", e.target.value)} className={inputClass} />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Optional — when you want to reach this goal</p>
          </div>

          <div>
            <label className={labelClass}>Icon</label>
            <div className="grid grid-cols-9 gap-2">
              {ICONS.map(({ name, Icon }) => (
                <button key={name} type="button" onClick={() => update("icon", name)}
                  className={`aspect-square rounded-lg flex items-center justify-center transition-all ${form.icon === name ? "ring-2 ring-offset-1 ring-gray-400" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                  style={form.icon === name ? { background: `${form.color}20`, color: form.color } : { color: "#6b7280" }}>
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => update("color", c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "border-white"}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label className={labelClass}>
              <span className="flex items-center gap-1.5">
                <ImageIcon size={13} className="text-gray-400 dark:text-gray-500" />
                Image URL
              </span>
            </label>
            <input type="url" value={form.image_url} onChange={(e) => update("image_url", e.target.value)} className={inputClass} placeholder="https://..." />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Paste an image link — it&apos;ll show on the goal card instead of the icon</p>
          </div>

          {/* Product link */}
          <div>
            <label className={labelClass}>
              <span className="flex items-center gap-1.5">
                <LinkIcon size={13} className="text-gray-400 dark:text-gray-500" />
                Link
              </span>
            </label>
            <input type="url" value={form.url} onChange={(e) => update("url", e.target.value)} className={inputClass} placeholder="https://apple.com/macbook-pro" />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Link to the product or inspiration</p>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} className={`${inputClass} resize-none`} placeholder="Optional details..." />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-600/20 flex items-center justify-center gap-1">
              {loading ? "Saving..." : (<>{goal ? "Save" : <><Plus size={16} /> Create Goal</>}</>)}
            </button>
          </div>
        </form>
      </div>
    </BottomSheet>
  );
}
