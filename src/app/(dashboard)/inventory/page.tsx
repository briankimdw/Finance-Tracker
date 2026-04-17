"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import AddItemModal from "@/components/AddItemModal";
import EditItemModal from "@/components/EditItemModal";
import MarkSoldModal from "@/components/MarkSoldModal";
import FilterBar, { type Filters } from "@/components/FilterBar";
import { useItems, filterItems } from "@/hooks/useItems";
import type { Item } from "@/lib/types";

export default function InventoryPage() {
  const { items, loading, refetch, deleteItem } = useItems("active");
  const [showAddModal, setShowAddModal] = useState(false);
  const [soldItem, setSoldItem] = useState<Item | null>(null);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [filters, setFilters] = useState<Filters>({ search: "", category: "", platform: "", dateFrom: "", dateTo: "" });

  const filtered = filterItems(items, filters);
  const totalValue = filtered.reduce((sum, i) => sum + Number(i.purchase_price), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-400 text-sm mt-0.5">{filtered.length} items &middot; ${totalValue.toFixed(2)} invested</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors">
          <Plus size={18} /> Add Item
        </button>
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
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Platform</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Condition</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Notes</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">{items.length === 0 ? "No items in inventory. Add your first item!" : "No items match your filters."}</td></tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/80 even:bg-gray-50/40">
                    <td className="px-4 py-3.5 text-sm text-gray-900 font-medium">{item.name}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-500">{item.category}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-700">${Number(item.purchase_price).toFixed(2)}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-500">{new Date(item.purchase_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-500">{item.platform_bought}</td>
                    <td className="px-4 py-3.5"><span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{item.condition}</span></td>
                    <td className="px-4 py-3.5 text-sm text-gray-400 max-w-[150px] truncate">{item.notes || "--"}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditItem(item)} className="text-xs text-blue-600 hover:bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md transition-colors">Edit</button>
                        <button onClick={() => setSoldItem(item)} className="text-xs bg-green-50 text-green-600 hover:bg-green-100 border border-green-200 px-2.5 py-1 rounded-md transition-colors">Mark Sold</button>
                        <button onClick={() => deleteItem(item.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Delete item"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddItemModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onItemAdded={refetch} />
      <MarkSoldModal isOpen={!!soldItem} item={soldItem} onClose={() => setSoldItem(null)} onSold={refetch} />
      <EditItemModal isOpen={!!editItem} item={editItem} onClose={() => setEditItem(null)} onUpdated={refetch} />
    </div>
  );
}
