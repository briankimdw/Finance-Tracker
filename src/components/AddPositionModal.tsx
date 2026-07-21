"use client";

import { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import type { InvestmentAccount, InvestmentPosition } from "@/lib/types";

interface AddPositionModalProps {
  isOpen: boolean;
  position?: InvestmentPosition | null;
  accounts: InvestmentAccount[];
  defaultAccountId?: string;
  onClose: () => void;
  onSave: (data: { id?: string; account_id: string; symbol: string; quantity: number; avg_cost: number; last_price: number | null }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export default function AddPositionModal({ isOpen, position, accounts, defaultAccountId, onClose, onSave, onDelete }: AddPositionModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ account_id: "", symbol: "", quantity: "", avg_cost: "", last_price: "" });

  useEffect(() => {
    if (position) {
      setForm({
        account_id: position.account_id,
        symbol: position.symbol,
        quantity: String(position.quantity),
        avg_cost: String(position.avg_cost),
        last_price: position.last_price !== null ? String(position.last_price) : "",
      });
    } else if (isOpen) {
      setForm({ account_id: defaultAccountId || accounts[0]?.id || "", symbol: "", quantity: "", avg_cost: "", last_price: "" });
    }
  }, [position, isOpen, defaultAccountId, accounts]);

  if (!isOpen) return null;

  const qty = parseFloat(form.quantity) || 0;
  const cost = parseFloat(form.avg_cost) || 0;
  const price = form.last_price !== "" ? parseFloat(form.last_price) : NaN;
  const value = qty * (Number.isFinite(price) ? price : cost);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.account_id || !form.symbol.trim()) return;
    setLoading(true);
    await onSave({
      id: position?.id,
      account_id: form.account_id,
      symbol: form.symbol.trim().toUpperCase(),
      quantity: qty,
      avg_cost: cost,
      last_price: Number.isFinite(price) ? price : null,
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{position ? `Edit ${position.symbol}` : "Add Position"}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className={labelClass}>Account *</label>
            <select value={form.account_id} onChange={(e) => setForm((p) => ({ ...p, account_id: e.target.value }))} required className={inputClass}>
              <option value="">Select account...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nickname || a.account_type}{a.mask ? ` ••${a.mask}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Symbol *</label>
              <input type="text" value={form.symbol} onChange={(e) => setForm((p) => ({ ...p, symbol: e.target.value.toUpperCase() }))} required className={`${inputClass} uppercase`} placeholder="AAPL" />
            </div>
            <div>
              <label className={labelClass}>Shares *</label>
              <input type="number" step="any" min="0" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} required className={inputClass} placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Avg Cost / Share *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
                <input type="number" step="any" min="0" value={form.avg_cost} onChange={(e) => setForm((p) => ({ ...p, avg_cost: e.target.value }))} required className={`${inputClass} pl-7`} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Current Price</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
                <input type="number" step="any" min="0" value={form.last_price} onChange={(e) => setForm((p) => ({ ...p, last_price: e.target.value }))} className={`${inputClass} pl-7`} placeholder="auto" />
              </div>
            </div>
          </div>

          {qty > 0 && (
            <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
              <span className="text-gray-500 dark:text-gray-400">Market value</span>
              <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100">${value.toFixed(2)}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            {position && onDelete && (
              <button
                type="button"
                onClick={async () => { setLoading(true); await onDelete(position.id); setLoading(false); onClose(); }}
                className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                title="Delete position"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-teal-600/20">
              {loading ? "Saving..." : position ? "Save" : "Add Position"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
