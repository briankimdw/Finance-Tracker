"use client";

import { useState } from "react";
import { X, Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { todayEST } from "@/lib/dates";
import type { ItemCategory, BuyPlatform, ItemCondition } from "@/lib/types";

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

interface AddItemModalProps { isOpen: boolean; onClose: () => void; onItemAdded: () => void; }

export default function AddItemModal({ isOpen, onClose, onItemAdded }: AddItemModalProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [isFreeItem, setIsFreeItem] = useState(false);
  const [form, setForm] = useState({
    name: "", category: "Sneakers" as ItemCategory, purchase_price: "",
    purchase_date: todayEST(),
    platform_bought: "eBay" as BuyPlatform, condition: "New" as ItemCondition, notes: "",
  });

  if (!isOpen) return null;

  const handleFreeToggle = (free: boolean) => {
    setIsFreeItem(free);
    if (free) {
      setForm((prev) => ({ ...prev, purchase_price: "0", platform_bought: "Free / Already Owned" as BuyPlatform }));
    } else {
      setForm((prev) => ({ ...prev, purchase_price: "", platform_bought: "eBay" as BuyPlatform }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("items").insert({
      user_id: user?.id ?? null, name: form.name, category: form.category,
      purchase_price: isFreeItem ? 0 : parseFloat(form.purchase_price),
      purchase_date: form.purchase_date,
      platform_bought: form.platform_bought, condition: form.condition,
      notes: form.notes || null, status: "active",
    });
    setLoading(false);
    if (!error) {
      setForm({ name: "", category: "Sneakers", purchase_price: "", purchase_date: todayEST(), platform_bought: "eBay", condition: "New", notes: "" });
      setIsFreeItem(false);
      onItemAdded(); onClose();
    }
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  const inputClass = "w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow";
  const selectClass = "w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add New Item</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Free item toggle */}
          <button
            type="button"
            onClick={() => handleFreeToggle(!isFreeItem)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
              isFreeItem
                ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-800"
                : "border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700"
            }`}
          >
            <Gift size={20} className={isFreeItem ? "text-amber-500" : "text-gray-400 dark:text-gray-500"} />
            <div className="text-left">
              <p className="text-sm font-medium">{isFreeItem ? "Free / Already Owned" : "Selling a free or already-owned item?"}</p>
              <p className="text-xs opacity-70">{isFreeItem ? "Cost set to $0 — pure profit when sold!" : "Click to toggle — sets cost to $0"}</p>
            </div>
          </button>

          <div>
            <label className={labelClass}>Item Name *</label>
            <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)} required className={inputClass} placeholder="e.g. Nike Air Jordan 1 Retro High" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Category *</label>
              <select value={form.category} onChange={(e) => update("category", e.target.value)} className={selectClass}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Condition *</label>
              <select value={form.condition} onChange={(e) => update("condition", e.target.value)} className={selectClass}>
                {conditions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {!isFreeItem && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Purchase Price *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
                  <input type="number" step="0.01" min="0" value={form.purchase_price} onChange={(e) => update("purchase_price", e.target.value)} required className={`${inputClass} pl-7`} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Purchase Date *</label>
                <input type="date" value={form.purchase_date} onChange={(e) => update("purchase_date", e.target.value)} required className={inputClass} />
              </div>
            </div>
          )}
          {isFreeItem && (
            <div>
              <label className={labelClass}>Date Listed *</label>
              <input type="date" value={form.purchase_date} onChange={(e) => update("purchase_date", e.target.value)} required className={inputClass} />
            </div>
          )}
          {!isFreeItem && (
            <div>
              <label className={labelClass}>Platform Bought From *</label>
              <select value={form.platform_bought} onChange={(e) => update("platform_bought", e.target.value)} className={selectClass}>
                {buyPlatforms.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} className={`${inputClass} resize-none`} placeholder={isFreeItem ? "Where did you get it? Any details..." : "Any additional details..."} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-200">{loading ? "Adding..." : "Add Item"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
