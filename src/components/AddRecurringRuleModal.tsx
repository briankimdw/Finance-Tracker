"use client";

import { useState, useEffect } from "react";
import { X, Trash2, CreditCard as CardIcon, Banknote, Repeat, Wallet } from "lucide-react";
import { firstDueOnOrAfterToday } from "@/lib/recurring";
import { todayEST } from "@/lib/dates";
import { useCreditCards } from "@/hooks/useCreditCards";
import { useCashAccounts } from "@/hooks/useCashAccounts";
import type { RecurringRuleInput } from "@/hooks/useRecurring";
import type { RecurringFrequency, RecurringKind, RecurringRule } from "@/lib/types";

const EXPENSE_CATEGORIES = [
  "Rent / Mortgage", "Utilities", "Groceries", "Dining Out", "Transportation",
  "Gas", "Insurance", "Subscriptions", "Entertainment", "Shopping", "Health",
  "Education", "Phone / Internet", "Personal Care", "Gifts", "Travel",
  "Debt Payment", "Savings", "Taxes", "Other",
];

const INCOME_CATEGORIES = [
  "Salary", "Wages", "Commission", "Bonus", "Freelance", "Gig Work",
  "Tutoring", "Content Creation", "Rental", "Investments", "Dividends", "Tips", "Other",
];

const FREQUENCIES: { key: RecurringFrequency; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "biweekly", label: "Biweekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

interface AddRecurringRuleModalProps {
  isOpen: boolean;
  rule?: RecurringRule | null;
  defaultKind?: RecurringKind;
  onClose: () => void;
  onSave: (data: RecurringRuleInput, id?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export default function AddRecurringRuleModal({ isOpen, rule, defaultKind, onClose, onSave, onDelete }: AddRecurringRuleModalProps) {
  const { cards } = useCreditCards();
  const { accounts } = useCashAccounts();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    kind: (defaultKind || "expense") as RecurringKind,
    name: "",
    amount: "",
    category: "Subscriptions",
    frequency: "monthly" as RecurringFrequency,
    dayOfMonth: "1",
    startDate: todayEST(),
    payWithCard: false,
    creditCardId: "",
    cashAccountId: "",
    incomeType: "main" as "main" | "side",
    depositAccountId: "",
    autopay: true,
    active: true,
    notes: "",
  });

  useEffect(() => {
    if (rule) {
      setForm({
        kind: rule.kind,
        name: rule.name,
        amount: String(rule.amount),
        category: rule.category,
        frequency: rule.frequency,
        dayOfMonth: String(rule.day_of_month ?? 1),
        startDate: rule.next_due_date,
        payWithCard: rule.payment_method === "credit" && !!rule.credit_card_id,
        creditCardId: rule.credit_card_id || "",
        cashAccountId: rule.kind === "expense" ? (rule.cash_account_id || "") : "",
        incomeType: rule.income_type,
        depositAccountId: rule.kind === "income" ? (rule.cash_account_id || "") : "",
        autopay: rule.autopay,
        active: rule.active,
        notes: rule.notes || "",
      });
    } else if (isOpen) {
      setForm((p) => ({
        ...p,
        kind: defaultKind || "expense",
        name: "",
        amount: "",
        category: (defaultKind || "expense") === "expense" ? "Subscriptions" : "Salary",
        frequency: "monthly",
        dayOfMonth: "1",
        startDate: todayEST(),
        payWithCard: false,
        creditCardId: cards[0]?.id || "",
        cashAccountId: accounts.find((a) => a.type === "checking")?.id || accounts[0]?.id || "",
        incomeType: "main",
        depositAccountId: "",
        autopay: true,
        active: true,
        notes: "",
      }));
    }
  }, [rule, isOpen, defaultKind, cards, accounts]);

  if (!isOpen) return null;

  const isExpense = form.kind === "expense";
  const isMonthlyStyle = form.frequency === "monthly";
  const dayNum = Math.min(28, Math.max(1, parseInt(form.dayOfMonth) || 1));

  // Preview of the first date this rule will fire on
  const computeNextDue = (): string => {
    if (isMonthlyStyle) {
      const today = todayEST();
      const [y, m] = today.split("-").map(Number);
      const candidate = `${y}-${String(m).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      return candidate >= today ? candidate : firstDueOnOrAfterToday(candidate, "monthly", dayNum);
    }
    const dom = form.frequency === "yearly" ? Math.min(28, Number(form.startDate.split("-")[2]) || 1) : null;
    return firstDueOnOrAfterToday(form.startDate, form.frequency, dom);
  };
  const nextDue = computeNextDue();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const dayOfMonth = isMonthlyStyle ? dayNum : form.frequency === "yearly" ? Math.min(28, Number(nextDue.split("-")[2]) || 1) : null;
    try {
      await onSave({
        kind: form.kind,
        name: form.name,
        category: form.category,
        amount: parseFloat(form.amount) || 0,
        frequency: form.frequency,
        day_of_month: dayOfMonth,
        payment_method: isExpense ? (form.payWithCard ? "credit" : "debit") : "bank_transfer",
        credit_card_id: isExpense && form.payWithCard ? form.creditCardId || null : null,
        cash_account_id: isExpense
          ? (form.payWithCard ? null : form.cashAccountId || null)
          : form.depositAccountId || null,
        income_type: form.incomeType,
        next_due_date: nextDue,
        active: form.active,
        autopay: form.autopay,
        notes: form.notes || null,
      }, rule?.id);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";
  const categories = isExpense ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-gray-900/10 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{rule ? "Edit Recurring Rule" : "New Recurring Rule"}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Kind toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(["expense", "income"] as RecurringKind[]).map((k) => (
              <button key={k} type="button"
                onClick={() => setForm((p) => ({ ...p, kind: k, category: k === "expense" ? "Subscriptions" : "Salary" }))}
                className={`p-2.5 rounded-lg text-sm font-medium capitalize transition-all ${
                  form.kind === k
                    ? k === "expense" ? "bg-red-600 text-white" : "bg-green-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}>
                {k === "expense" ? "Bill / Expense" : "Income"}
              </button>
            ))}
          </div>

          <div>
            <label className={labelClass}>{isExpense ? "What is it? *" : "Source *"}</label>
            <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required className={inputClass}
              placeholder={isExpense ? "e.g. Rent, Netflix, Car insurance" : "e.g. Paycheck"} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
                <input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} required className={`${inputClass} pl-7`} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Category *</label>
              <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className={inputClass}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Repeats *</label>
              <select value={form.frequency} onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value as RecurringFrequency }))} className={inputClass}>
                {FREQUENCIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </div>
            {isMonthlyStyle ? (
              <div>
                <label className={labelClass}>On day of month *</label>
                <input type="number" min={1} max={28} value={form.dayOfMonth} onChange={(e) => setForm((p) => ({ ...p, dayOfMonth: e.target.value }))} required className={inputClass} />
              </div>
            ) : (
              <div>
                <label className={labelClass}>{form.frequency === "yearly" ? "First due date *" : "Starting from *"}</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} required className={inputClass} />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
            <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><Repeat size={13} /> Next occurrence</span>
            <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
              {new Date(nextDue + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </span>
          </div>

          {/* Payment method (expenses) */}
          {isExpense && (
            <div>
              <label className={labelClass}>Paid with</label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button type="button" onClick={() => setForm((p) => ({ ...p, payWithCard: false }))}
                  className={`flex items-center gap-2 p-2.5 rounded-lg text-sm font-medium transition-all ${!form.payWithCard ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                  <Banknote size={16} /> Account
                </button>
                <button type="button" onClick={() => setForm((p) => ({ ...p, payWithCard: true }))}
                  className={`flex items-center gap-2 p-2.5 rounded-lg text-sm font-medium transition-all ${form.payWithCard ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                  <CardIcon size={16} /> Credit Card
                </button>
              </div>
              {form.payWithCard ? (
                cards.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-2">No cards yet.</p>
                ) : (
                  <select value={form.creditCardId} onChange={(e) => setForm((p) => ({ ...p, creditCardId: e.target.value }))} required className={inputClass}>
                    <option value="">Select a card...</option>
                    {cards.map((c) => <option key={c.id} value={c.id}>{c.name}{c.last_four ? ` •••• ${c.last_four}` : ""}</option>)}
                  </select>
                )
              ) : accounts.length === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-2">No accounts yet — add one on the Cards page.</p>
              ) : (
                <select value={form.cashAccountId} onChange={(e) => setForm((p) => ({ ...p, cashAccountId: e.target.value }))} required className={inputClass}>
                  <option value="">Select account to deduct from...</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.type}) — ${Number(a.balance).toFixed(2)}</option>)}
                </select>
              )}
            </div>
          )}

          {/* Income options */}
          {!isExpense && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Income type</label>
                <select value={form.incomeType} onChange={(e) => setForm((p) => ({ ...p, incomeType: e.target.value as "main" | "side" }))} className={inputClass}>
                  <option value="main">Main</option>
                  <option value="side">Side</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Deposit into</label>
                <select value={form.depositAccountId} onChange={(e) => setForm((p) => ({ ...p, depositAccountId: e.target.value }))} className={inputClass}>
                  <option value="">Don&apos;t adjust balances</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Autopay + active toggles */}
          <div className="space-y-2.5">
            <label className="flex items-center gap-3 cursor-pointer">
              <span className="relative inline-flex items-center">
                <input type="checkbox" checked={form.autopay} onChange={(e) => setForm((p) => ({ ...p, autopay: e.target.checked }))} className="sr-only peer" />
                <span className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:ring-2 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Auto-apply on due date
                <span className="block text-xs text-gray-400 dark:text-gray-500">
                  {isExpense ? "Logs the expense and deducts the balance automatically" : "Logs the income automatically"}
                </span>
              </span>
            </label>
            {rule && (
              <label className="flex items-center gap-3 cursor-pointer">
                <span className="relative inline-flex items-center">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} className="sr-only peer" />
                  <span className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:ring-2 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600" />
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
              </label>
            )}
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} className={`${inputClass} resize-none`} placeholder="Any details..." />
          </div>

          <div className="flex gap-3 pt-1">
            {rule && onDelete && (
              <button
                type="button"
                onClick={async () => { setLoading(true); await onDelete(rule.id); setLoading(false); onClose(); }}
                className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                title="Delete rule"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading || (isExpense && !form.payWithCard && !form.cashAccountId) || (isExpense && form.payWithCard && !form.creditCardId)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-600/20">
              {loading ? "Saving..." : rule ? "Save" : "Create Rule"}
            </button>
          </div>
          {form.autopay && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <Wallet size={11} className="shrink-0" />
              Due items are applied automatically the next time you open the app on/after the due date.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
