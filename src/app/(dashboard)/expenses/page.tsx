"use client";

import { useState } from "react";
import { Plus, Trash2, Search, X, Receipt, CreditCard, Pencil, Banknote, ArrowDownRight } from "lucide-react";
import AddExpenseModal from "@/components/AddExpenseModal";
import EditExpenseModal from "@/components/EditExpenseModal";
import { useExpenses, filterExpenses } from "@/hooks/useExpenses";
import { useCreditCards } from "@/hooks/useCreditCards";
import type { ExpenseCategory, Expense } from "@/lib/types";

const expenseCategories: ExpenseCategory[] = [
  "Rent / Mortgage", "Utilities", "Groceries", "Dining Out", "Transportation",
  "Gas", "Insurance", "Subscriptions", "Entertainment", "Shopping", "Health",
  "Education", "Phone / Internet", "Personal Care", "Gifts", "Travel",
  "Debt Payment", "Savings", "Taxes", "Other",
];

export default function ExpensesPage() {
  const { expenses, loading, refetch, deleteExpense } = useExpenses();
  const { cards } = useCreditCards();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [filters, setFilters] = useState({ search: "", category: "", dateFrom: "", dateTo: "" });

  const filtered = filterExpenses(expenses, filters);
  // Don't double-count card payments in the spending total
  const totalSpent = filtered.filter((e) => !e.is_card_payment).reduce((sum, e) => sum + Number(e.amount), 0);
  const totalPayments = filtered.filter((e) => e.is_card_payment).reduce((sum, e) => sum + Number(e.amount), 0);

  // Category breakdown (excluding card payments)
  const categoryTotals = new Map<string, number>();
  filtered.filter((e) => !e.is_card_payment).forEach((e) => {
    categoryTotals.set(e.category, (categoryTotals.get(e.category) || 0) + Number(e.amount));
  });
  const topCategories = Array.from(categoryTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const cardMap = new Map(cards.map((c) => [c.id, c]));

  const updateFilter = (field: string, value: string) => setFilters((prev) => ({ ...prev, [field]: value }));
  const hasFilters = filters.search || filters.category || filters.dateFrom || filters.dateTo;
  const clearFilters = () => setFilters({ search: "", category: "", dateFrom: "", dateTo: "" });
  const inputClass = "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Expenses</h1>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5">{filtered.length} entries &middot; ${totalSpent.toFixed(2)} spent{totalPayments > 0 ? ` &middot; $${totalPayments.toFixed(2)} card payments` : ""}</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-red-600/20">
          <Plus size={18} /> Add Expense
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <CreditCard size={14} className="text-gray-400 dark:text-gray-500" />
            <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Total Spent</span>
          </div>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">-${totalSpent.toFixed(2)}</p>
        </div>
        {topCategories.map(([cat, amount]) => (
          <div key={cat} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <Receipt size={14} className="text-gray-400 dark:text-gray-500" />
              <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider truncate">{cat}</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">${amount.toFixed(2)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" />
            <input type="text" value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="Search expenses..." className={`${inputClass} w-full pl-9`} />
          </div>
          <select value={filters.category} onChange={(e) => updateFilter("category", e.target.value)} className={inputClass}>
            <option value="">All Categories</option>
            {expenseCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="date" value={filters.dateFrom} onChange={(e) => updateFilter("dateFrom", e.target.value)} className={inputClass} />
          <input type="date" value={filters.dateTo} onChange={(e) => updateFilter("dateTo", e.target.value)} className={inputClass} />
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Expense</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Paid With</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Frequency</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                        <CreditCard size={20} className="text-gray-300 dark:text-gray-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-400 dark:text-gray-500">{expenses.length === 0 ? "No expenses yet" : "No expenses match your filters"}</p>
                      <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Expenses you add will appear here</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((exp) => {
                  const card = exp.credit_card_id ? cardMap.get(exp.credit_card_id) : null;
                  return (
                    <tr key={exp.id} className="hover:bg-gray-50/80 even:bg-gray-50/40">
                      <td className="px-4 py-3.5 text-sm">
                        <div className="flex items-center gap-2">
                          {exp.is_card_payment && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                              <ArrowDownRight size={10} /> PAYMENT
                            </span>
                          )}
                          <span className="text-gray-900 dark:text-gray-100 font-medium">{exp.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400">{exp.category}</td>
                      <td className="px-4 py-3.5 text-sm">
                        {card ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md text-white" style={{ background: card.color }}>
                            <CreditCard size={11} />
                            {card.name}{card.last_four ? ` ••${card.last_four}` : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Banknote size={12} /> Cash
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-3.5 text-sm font-medium ${exp.is_card_payment ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {exp.is_card_payment ? "+" : "-"}${Number(exp.amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400">{new Date(exp.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400">{exp.recurring ? exp.frequency : "One-time"}</td>
                      <td className="px-4 py-3.5">
                        <button onClick={() => setEditExpense(exp)} className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mr-1" title="Edit"><Pencil size={14} /></button>
                        <button onClick={() => deleteExpense(exp.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors" title="Delete"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddExpenseModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onAdded={refetch} />
      <EditExpenseModal isOpen={!!editExpense} expense={editExpense} onClose={() => setEditExpense(null)} onUpdated={refetch} />
    </div>
  );
}
