"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { METALS } from "@/lib/metals";
import type { Holding } from "@/lib/types";

interface SellHoldingModalProps {
  isOpen: boolean;
  holding: Holding | null;
  onClose: () => void;
  onSold: (holdingId: string, cashAmount: number) => void;
}

export default function SellHoldingModal({ isOpen, holding, onClose, onSold }: SellHoldingModalProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    sale_price_per_oz: "",
    sale_date: new Date().toISOString().split("T")[0],
    fees: "",
    notes: "",
  });

  if (!isOpen || !holding) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const salePrice = parseFloat(form.sale_price_per_oz) || 0;
    const fees = parseFloat(form.fees) || 0;
    const cashAmount = salePrice * Number(holding.quantity) - fees;

    const { error } = await supabase
      .from("holdings")
      .update({
        status: "sold",
        sale_price_per_oz: salePrice,
        sale_date: form.sale_date,
        fees,
        notes: form.notes || holding.notes,
      })
      .eq("id", holding.id);

    setLoading(false);
    if (!error) {
      setForm({ sale_price_per_oz: "", sale_date: new Date().toISOString().split("T")[0], fees: "", notes: "" });
      onSold(holding.id, cashAmount);
      onClose();
    }
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  const inputClass = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  const salePrice = parseFloat(form.sale_price_per_oz) || 0;
  const fees = parseFloat(form.fees) || 0;
  const qty = Number(holding.quantity);
  const cost = qty * Number(holding.cost_per_oz);
  const revenue = qty * salePrice - fees;
  const profit = revenue - cost;
  const meta = METALS[holding.metal];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl shadow-gray-900/10 border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Sell Holding</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="px-5 pt-4">
          <div className="bg-gray-50 rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${meta.iconBg}`}>{meta.name}</span>
              <span className="text-xs text-gray-500 capitalize">{holding.type}</span>
            </div>
            <p className="text-gray-900 font-medium">{holding.description || `${qty} oz ${meta.name}`}</p>
            <p className="text-sm text-gray-500 mt-0.5">{qty} oz @ ${Number(holding.cost_per_oz).toFixed(2)}/oz &middot; Cost: ${cost.toFixed(2)}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Sale Price / oz *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400">$</span>
                <input type="number" step="0.01" min="0" value={form.sale_price_per_oz} onChange={(e) => update("sale_price_per_oz", e.target.value)} required className={`${inputClass} pl-7`} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Sale Date *</label>
              <input type="date" value={form.sale_date} onChange={(e) => update("sale_date", e.target.value)} required className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Fees</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400">$</span>
              <input type="number" step="0.01" min="0" value={form.fees} onChange={(e) => update("fees", e.target.value)} className={`${inputClass} pl-7`} placeholder="0.00" />
            </div>
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} className={`${inputClass} resize-none`} placeholder="Optional" />
          </div>
          {form.sale_price_per_oz && (
            <div className={`rounded-xl p-3.5 text-center font-semibold ${profit >= 0 ? "bg-green-50 text-green-600 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
              Est. Profit: {profit >= 0 ? "+" : ""}${profit.toFixed(2)} ({cost > 0 ? ((profit / cost) * 100).toFixed(1) : "0.0"}%)
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-green-600/20">{loading ? "Saving..." : "Sell Holding"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
