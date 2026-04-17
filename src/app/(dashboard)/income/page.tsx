"use client";

import { useState } from "react";
import { Plus, Trash2, Search, X, Pencil } from "lucide-react";
import AddIncomeModal from "@/components/AddIncomeModal";
import EditIncomeModal from "@/components/EditIncomeModal";
import QuickAdd from "@/components/QuickAdd";
import { useIncome, filterIncomes, useSavedIncome } from "@/hooks/useIncome";
import type { IncomeCategory, Income } from "@/lib/types";

const incomeCategories: IncomeCategory[] = [
  "Salary", "Wages", "Commission", "Bonus", "Freelance", "Gig Work",
  "Tutoring", "Content Creation", "Rental", "Investments", "Dividends", "Tips", "Other",
];

export default function IncomePage() {
  const { incomes, loading, refetch, deleteIncome } = useIncome();
  const { savedIncomes, savePinned, deleteSaved, quickAdd } = useSavedIncome();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editIncome, setEditIncome] = useState<Income | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "main" | "side">("all");
  const [filters, setFilters] = useState({ search: "", category: "", type: "", dateFrom: "", dateTo: "" });

  const effectiveFilters = { ...filters, type: activeTab === "all" ? filters.type : activeTab };
  const filtered = filterIncomes(incomes, effectiveFilters);

  const totalMain = filtered.filter((i) => i.type === "main").reduce((sum, i) => sum + Number(i.amount), 0);
  const totalSide = filtered.filter((i) => i.type === "side").reduce((sum, i) => sum + Number(i.amount), 0);
  const totalAll = totalMain + totalSide;

  const updateFilter = (field: string, value: string) => setFilters((prev) => ({ ...prev, [field]: value }));
  const hasFilters = filters.search || filters.category || filters.dateFrom || filters.dateTo;
  const clearFilters = () => setFilters({ search: "", category: "", type: "", dateFrom: "", dateTo: "" });

  const handleQuickAdd = async (saved: Parameters<typeof quickAdd>[0]) => {
    await quickAdd(saved);
    refetch();
  };

  const inputClass = "bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Income</h1>
          <p className="text-gray-400 text-sm mt-0.5">{filtered.length} entries &middot; ${totalAll.toFixed(2)} total</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors">
          <Plus size={18} /> Add Income
        </button>
      </div>

      <QuickAdd savedIncomes={savedIncomes} onQuickAdd={handleQuickAdd} onDelete={deleteSaved} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <span className="text-sm text-gray-500">Total Income</span>
          <p className="text-2xl font-bold text-gray-900 mt-1">${totalAll.toFixed(2)}</p>
        </div>
        <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm">
          <span className="text-sm text-blue-600">Main Income</span>
          <p className="text-2xl font-bold text-gray-900 mt-1">${totalMain.toFixed(2)}</p>
        </div>
        <div className="bg-white border border-purple-100 rounded-xl p-4 shadow-sm">
          <span className="text-sm text-purple-600">Side Income</span>
          <p className="text-2xl font-bold text-gray-900 mt-1">${totalSide.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["all", "main", "side"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab
              ? tab === "main" ? "bg-blue-600 text-white shadow-sm" : tab === "side" ? "bg-purple-600 text-white shadow-sm" : "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-900"}`}>{tab === "all" ? "All" : tab === "main" ? "Main" : "Side"}</button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input type="text" value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="Search by source..." className={`${inputClass} w-full pl-9`} />
          </div>
          <select value={filters.category} onChange={(e) => updateFilter("category", e.target.value)} className={inputClass}>
            <option value="">All Categories</option>
            {incomeCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="date" value={filters.dateFrom} onChange={(e) => updateFilter("dateFrom", e.target.value)} className={inputClass} />
          <input type="date" value={filters.dateTo} onChange={(e) => updateFilter("dateTo", e.target.value)} className={inputClass} />
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"><X size={14} /> Clear</button>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Source</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Frequency</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Notes</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">{incomes.length === 0 ? "No income entries yet. Add your first one!" : "No entries match your filters."}</td></tr>
              ) : (
                filtered.map((inc) => (
                  <tr key={inc.id} className="hover:bg-gray-50/80 even:bg-gray-50/40">
                    <td className="px-4 py-3.5 text-sm text-gray-900 font-medium">{inc.source}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-500">{inc.category}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${inc.type === "main" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>{inc.type === "main" ? "Main" : "Side"}</span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-green-600 font-medium">+${Number(inc.amount).toFixed(2)}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-500">{new Date(inc.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-500">{inc.recurring ? inc.frequency : "One-time"}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-400 max-w-[150px] truncate">{inc.notes || "--"}</td>
                    <td className="px-4 py-3.5">
                      <button onClick={() => setEditIncome(inc)} className="text-gray-400 hover:text-blue-600 transition-colors mr-1" title="Edit"><Pencil size={14} /></button>
                      <button onClick={() => deleteIncome(inc.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Delete"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddIncomeModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onAdded={refetch} onSavePin={savePinned} />
      <EditIncomeModal isOpen={!!editIncome} income={editIncome} onClose={() => setEditIncome(null)} onUpdated={refetch} />
    </div>
  );
}
