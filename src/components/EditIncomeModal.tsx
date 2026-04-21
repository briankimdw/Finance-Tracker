"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Income, IncomeType, IncomeCategory, IncomeFrequency } from "@/lib/types";

const incomeCategories: IncomeCategory[] = [
  "Salary", "Wages", "Commission", "Bonus", "Freelance", "Gig Work",
  "Tutoring", "Content Creation", "Rental", "Investments", "Dividends", "Tips", "Other",
];
const frequencies: IncomeFrequency[] = ["Weekly", "Biweekly", "Monthly", "One-time"];

interface EditIncomeModalProps {
  isOpen: boolean;
  income: Income | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditIncomeModal({ isOpen, income, onClose, onUpdated }: EditIncomeModalProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type: "main" as IncomeType,
    source: "",
    category: "Salary" as IncomeCategory,
    amount: "",
    date: "",
    recurring: false,
    frequency: "Monthly" as IncomeFrequency,
    notes: "",
  });

  useEffect(() => {
    if (income) {
      setForm({
        type: income.type,
        source: income.source,
        category: income.category,
        amount: String(income.amount),
        date: income.date,
        recurring: income.recurring,
        frequency: income.frequency || "Monthly",
        notes: income.notes || "",
      });
    }
  }, [income]);

  if (!isOpen || !income) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("income").update({
      type: form.type,
      source: form.source,
      category: form.category,
      amount: parseFloat(form.amount),
      date: form.date,
      recurring: form.recurring,
      frequency: form.recurring ? form.frequency : "One-time",
      notes: form.notes || null,
    }).eq("id", income.id);
    setLoading(false);
    if (!error) {
      onUpdated();
      onClose();
    }
  };

  const update = (field: string, value: string | boolean) => setForm((prev) => ({ ...prev, [field]: value }));
  const inputClass = "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-gray-900/10 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Income</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className={labelClass}>Income Type *</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => update("type", "main")}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${form.type === "main" ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>Main Income</button>
              <button type="button" onClick={() => update("type", "side")}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${form.type === "side" ? "bg-purple-600 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>Side Income</button>
            </div>
          </div>
          <div>
            <label className={labelClass}>Source *</label>
            <input type="text" value={form.source} onChange={(e) => update("source", e.target.value)} required className={inputClass}
              placeholder={form.type === "main" ? "e.g. Day Job, Company Name" : "e.g. Freelance Design, Uber"} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Category *</label>
              <select value={form.category} onChange={(e) => update("category", e.target.value)} className={inputClass}>
                {incomeCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
                <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => update("amount", e.target.value)} required className={`${inputClass} pl-7`} placeholder="0.00" />
              </div>
            </div>
          </div>
          <div>
            <label className={labelClass}>Date *</label>
            <input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} required className={inputClass} />
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={form.recurring} onChange={(e) => update("recurring", e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <span className="text-sm text-gray-700 dark:text-gray-300">Recurring income</span>
          </div>
          {form.recurring && (
            <div>
              <label className={labelClass}>Frequency</label>
              <select value={form.frequency} onChange={(e) => update("frequency", e.target.value)} className={inputClass}>
                {frequencies.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} className={`${inputClass} resize-none`} placeholder="Any additional details..." />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading}
              className={`flex-1 font-medium py-2.5 px-4 rounded-xl transition-all disabled:opacity-50 text-white hover:shadow-lg ${form.type === "main" ? "bg-blue-600 hover:bg-blue-700 hover:shadow-blue-600/20" : "bg-purple-600 hover:bg-purple-700 hover:shadow-purple-600/20"}`}>
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
