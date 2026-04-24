"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { METALS, METAL_KEYS, FORM_TYPES } from "@/lib/metals";
import { todayEST } from "@/lib/dates";
import type { MetalType, HoldingForm } from "@/lib/types";

interface AddHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: (holdingId: string) => void;
}

export default function AddHoldingModal({ isOpen, onClose, onAdded }: AddHoldingModalProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [costMode, setCostMode] = useState<"per_oz" | "total">("per_oz");
  const [form, setForm] = useState({
    metal: "gold" as MetalType,
    type: "coin" as HoldingForm,
    description: "",
    quantity: "",
    cost_input: "",
    purchase_date: todayEST(),
    notes: "",
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const qty = parseFloat(form.quantity) || 0;
    const costInput = parseFloat(form.cost_input) || 0;
    const costPerOz = costMode === "total" && qty > 0 ? costInput / qty : costInput;

    const { data, error } = await supabase
      .from("holdings")
      .insert({
        user_id: user?.id ?? null,
        metal: form.metal,
        type: form.type,
        description: form.description,
        quantity: qty,
        cost_per_oz: costPerOz,
        purchase_date: form.purchase_date,
        notes: form.notes,
        status: "active",
      })
      .select()
      .single();

    setLoading(false);
    if (!error && data) {
      setForm({ metal: "gold", type: "coin", description: "", quantity: "", cost_input: "", purchase_date: todayEST(), notes: "" });
      onAdded(data.id);
      onClose();
    }
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  const inputClass = "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-gray-900/10 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Holding</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className={labelClass}>Metal *</label>
            <div className="grid grid-cols-4 gap-2">
              {METAL_KEYS.map((m) => (
                <button key={m} type="button" onClick={() => update("metal", m)}
                  className={`py-2.5 px-2 rounded-lg text-sm font-medium transition-all ${
                    form.metal === m
                      ? `${METALS[m].iconBg} ring-2 ring-offset-1` + (m === "gold" ? " ring-amber-400" : m === "silver" ? " ring-slate-400" : m === "platinum" ? " ring-zinc-400" : " ring-stone-400")
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}>
                  {METALS[m].name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Type *</label>
              <select value={form.type} onChange={(e) => update("type", e.target.value)} className={inputClass}>
                {FORM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Quantity (oz) *</label>
              <input type="number" step="0.0001" min="0" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} required className={inputClass} placeholder="1.0" />
            </div>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <input type="text" value={form.description} onChange={(e) => update("description", e.target.value)} className={inputClass} placeholder="e.g. American Gold Eagle 2024" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cost *</label>
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5">
                <button type="button" onClick={() => setCostMode("per_oz")} className={`px-2 py-0.5 text-xs rounded ${costMode === "per_oz" ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400"}`}>Per oz</button>
                <button type="button" onClick={() => setCostMode("total")} className={`px-2 py-0.5 text-xs rounded ${costMode === "total" ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400"}`}>Total paid</button>
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
              <input type="number" step="0.01" min="0" value={form.cost_input} onChange={(e) => update("cost_input", e.target.value)} required className={`${inputClass} pl-7`} placeholder="0.00" />
            </div>
            {costMode === "total" && form.cost_input && form.quantity && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">= ${(parseFloat(form.cost_input) / parseFloat(form.quantity)).toFixed(2)} per oz</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Purchase Date *</label>
            <input type="date" value={form.purchase_date} onChange={(e) => update("purchase_date", e.target.value)} required className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} className={`${inputClass} resize-none`} placeholder="Optional" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-600/20">{loading ? "Adding..." : "Add Holding"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
