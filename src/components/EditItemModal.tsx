"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Item, ItemCategory, BuyPlatform, ItemCondition } from "@/lib/types";

const categories: ItemCategory[] = [
  "Sneakers", "Clothing", "Electronics", "Toys & Collectibles",
  "Books", "Home & Garden", "Sports", "Accessories", "Vintage", "Other",
];
const buyPlatforms: BuyPlatform[] = [
  "eBay", "Facebook Marketplace", "Thrift Store", "Garage Sale",
  "Goodwill", "Craigslist", "OfferUp", "Mercari", "Wholesale", "Free / Already Owned", "Other",
];
const conditions: ItemCondition[] = [
  "New", "Like New", "Very Good", "Good", "Acceptable", "For Parts",
];

interface EditItemModalProps {
  isOpen: boolean;
  item: Item | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditItemModal({ isOpen, item, onClose, onUpdated }: EditItemModalProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "Sneakers" as ItemCategory,
    purchase_price: "",
    purchase_date: "",
    platform_bought: "eBay" as BuyPlatform,
    condition: "New" as ItemCondition,
    notes: "",
  });

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name,
        category: item.category,
        purchase_price: String(item.purchase_price),
        purchase_date: item.purchase_date,
        platform_bought: item.platform_bought,
        condition: item.condition,
        notes: item.notes || "",
      });
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("items").update({
      name: form.name,
      category: form.category,
      purchase_price: parseFloat(form.purchase_price),
      purchase_date: form.purchase_date,
      platform_bought: form.platform_bought,
      condition: form.condition,
      notes: form.notes || null,
    }).eq("id", item.id);
    setLoading(false);
    if (!error) {
      onUpdated();
      onClose();
    }
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  const inputClass = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-gray-900/10 border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Edit Item</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className={labelClass}>Item Name *</label>
            <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)} required className={inputClass} placeholder="e.g. Nike Air Jordan 1 Retro High" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Category *</label>
              <select value={form.category} onChange={(e) => update("category", e.target.value)} className={inputClass}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Condition *</label>
              <select value={form.condition} onChange={(e) => update("condition", e.target.value)} className={inputClass}>
                {conditions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Purchase Price *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400">$</span>
                <input type="number" step="0.01" min="0" value={form.purchase_price} onChange={(e) => update("purchase_price", e.target.value)} required className={`${inputClass} pl-7`} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Purchase Date *</label>
              <input type="date" value={form.purchase_date} onChange={(e) => update("purchase_date", e.target.value)} required className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Platform Bought From *</label>
            <select value={form.platform_bought} onChange={(e) => update("platform_bought", e.target.value)} className={inputClass}>
              {buyPlatforms.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} className={`${inputClass} resize-none`} placeholder="Any additional details..." />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-200">{loading ? "Saving..." : "Save Changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
