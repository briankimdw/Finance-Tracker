"use client";

import { useState, useEffect } from "react";
import { X, Wallet, Banknote, PiggyBank, Coins } from "lucide-react";
import type { CashAccount, CashAccountType } from "@/lib/types";

const COLOR_OPTIONS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b",
  "#06b6d4", "#84cc16", "#ec4899", "#1f2937",
];

const TYPE_META: Record<CashAccountType, { label: string; icon: typeof Wallet }> = {
  checking: { label: "Checking", icon: Wallet },
  savings: { label: "Savings", icon: PiggyBank },
  cash: { label: "Cash", icon: Banknote },
  other: { label: "Other", icon: Coins },
};

interface AddCashAccountModalProps {
  isOpen: boolean;
  account?: CashAccount | null;
  onClose: () => void;
  onSave: (data: { name: string; type: CashAccountType; balance: number; color?: string }) => Promise<void>;
}

export default function AddCashAccountModal({ isOpen, account, onClose, onSave }: AddCashAccountModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "checking" as CashAccountType,
    balance: "",
    color: COLOR_OPTIONS[0],
  });

  useEffect(() => {
    if (account) {
      setForm({
        name: account.name,
        type: account.type,
        balance: String(account.balance),
        color: account.color || COLOR_OPTIONS[0],
      });
    } else if (isOpen) {
      setForm({ name: "", type: "checking", balance: "", color: COLOR_OPTIONS[0] });
    }
  }, [account, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave({
      name: form.name,
      type: form.type,
      balance: parseFloat(form.balance) || 0,
      color: form.color,
    });
    setLoading(false);
    onClose();
  };

  const inputClass = "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl shadow-gray-900/10 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{account ? "Edit Account" : "Add Account"}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className={labelClass}>Account Type *</label>
            <div className="grid grid-cols-4 gap-2">
              {(["checking", "savings", "cash", "other"] as CashAccountType[]).map((t) => {
                const Icon = TYPE_META[t].icon;
                return (
                  <button key={t} type="button" onClick={() => setForm((p) => ({ ...p, type: t }))}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-lg text-xs font-medium transition-all ${
                      form.type === t ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}>
                    <Icon size={16} />
                    {TYPE_META[t].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={labelClass}>Account Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required className={inputClass} placeholder="e.g. Chase Checking, My Wallet" />
          </div>

          <div>
            <label className={labelClass}>Current Balance *</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
              <input type="number" step="0.01" value={form.balance} onChange={(e) => setForm((p) => ({ ...p, balance: e.target.value }))} required className={`${inputClass} pl-7`} placeholder="0.00" />
            </div>
          </div>

          <div>
            <label className={labelClass}>Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button key={c} type="button" onClick={() => setForm((p) => ({ ...p, color: c }))}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "border-white"}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-600/20">{loading ? "Saving..." : account ? "Save" : "Add Account"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
