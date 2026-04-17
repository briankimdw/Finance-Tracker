"use client";

import { useState } from "react";
import { X, Pin, Wallet, Banknote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useCashAccounts } from "@/hooks/useCashAccounts";
import { adjustAccountBalance } from "@/lib/updateBalance";
import type { IncomeType, IncomeCategory, IncomeFrequency } from "@/lib/types";

const incomeCategories: IncomeCategory[] = [
  "Salary", "Wages", "Commission", "Bonus", "Freelance", "Gig Work",
  "Tutoring", "Content Creation", "Rental", "Investments", "Dividends", "Tips", "Other",
];
const frequencies: IncomeFrequency[] = ["Weekly", "Biweekly", "Monthly", "One-time"];

interface AddIncomeModalProps {
  isOpen: boolean; onClose: () => void; onAdded: () => void;
  onSavePin?: (data: { user_id: string | null; type: IncomeType; source: string; category: string; amount: number; frequency: IncomeFrequency | null }) => void;
}

export default function AddIncomeModal({ isOpen, onClose, onAdded, onSavePin }: AddIncomeModalProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const { accounts } = useCashAccounts();
  const [loading, setLoading] = useState(false);
  const [depositTo, setDepositTo] = useState<string>("");
  const [form, setForm] = useState({
    type: "main" as IncomeType, source: "", category: "Salary" as IncomeCategory,
    amount: "", date: new Date().toISOString().split("T")[0],
    recurring: false, frequency: "Monthly" as IncomeFrequency, notes: "",
  });

  if (!isOpen) return null;

  // Auto-select first account if none selected
  const selectedAccount = depositTo || (accounts.length > 0 ? accounts[0].id : "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("income").insert({
      user_id: user?.id ?? null, type: form.type, source: form.source, category: form.category,
      amount: parseFloat(form.amount), date: form.date, recurring: form.recurring,
      frequency: form.recurring ? form.frequency : "One-time", notes: form.notes || null,
    });
    setLoading(false);
    if (!error) {
      // Deposit to selected account
      if (selectedAccount) {
        await adjustAccountBalance(selectedAccount, parseFloat(form.amount));
      }
      setForm({ type: "main", source: "", category: "Salary", amount: "", date: new Date().toISOString().split("T")[0], recurring: false, frequency: "Monthly", notes: "" });
      setDepositTo("");
      onAdded(); onClose();
    }
  };

  const handlePin = () => {
    if (onSavePin && form.source && form.amount) {
      onSavePin({ user_id: user?.id ?? null, type: form.type, source: form.source, category: form.category, amount: parseFloat(form.amount), frequency: form.recurring ? form.frequency : null });
    }
  };

  const update = (field: string, value: string | boolean) => setForm((prev) => ({ ...prev, [field]: value }));
  const inputClass = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-gray-900/10 border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Add Income</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className={labelClass}>Income Type *</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => update("type", "main")}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${form.type === "main" ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Main Income</button>
              <button type="button" onClick={() => update("type", "side")}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${form.type === "side" ? "bg-purple-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Side Income</button>
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
                <span className="absolute left-3 top-2.5 text-gray-400">$</span>
                <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => update("amount", e.target.value)} required className={`${inputClass} pl-7`} placeholder="0.00" />
              </div>
            </div>
          </div>
          <div>
            <label className={labelClass}>Date *</label>
            <input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} required className={inputClass} />
          </div>

          {/* Deposit to account picker */}
          <div>
            <label className={labelClass}>Deposit to *</label>
            {accounts.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2.5">No accounts yet — add one in the Cards page first. Income will still be recorded.</p>
            ) : (
              <div className="space-y-1.5">
                {accounts.map((acc) => {
                  const isSelected = selectedAccount === acc.id;
                  const isChecking = acc.type === "checking";
                  const isCash = acc.type === "cash";
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setDepositTo(acc.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        isSelected ? "border-blue-400 bg-blue-50/50" : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${acc.color}20`, color: acc.color }}>
                        {isCash ? <Banknote size={16} /> : <Wallet size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{acc.name}</p>
                        <p className="text-xs text-gray-400 capitalize">{acc.type} &middot; ${Number(acc.balance).toFixed(2)}</p>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}
                      {!isSelected && isChecking && (
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Default</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={form.recurring} onChange={(e) => update("recurring", e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <span className="text-sm text-gray-700">Recurring income</span>
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
            {onSavePin && form.source && form.amount && (
              <button type="button" onClick={handlePin}
                className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-medium py-2.5 px-3 rounded-xl text-sm" title="Save as quick-add">
                <Pin size={14} /> Pin
              </button>
            )}
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading}
              className={`flex-1 font-medium py-2.5 px-4 rounded-xl transition-all disabled:opacity-50 text-white hover:shadow-lg ${form.type === "main" ? "bg-blue-600 hover:bg-blue-700 hover:shadow-blue-600/20" : "bg-purple-600 hover:bg-purple-700 hover:shadow-purple-600/20"}`}>
              {loading ? "Adding..." : "Add Income"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
