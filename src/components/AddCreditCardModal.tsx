"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { CreditCard } from "@/lib/types";

const COLOR_OPTIONS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#06b6d4", "#1f2937",
];

interface AddCreditCardModalProps {
  isOpen: boolean;
  card?: CreditCard | null;
  onClose: () => void;
  onSave: (data: { name: string; last_four?: string; color?: string; credit_limit?: number | null; due_day?: number | null; statement_day?: number | null }) => Promise<void>;
}

export default function AddCreditCardModal({ isOpen, card, onClose, onSave }: AddCreditCardModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", last_four: "", color: COLOR_OPTIONS[0], credit_limit: "",
    due_day: "", statement_day: "",
  });

  useEffect(() => {
    if (card) {
      setForm({
        name: card.name,
        last_four: card.last_four || "",
        color: card.color || COLOR_OPTIONS[0],
        credit_limit: card.credit_limit ? String(card.credit_limit) : "",
        due_day: card.due_day ? String(card.due_day) : "",
        statement_day: card.statement_day ? String(card.statement_day) : "",
      });
    } else if (isOpen) {
      setForm({ name: "", last_four: "", color: COLOR_OPTIONS[0], credit_limit: "", due_day: "", statement_day: "" });
    }
  }, [card, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave({
      name: form.name,
      last_four: form.last_four || undefined,
      color: form.color,
      credit_limit: form.credit_limit ? parseFloat(form.credit_limit) : null,
      due_day: form.due_day ? parseInt(form.due_day) : null,
      statement_day: form.statement_day ? parseInt(form.statement_day) : null,
    });
    setLoading(false);
    onClose();
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  const inputClass = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl shadow-gray-900/10 border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{card ? "Edit Card" : "Add Credit Card"}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={20} /></button>
        </div>

        <div className="px-5 pt-5">
          <div className="rounded-xl p-4 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${form.color}, ${form.color}cc)` }}>
            <p className="text-xs opacity-80 uppercase tracking-wider">Card Preview</p>
            <p className="text-lg font-semibold mt-1 truncate">{form.name || "Card Name"}</p>
            <p className="text-sm font-mono mt-2 opacity-90">•••• •••• •••• {form.last_four || "0000"}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className={labelClass}>Card Name *</label>
            <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)} required className={inputClass} placeholder="e.g. Chase Sapphire" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Last 4 digits</label>
              <input type="text" maxLength={4} value={form.last_four} onChange={(e) => update("last_four", e.target.value.replace(/\D/g, ""))} className={inputClass} placeholder="1234" />
            </div>
            <div>
              <label className={labelClass}>Credit Limit</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400">$</span>
                <input type="number" step="0.01" min="0" value={form.credit_limit} onChange={(e) => update("credit_limit", e.target.value)} className={`${inputClass} pl-7`} placeholder="Optional" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Payment Due Day</label>
              <input type="number" min="1" max="28" value={form.due_day} onChange={(e) => update("due_day", e.target.value)} className={inputClass} placeholder="e.g. 15" />
              <p className="text-xs text-gray-400 mt-1">Day of month bill is due (1-28)</p>
            </div>
            <div>
              <label className={labelClass}>Statement Closes</label>
              <input type="number" min="1" max="28" value={form.statement_day} onChange={(e) => update("statement_day", e.target.value)} className={inputClass} placeholder="e.g. 22" />
              <p className="text-xs text-gray-400 mt-1">Day of month cycle ends</p>
            </div>
          </div>

          <div>
            <label className={labelClass}>Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button key={c} type="button" onClick={() => update("color", c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "border-white"}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-600/20">{loading ? "Saving..." : card ? "Save" : "Add Card"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
