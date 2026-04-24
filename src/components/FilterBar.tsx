"use client";

import { Search, X } from "lucide-react";
import type { ItemCategory } from "@/lib/types";

const categories: ItemCategory[] = [
  "Sneakers", "Clothing", "Electronics", "Toys & Collectibles",
  "Books", "Home & Garden", "Sports", "Accessories", "Vintage", "Other",
];
const allPlatforms = [
  "eBay", "StockX", "Mercari", "Poshmark", "Facebook Marketplace",
  "OfferUp", "Craigslist", "Amazon", "Depop", "Grailed",
  "Thrift Store", "Garage Sale", "Goodwill", "Wholesale", "Free / Already Owned", "Other",
];

export interface Filters { search: string; category: string; platform: string; dateFrom: string; dateTo: string; }
interface FilterBarProps { filters: Filters; onChange: (filters: Filters) => void; }

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  const update = (field: keyof Filters, value: string) => onChange({ ...filters, [field]: value });
  const hasFilters = filters.search || filters.category || filters.platform || filters.dateFrom || filters.dateTo;
  const clearFilters = () => onChange({ search: "", category: "", platform: "", dateFrom: "", dateTo: "" });
  const inputClass = "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500";

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" />
          <input type="text" value={filters.search} onChange={(e) => update("search", e.target.value)} placeholder="Search items..." className={`${inputClass} w-full pl-9`} />
        </div>
        <select value={filters.category} onChange={(e) => update("category", e.target.value)} className={inputClass}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filters.platform} onChange={(e) => update("platform", e.target.value)} className={inputClass}>
          <option value="">All Platforms</option>
          {allPlatforms.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="date" value={filters.dateFrom} onChange={(e) => update("dateFrom", e.target.value)} className={inputClass} />
        <input type="date" value={filters.dateTo} onChange={(e) => update("dateTo", e.target.value)} className={inputClass} />
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
            <X size={14} /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
