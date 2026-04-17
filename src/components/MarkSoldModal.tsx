"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Item, SellPlatform } from "@/lib/types";

const sellPlatforms: SellPlatform[] = [
  "eBay", "StockX", "Mercari", "Poshmark", "Facebook Marketplace",
  "OfferUp", "Craigslist", "Amazon", "Depop", "Grailed", "Other",
];

interface MarkSoldModalProps { isOpen: boolean; item: Item | null; onClose: () => void; onSold: () => void; }

export default function MarkSoldModal({ isOpen, item, onClose, onSold }: MarkSoldModalProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    sale_price: "", sale_date: new Date().toISOString().split("T")[0],
    platform_sold: "eBay" as SellPlatform, fees: "", shipping_costs: "",
  });

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("items").update({
      status: "sold", sale_price: parseFloat(form.sale_price), sale_date: form.sale_date,
      platform_sold: form.platform_sold, fees: parseFloat(form.fees || "0"),
      shipping_costs: parseFloat(form.shipping_costs || "0"),
    }).eq("id", item.id);
    setLoading(false);
    if (!error) {
      setForm({ sale_price: "", sale_date: new Date().toISOString().split("T")[0], platform_sold: "eBay", fees: "", shipping_costs: "" });
      onSold(); onClose();
    }
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  const salePrice = parseFloat(form.sale_price) || 0;
  const fees = parseFloat(form.fees) || 0;
  const shipping = parseFloat(form.shipping_costs) || 0;
  const profit = salePrice - item.purchase_price - fees - shipping;
  const inputClass = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl shadow-gray-900/10 border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Mark as Sold</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="px-5 pt-4">
          <div className="bg-gray-50 rounded-xl p-3.5">
            <p className="text-gray-900 font-medium">{item.name}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {Number(item.purchase_price) === 0 ? "Free / Already Owned" : `Purchased for $${item.purchase_price.toFixed(2)}`} &middot; {new Date(item.purchase_date).toLocaleDateString()}
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Sale Price *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400">$</span>
                <input type="number" step="0.01" min="0" value={form.sale_price} onChange={(e) => update("sale_price", e.target.value)} required className={`${inputClass} pl-7`} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Sale Date *</label>
              <input type="date" value={form.sale_date} onChange={(e) => update("sale_date", e.target.value)} required className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Platform Sold On *</label>
            <select value={form.platform_sold} onChange={(e) => update("platform_sold", e.target.value)} className={inputClass}>
              {sellPlatforms.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Fees</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400">$</span>
                <input type="number" step="0.01" min="0" value={form.fees} onChange={(e) => update("fees", e.target.value)} className={`${inputClass} pl-7`} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Shipping Costs</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400">$</span>
                <input type="number" step="0.01" min="0" value={form.shipping_costs} onChange={(e) => update("shipping_costs", e.target.value)} className={`${inputClass} pl-7`} placeholder="0.00" />
              </div>
            </div>
          </div>
          {form.sale_price && (
            <div className={`rounded-xl p-3.5 text-center font-semibold ${profit >= 0 ? "bg-green-50 text-green-600 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
              Estimated Profit: {profit >= 0 ? "+" : ""}${profit.toFixed(2)}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-green-600/20">{loading ? "Saving..." : "Mark as Sold"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
