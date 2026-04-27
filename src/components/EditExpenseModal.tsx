"use client";

import { useState, useEffect } from "react";
import { X, CreditCard as CardIcon, Banknote, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCreditCards } from "@/hooks/useCreditCards";
import { useCashAccounts } from "@/hooks/useCashAccounts";
import { adjustAccountBalance } from "@/lib/updateBalance";
import type { Expense, ExpenseCategory, ExpenseFrequency, PaymentMethod } from "@/lib/types";

/**
 * Returns the SIGNED amount this expense applied to its linked cash account.
 * Negative = money left the account (debit). Positive = money returned (refund).
 * Returns 0 if the expense doesn't touch a cash account (pure card charge with
 * no cash_account_id, or no account linked).
 */
function cashEffect(exp: { amount: number; payment_method: PaymentMethod; is_card_payment: boolean; cash_account_id: string | null }): { accountId: string | null; delta: number } {
  // Pure credit-card charges and refunds (payment_method=credit, is_card_payment=false)
  // don't touch any cash account.
  const fundedFromCash = exp.is_card_payment || exp.payment_method !== "credit";
  if (!fundedFromCash || !exp.cash_account_id) return { accountId: null, delta: 0 };
  // Cash debit: positive amount = money out (negative delta on account)
  return { accountId: exp.cash_account_id, delta: -Number(exp.amount) };
}

const categories: ExpenseCategory[] = [
  "Rent / Mortgage", "Utilities", "Groceries", "Dining Out", "Transportation",
  "Gas", "Insurance", "Subscriptions", "Entertainment", "Shopping", "Health",
  "Education", "Phone / Internet", "Personal Care", "Gifts", "Travel",
  "Debt Payment", "Savings", "Taxes", "Other",
];
const frequencies: ExpenseFrequency[] = ["Weekly", "Biweekly", "Monthly", "Yearly", "One-time"];

interface EditExpenseModalProps {
  isOpen: boolean;
  expense: Expense | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditExpenseModal({ isOpen, expense, onClose, onUpdated }: EditExpenseModalProps) {
  const supabase = createClient();
  const { cards } = useCreditCards();
  const { accounts } = useCashAccounts();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [creditCardId, setCreditCardId] = useState<string>("");
  const [cashAccountId, setCashAccountId] = useState<string>("");
  const [isCardPayment, setIsCardPayment] = useState(false);
  const [form, setForm] = useState({
    name: "", category: "Groceries" as ExpenseCategory, amount: "", date: "",
    recurring: false, frequency: "Monthly" as ExpenseFrequency, notes: "",
  });

  useEffect(() => {
    if (expense) {
      setForm({
        name: expense.name,
        category: expense.category,
        amount: String(expense.amount),
        date: expense.date,
        recurring: expense.recurring,
        frequency: expense.frequency || "Monthly",
        notes: expense.notes || "",
      });
      setPaymentMethod(expense.payment_method || "cash");
      setCreditCardId(expense.credit_card_id || "");
      setCashAccountId(expense.cash_account_id || "");
      setIsCardPayment(expense.is_card_payment || false);
    }
  }, [expense]);

  if (!isOpen || !expense) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const accountIdToUse = (paymentMethod !== "credit" || isCardPayment) ? (cashAccountId || null) : null;
    const newAmount = parseFloat(form.amount);

    // Compute old vs. new cash-account effect so we can rebalance accounts
    // automatically. This is what fixes "I paid $500 but logged $400" — the
    // user just edits the amount, and the cash account gets re-debited the
    // missing $100 in the same write.
    const oldEffect = cashEffect({
      amount: Number(expense.amount),
      payment_method: expense.payment_method,
      is_card_payment: expense.is_card_payment,
      cash_account_id: expense.cash_account_id,
    });
    const newEffect = cashEffect({
      amount: newAmount,
      payment_method: paymentMethod,
      is_card_payment: isCardPayment,
      cash_account_id: accountIdToUse,
    });

    const { error } = await supabase.from("expenses").update({
      name: form.name,
      category: form.category,
      amount: newAmount,
      date: form.date,
      recurring: form.recurring,
      frequency: form.recurring ? form.frequency : "One-time",
      notes: form.notes || null,
      payment_method: paymentMethod,
      credit_card_id: paymentMethod === "credit" || isCardPayment ? (creditCardId || null) : null,
      cash_account_id: accountIdToUse,
      is_card_payment: isCardPayment,
    }).eq("id", expense.id);

    if (!error) {
      // Apply the rebalance.
      // Same account: net delta only. Different/null accounts: revert old + apply new.
      if (oldEffect.accountId && oldEffect.accountId === newEffect.accountId) {
        const net = newEffect.delta - oldEffect.delta;
        if (net !== 0) await adjustAccountBalance(oldEffect.accountId, net);
      } else {
        if (oldEffect.accountId && oldEffect.delta !== 0) {
          // Reverse the old effect (delta was negative for debit; reverse with positive)
          await adjustAccountBalance(oldEffect.accountId, -oldEffect.delta);
        }
        if (newEffect.accountId && newEffect.delta !== 0) {
          await adjustAccountBalance(newEffect.accountId, newEffect.delta);
        }
      }
    }

    setLoading(false);
    if (!error) {
      onUpdated();
      onClose();
    }
  };

  const update = (field: string, value: string | boolean) => setForm((prev) => ({ ...prev, [field]: value }));
  const inputClass = "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  // ─── Balance-change preview ───
  // Tells the user what'll happen to their cash account balances when they
  // save. Critical because the smart rebalance is otherwise invisible — most
  // users don't expect Save on an edit to also debit/credit their checking.
  const previewAccountIdToUse = (paymentMethod !== "credit" || isCardPayment) ? (cashAccountId || null) : null;
  const previewNewAmount = parseFloat(form.amount) || 0;
  const previewOldEffect = cashEffect({
    amount: Number(expense.amount),
    payment_method: expense.payment_method,
    is_card_payment: expense.is_card_payment,
    cash_account_id: expense.cash_account_id,
  });
  const previewNewEffect = cashEffect({
    amount: previewNewAmount,
    payment_method: paymentMethod,
    is_card_payment: isCardPayment,
    cash_account_id: previewAccountIdToUse,
  });
  // Build a list of {accountId, delta} entries describing what each account
  // will see when we save.
  const previewLines: { accountId: string; delta: number }[] = [];
  if (previewOldEffect.accountId && previewOldEffect.accountId === previewNewEffect.accountId) {
    const net = previewNewEffect.delta - previewOldEffect.delta;
    if (Math.abs(net) >= 0.01) previewLines.push({ accountId: previewOldEffect.accountId, delta: net });
  } else {
    if (previewOldEffect.accountId && Math.abs(previewOldEffect.delta) >= 0.01) {
      previewLines.push({ accountId: previewOldEffect.accountId, delta: -previewOldEffect.delta });
    }
    if (previewNewEffect.accountId && Math.abs(previewNewEffect.delta) >= 0.01) {
      previewLines.push({ accountId: previewNewEffect.accountId, delta: previewNewEffect.delta });
    }
  }
  const isSplitMember = !!expense.split_group_id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-gray-900/10 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Expense</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Split badge — heads up that this is part of a multi-method purchase */}
          {isSplitMember && (
            <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50 rounded-lg p-3 text-xs">
              <p className="font-semibold text-purple-900 dark:text-purple-200">Part of a split payment</p>
              <p className="text-purple-700 dark:text-purple-300 mt-0.5">
                This row is one portion of a multi-method purchase. Editing only changes this portion — the other portion(s) stay as-is.
              </p>
            </div>
          )}

          <div>
            <label className={labelClass}>Name *</label>
            <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)} required className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Category *</label>
              <select value={form.category} onChange={(e) => update("category", e.target.value)} className={inputClass}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
                <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => update("amount", e.target.value)} required className={`${inputClass} pl-7`} />
              </div>
            </div>
          </div>
          <div>
            <label className={labelClass}>Date *</label>
            <input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} required className={inputClass} />
          </div>

          <div className="flex items-center gap-2">
            <input id="isCardPayment" type="checkbox" checked={isCardPayment} onChange={(e) => setIsCardPayment(e.target.checked)} className="rounded border-gray-300 dark:border-gray-700" />
            <label htmlFor="isCardPayment" className="text-sm text-gray-700 dark:text-gray-300">This is a credit card payment (reduces card balance)</label>
          </div>

          {!isCardPayment && (
            <div>
              <label className={labelClass}>Paid with</label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button type="button" onClick={() => { setPaymentMethod("cash"); setCreditCardId(""); }}
                  className={`flex items-center gap-2 p-2.5 rounded-lg text-sm font-medium transition-all ${paymentMethod !== "credit" ? "bg-gray-900 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                  <Banknote size={16} /> Cash / Debit
                </button>
                <button type="button" onClick={() => setPaymentMethod("credit")}
                  className={`flex items-center gap-2 p-2.5 rounded-lg text-sm font-medium transition-all ${paymentMethod === "credit" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                  <CardIcon size={16} /> Credit Card
                </button>
              </div>
              {paymentMethod === "credit" && cards.length > 0 && (
                <select value={creditCardId} onChange={(e) => setCreditCardId(e.target.value)} required className={inputClass}>
                  <option value="">Select a card...</option>
                  {cards.map((c) => <option key={c.id} value={c.id}>{c.name}{c.last_four ? ` •••• ${c.last_four}` : ""}</option>)}
                </select>
              )}
            </div>
          )}

          {isCardPayment && (
            <div>
              <label className={labelClass}>Card being paid *</label>
              {cards.length > 0 && (
                <select value={creditCardId} onChange={(e) => setCreditCardId(e.target.value)} required className={inputClass}>
                  <option value="">Select a card...</option>
                  {cards.map((c) => <option key={c.id} value={c.id}>{c.name}{c.last_four ? ` •••• ${c.last_four}` : ""}</option>)}
                </select>
              )}
            </div>
          )}

          {/* Paid-from account picker — only when not a pure credit-card charge */}
          {(paymentMethod !== "credit" || isCardPayment) && accounts.length > 0 && (
            <div>
              <label className={labelClass}>{isCardPayment ? "Paid from" : "Account"}</label>
              <select value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)} className={inputClass}>
                <option value="">— Not linked —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type}) · ${Number(a.balance).toFixed(2)}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                Helps you filter expenses by Checking vs Savings vs Cash on hand. Editing this won&apos;t auto-shift balances.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={form.recurring} onChange={(e) => update("recurring", e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
            </label>
            <span className="text-sm text-gray-700 dark:text-gray-300">Recurring</span>
          </div>
          {form.recurring && (
            <div>
              <label className={labelClass}>Frequency</label>
              <select value={form.frequency} onChange={(e) => update("frequency", e.target.value)} className={inputClass}>
                {frequencies.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </div>

          {/* Balance-change preview — only shown when there's actually something to change */}
          {previewLines.length > 0 && (
            <div className="rounded-lg border border-blue-100 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/30 p-3 text-xs">
              <p className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <span>↻</span> When you save:
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {previewLines.map((line, i) => {
                  const acc = accounts.find((a) => a.id === line.accountId);
                  if (!acc) return null;
                  const sign = line.delta >= 0 ? "+" : "−";
                  const cls = line.delta >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
                  const newBalance = Number(acc.balance) + line.delta;
                  return (
                    <li key={i} className="flex items-center justify-between gap-2 text-blue-900 dark:text-blue-200">
                      <span className="truncate">{acc.name} ({acc.type})</span>
                      <span className={`tabular-nums font-semibold ${cls}`}>
                        {sign}${Math.abs(line.delta).toFixed(2)}
                      </span>
                      <span className="text-[11px] text-blue-700 dark:text-blue-300 tabular-nums">
                        → ${newBalance.toFixed(2)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {expense.credit_card_id && (
                <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-1.5">
                  Credit card balance auto-updates from the new amount.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-red-600/20">{loading ? "Saving..." : "Save Changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
