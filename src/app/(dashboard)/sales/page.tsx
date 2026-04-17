"use client";

import { useState } from "react";
import FilterBar, { type Filters } from "@/components/FilterBar";
import { useItems, filterItems } from "@/hooks/useItems";

export default function SalesPage() {
  const { items, loading } = useItems("sold");
  const [filters, setFilters] = useState<Filters>({ search: "", category: "", platform: "", dateFrom: "", dateTo: "" });

  const filtered = filterItems(items, filters);
  const totalRevenue = filtered.reduce((sum, i) => sum + Number(i.sale_price || 0), 0);
  const totalProfit = filtered.reduce((sum, i) => {
    return sum + Number(i.sale_price || 0) - Number(i.purchase_price) - Number(i.fees || 0) - Number(i.shipping_costs || 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sales History</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {filtered.length} sales &middot; ${totalRevenue.toFixed(2)} revenue &middot;{" "}
          <span className={totalProfit >= 0 ? "text-green-600" : "text-red-600"}>{totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(2)} profit</span>
        </p>
      </div>

      <FilterBar filters={filters} onChange={setFilters} />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Item</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Cost</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Sale Price</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Fees</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Profit</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">ROI</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Sale Date</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Sold On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">{items.length === 0 ? "No sales yet. Mark items as sold to see them here!" : "No sales match your filters."}</td></tr>
              ) : (
                filtered.map((item) => {
                  const cost = Number(item.purchase_price);
                  const sale = Number(item.sale_price || 0);
                  const fees = Number(item.fees || 0) + Number(item.shipping_costs || 0);
                  const profit = sale - cost - fees;
                  const roi = cost > 0 ? (profit / cost) * 100 : 0;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/80 even:bg-gray-50/40">
                      <td className="px-4 py-3.5 text-sm text-gray-900 font-medium">{item.name}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-500">{item.category}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-700">${cost.toFixed(2)}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-700">${sale.toFixed(2)}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-500">${fees.toFixed(2)}</td>
                      <td className="px-4 py-3.5 text-sm"><span className={`font-semibold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>{profit >= 0 ? "+" : ""}${profit.toFixed(2)}</span></td>
                      <td className="px-4 py-3.5 text-sm"><span className={`font-medium ${roi >= 0 ? "text-green-600" : "text-red-600"}`}>{roi.toFixed(1)}%</span></td>
                      <td className="px-4 py-3.5 text-sm text-gray-500">{item.sale_date ? new Date(item.sale_date).toLocaleDateString() : "--"}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-500">{item.platform_sold || "--"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
