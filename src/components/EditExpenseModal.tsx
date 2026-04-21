"use client";

import { useState, useEffect } from "react";
import { X, CreditCard as CardIcon, Banknote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCreditCards } from "@/hooks/useCreditCards";
import type { Expense, ExpenseCategory, ExpenseFrequency, PaymentMethod } from "@/lib/types";

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
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [creditCardId, setCreditCardId] = useState<string>("");
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
      setIsCardPayment(expense.is_card_payment || false);
    }
  }, [expense]);

  if (!isOpen || !expense) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("expenses").update({
      name: form.name,
      category: form.category,
      amount: parseFloat(form.amount),
      date: form.date,
      recurring: form.recurring,
      frequency: form.recurring ? form.frequency : "One-time",
      notes: form.notes || null,
      payment_method: paymentMethod,
      credit_card_id: paymentMethod === "credit" || isCardPayment ? (creditCardId || null) : null,
      is_card_payment: isCardPayment,
    }).eq("id", expense.id);
    setLoading(false);
    if (!error) {
      onUpdated();
      onClose();
    }
  };

  const update = (field: string, value: string | boolean) => setForm((prev) => ({ ...prev, [field]: value }));
  const inputClass = "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-gray-900/10 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Expense</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
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
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-red-600/20">{loading ? "Saving..." : "Save Changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
