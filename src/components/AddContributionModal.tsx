"use client";

import { useState } from "react";
import { X, ArrowDown, ArrowUp } from "lucide-react";
import type { GoalWithStats } from "@/lib/types";

interface AddContributionModalProps {
  isOpen: boolean;
  goal: GoalWithStats | null;
  onClose: () => void;
  onSave: (goalId: string, amount: number, notes?: string, date?: string) => Promise<void>;
}

export default function AddContributionModal({ isOpen, goal, onClose, onSave }: AddContributionModalProps) {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  if (!isOpen || !goal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const value = parseFloat(amount) || 0;
    const signed = type === "withdraw" ? -value : value;
    await onSave(goal.id, signed, notes || undefined, date);
    setLoading(false);
    setAmount(""); setNotes(""); setType("deposit"); setDate(new Date().toISOString().split("T")[0]);
    onClose();
  };

  const inputClass = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  const value = parseFloat(amount) || 0;
  const newSaved = type === "withdraw" ? Math.max(0, goal.saved - value) : goal.saved + value;
  const newProgress = goal.target_amount > 0 ? Math.min(100, (newSaved / goal.target_amount) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl shadow-gray-900/10 border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Add Contribution</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={20} /></button>
        </div>

        {/* Goal preview */}
        <div className="px-5 pt-4">
          <div className="bg-gray-50 rounded-xl p-3.5">
            <p className="text-sm font-semibold text-gray-900">{goal.name}</p>
            <div className="flex items-baseline justify-between mt-1">
              <p className="text-xs text-gray-500">${goal.saved.toFixed(2)} of ${goal.target_amount.toFixed(2)}</p>
              <p className="text-xs font-medium" style={{ color: goal.color }}>{goal.progress.toFixed(0)}%</p>
            </div>
            <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full transition-all" style={{ width: `${goal.progress}%`, background: goal.color }} />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className={labelClass}>Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setType("deposit")}
                className={`flex items-center gap-2 p-2.5 rounded-lg text-sm font-medium transition-all ${type === "deposit" ? "bg-green-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                <ArrowDown size={16} /> Deposit
              </button>
              <button type="button" onClick={() => setType("withdraw")}
                className={`flex items-center gap-2 p-2.5 rounded-lg text-sm font-medium transition-all ${type === "withdraw" ? "bg-red-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                <ArrowUp size={16} /> Withdraw
              </button>
            </div>
          </div>

          <div>
            <label className={labelClass}>Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400">$</span>
              <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className={`${inputClass} pl-7`} placeholder="0.00" autoFocus />
            </div>
          </div>

          <div>
            <label className={labelClass}>Date *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="Optional" />
          </div>

          {/* Preview after */}
          {amount && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm">
              <p className="text-blue-700 font-medium">After this contribution:</p>
              <p className="text-blue-900 mt-1 font-semibold">${newSaved.toFixed(2)} saved · {newProgress.toFixed(1)}%</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className={`flex-1 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-lg ${type === "deposit" ? "bg-green-600 hover:bg-green-700 hover:shadow-green-600/20" : "bg-red-600 hover:bg-red-700 hover:shadow-red-600/20"}`}>
              {loading ? "Saving..." : type === "deposit" ? "Add Deposit" : "Withdraw"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
