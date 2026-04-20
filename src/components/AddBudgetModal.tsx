"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { Budget, ExpenseCategory } from "@/lib/types";

const CATEGORIES: ExpenseCategory[] = [
  "Rent / Mortgage", "Utilities", "Groceries", "Dining Out", "Transportation",
  "Gas", "Insurance", "Subscriptions", "Entertainment", "Shopping", "Health",
  "Education", "Phone / Internet", "Personal Care", "Gifts", "Travel",
  "Debt Payment", "Savings", "Taxes", "Other",
];

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#84cc16"];

interface AddBudgetModalProps {
  isOpen: boolean;
  budget?: Budget | null;
  existingCategories?: string[];
  onClose: () => void;
  onSave: (data: { category: string; monthly_amount: number; color?: string }) => Promise<void>;
}

export default function AddBudgetModal({ isOpen, budget, existingCategories = [], onClose, onSave }: AddBudgetModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    category: "Groceries" as string,
    amount: "",
    color: COLORS[0],
  });

  useEffect(() => {
    if (budget) {
      setForm({ category: budget.category, amount: String(budget.monthly_amount), color: budget.color });
    } else if (isOpen) {
      const firstAvailable = CATEGORIES.find((c) => !existingCategories.includes(c)) || "Other";
      setForm({ category: firstAvailable, amount: "", color: COLORS[Math.floor(Math.random() * COLORS.length)] });
    }
  }, [budget, isOpen, existingCategories]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave({ category: form.category, monthly_amount: parseFloat(form.amount) || 0, color: form.color });
    setLoading(false);
    onClose();
  };

  const inputClass = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl shadow-gray-900/10 border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{budget ? "Edit Budget" : "New Budget"}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className={labelClass}>Category *</label>
            <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className={inputClass} disabled={!!budget}>
              {CATEGORIES.map((c) => {
                const taken = existingCategories.includes(c) && c !== budget?.category;
                return <option key={c} value={c} disabled={taken}>{c}{taken ? " (already set)" : ""}</option>;
              })}
            </select>
          </div>
          <div>
            <label className={labelClass}>Monthly Budget *</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400">$</span>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} required className={`${inputClass} pl-7`} placeholder="0.00" autoFocus />
            </div>
          </div>
          <div>
            <label className={labelClass}>Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm((p) => ({ ...p, color: c }))}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "border-white"}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-600/20">{loading ? "Saving..." : budget ? "Save" : "Create Budget"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
