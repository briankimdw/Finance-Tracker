"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { METALS, METAL_KEYS, FORM_TYPES } from "@/lib/metals";
import { todayEST } from "@/lib/dates";
import type { Holding, MetalType, HoldingForm } from "@/lib/types";

interface EditHoldingModalProps {
  isOpen: boolean;
  holding: Holding | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditHoldingModal({ isOpen, holding, onClose, onUpdated }: EditHoldingModalProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    metal: "gold" as MetalType,
    type: "coin" as HoldingForm,
    description: "",
    quantity: "",
    cost_per_oz: "",
    purchase_date: todayEST(),
    notes: "",
  });

  useEffect(() => {
    if (holding) {
      setForm({
        metal: holding.metal,
        type: holding.type,
        description: holding.description || "",
        quantity: String(holding.quantity),
        cost_per_oz: String(holding.cost_per_oz),
        purchase_date: holding.purchase_date || todayEST(),
        notes: holding.notes || "",
      });
    }
  }, [holding]);

  if (!isOpen || !holding) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase
      .from("holdings")
      .update({
        metal: form.metal,
        type: form.type,
        description: form.description,
        quantity: parseFloat(form.quantity) || 0,
        cost_per_oz: parseFloat(form.cost_per_oz) || 0,
        purchase_date: form.purchase_date,
        notes: form.notes,
      })
      .eq("id", holding.id);
    setLoading(false);
    if (!error) {
      onUpdated();
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Holding</h2>
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
              <input type="number" step="0.0001" min="0" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} required className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <input type="text" value={form.description} onChange={(e) => update("description", e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Cost / oz *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
                <input type="number" step="0.01" min="0" value={form.cost_per_oz} onChange={(e) => update("cost_per_oz", e.target.value)} required className={`${inputClass} pl-7`} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Purchase Date *</label>
              <input type="date" value={form.purchase_date} onChange={(e) => update("purchase_date", e.target.value)} required className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-600/20">{loading ? "Saving..." : "Save Changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
