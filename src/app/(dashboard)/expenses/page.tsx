"use client";

import { useState } from "react";
import { Plus, Trash2, Search, X, Receipt, CreditCard, Pencil, Banknote, ArrowDownRight, Wallet, PiggyBank, Coins } from "lucide-react";
import AddExpenseModal from "@/components/AddExpenseModal";
import EditExpenseModal from "@/components/EditExpenseModal";
import { useExpenses, filterExpenses, type ExpenseFilters } from "@/hooks/useExpenses";
import { useCreditCards } from "@/hooks/useCreditCards";
import { useCashAccounts } from "@/hooks/useCashAccounts";
import type { ExpenseCategory, Expense, CashAccountType } from "@/lib/types";

const ACCOUNT_TYPE_ICON: Record<CashAccountType, typeof Wallet> = {
  checking: Wallet,
  savings: PiggyBank,
  cash: Banknote,
  other: Coins,
};

const expenseCategories: ExpenseCategory[] = [
  "Rent / Mortgage", "Utilities", "Groceries", "Dining Out", "Transportation",
  "Gas", "Insurance", "Subscriptions", "Entertainment", "Shopping", "Health",
  "Education", "Phone / Internet", "Personal Care", "Gifts", "Travel",
  "Debt Payment", "Savings", "Taxes", "Other",
];

export default function ExpensesPage() {
  const { expenses, loading, refetch, deleteExpense } = useExpenses();
  const { cards } = useCreditCards();
  const { accounts } = useCashAccounts();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [filters, setFilters] = useState<ExpenseFilters>({
    search: "", category: "", dateFrom: "", dateTo: "",
    paidWith: "", cardId: "", cashAccountId: "",
  });

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
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  const updateFilter = (field: keyof ExpenseFilters, value: string) => setFilters((prev) => {
    // Mutually exclusive: picking a specific card auto-sets paidWith="credit",
    // picking a specific cash account auto-sets paidWith to a non-credit method.
    // Keep it simple — just write the field; the user can clear via Clear button.
    return { ...prev, [field]: value };
  });
  const hasFilters = filters.search || filters.category || filters.dateFrom || filters.dateTo || filters.paidWith || filters.cardId || filters.cashAccountId;
  const clearFilters = () => setFilters({
    search: "", category: "", dateFrom: "", dateTo: "",
    paidWith: "", cardId: "", cashAccountId: "",
  });
  const inputClass = "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Expenses</h1>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5 break-words">{filtered.length} entries · ${totalSpent.toFixed(2)} spent{totalPayments > 0 ? ` · $${totalPayments.toFixed(2)} card payments` : ""}</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-red-600/20 shrink-0 self-start sm:self-auto">
          <Plus size={18} /> <span>Add Expense</span>
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
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm space-y-3">
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
        </div>

        {/* Paid-with filter row — payment method + specific card + specific account */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-1">Paid with:</span>
          {/* Payment method chips */}
          {([
            { v: "", label: "All", icon: null },
            { v: "credit", label: "Credit Card", icon: CreditCard },
            { v: "cash", label: "Cash", icon: Banknote },
            { v: "debit", label: "Debit", icon: Wallet },
            { v: "bank_transfer", label: "Bank Transfer", icon: ArrowDownRight },
            { v: "other", label: "Other", icon: null },
          ] as const).map((opt) => {
            const active = filters.paidWith === opt.v;
            const Icon = opt.icon;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => updateFilter("paidWith", opt.v)}
                className={`text-xs px-2.5 py-1.5 rounded-md font-medium border transition-colors flex items-center gap-1 ${
                  active
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                {Icon && <Icon size={11} />}
                {opt.label}
              </button>
            );
          })}

          {/* Specific card */}
          {cards.length > 0 && (
            <select
              value={filters.cardId}
              onChange={(e) => updateFilter("cardId", e.target.value)}
              className={`${inputClass} text-xs py-1.5`}
            >
              <option value="">Any card</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.last_four ? ` ••${c.last_four}` : ""}
                </option>
              ))}
            </select>
          )}

          {/* Specific cash account */}
          {accounts.length > 0 && (
            <select
              value={filters.cashAccountId}
              onChange={(e) => updateFilter("cashAccountId", e.target.value)}
              className={`${inputClass} text-xs py-1.5`}
            >
              <option value="">Any account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.type})
                </option>
              ))}
            </select>
          )}

          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto flex items-center gap-1 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              <X size={12} /> Clear
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
                  const card = exp.credit_card_id && !exp.is_card_payment ? cardMap.get(exp.credit_card_id) : null;
                  const account = exp.cash_account_id ? accountMap.get(exp.cash_account_id) : null;
                  const AccountIcon = account ? ACCOUNT_TYPE_ICON[account.type] : null;
                  return (
                    <tr
                      key={exp.id}
                      onClick={() => setEditExpense(exp)}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 even:bg-gray-50/40 dark:even:bg-gray-800/20 transition-colors"
                    >
                      <td className="px-4 py-3.5 text-sm">
                        <div className="flex items-center gap-2">
                          {exp.is_card_payment && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                              <ArrowDownRight size={10} /> PAYMENT
                            </span>
                          )}
                          <span className="text-gray-900 dark:text-gray-100 font-medium">{exp.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400">{exp.category}</td>
                      <td className="px-4 py-3.5 text-sm">
                        {/* Card-payment rows: show card pill (paid TO) + account pill (paid FROM) */}
                        {exp.is_card_payment ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {exp.credit_card_id && cardMap.get(exp.credit_card_id) && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md text-white" style={{ background: cardMap.get(exp.credit_card_id)!.color }}>
                                <CreditCard size={10} />
                                {cardMap.get(exp.credit_card_id)!.name}
                              </span>
                            )}
                            {account && AccountIcon && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border" style={{ background: `${account.color}15`, color: account.color, borderColor: `${account.color}40` }}>
                                <AccountIcon size={10} />
                                from {account.name}
                              </span>
                            )}
                          </div>
                        ) : card ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md text-white" style={{ background: card.color }}>
                            <CreditCard size={11} />
                            {card.name}{card.last_four ? ` ••${card.last_four}` : ""}
                          </span>
                        ) : account && AccountIcon ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md border" style={{ background: `${account.color}15`, color: account.color, borderColor: `${account.color}40` }}>
                            <AccountIcon size={11} />
                            {account.name}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            {exp.payment_method === "cash" ? <><Banknote size={12} /> Cash</>
                              : exp.payment_method === "debit" ? <><Wallet size={12} /> Debit</>
                              : exp.payment_method === "bank_transfer" ? <><ArrowDownRight size={12} /> Bank transfer</>
                              : <>{exp.payment_method}</>}
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-3.5 text-sm font-medium ${exp.is_card_payment ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {exp.is_card_payment ? "+" : "-"}${Number(exp.amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400">{new Date(exp.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400">{exp.recurring ? exp.frequency : "One-time"}</td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditExpense(exp); }}
                          className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mr-1"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteExpense(exp.id); }}
                          className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
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
