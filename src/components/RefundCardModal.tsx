"use client";

/**
 * RefundCardModal — record a return / refund on an item that was charged
 * to a credit card. Reduces that card's balance.
 *
 * Implementation: inserts a *negative-amount* expense linked to the card
 * (`is_card_payment=false`, `credit_card_id=<card>`). Because the card
 * balance is computed as
 *
 *   balance = SUM(charges with is_card_payment=false) - SUM(payments with is_card_payment=true)
 *
 * a -$X charge effectively reduces totalCharges by $X — which decreases
 * balance by $X. This is the most semantically correct approach: it's a
 * reversal of a charge, not a payment, and it's reflected in budget /
 * spending stats too (refunds offset spending in the same category).
 *
 * Optionally lets you pick from existing card-charged expenses in the last
 * 90 days so the refund inherits the original name + category. Or enter a
 * custom one-off refund.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Undo2, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { todayEST } from "@/lib/dates";
import type { CreditCardWithStats, Expense, ExpenseCategory } from "@/lib/types";

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Rent / Mortgage", "Utilities", "Groceries", "Dining Out", "Transportation",
  "Gas", "Insurance", "Subscriptions", "Entertainment", "Shopping", "Health",
  "Education", "Phone / Internet", "Personal Care", "Gifts", "Travel",
  "Debt Payment", "Savings", "Taxes", "Other",
];

interface Props {
  isOpen: boolean;
  card: CreditCardWithStats | null;
  onClose: () => void;
  onSaved?: () => void;
}

export default function RefundCardModal({ isOpen, card, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const supabase = createClient();

  const [recentCharges, setRecentCharges] = useState<Expense[]>([]);
  const [pickedExpenseId, setPickedExpenseId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("Shopping");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayEST());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset on open + load recent charges
  useEffect(() => {
    if (!isOpen || !card) return;
    setPickedExpenseId(null);
    setPickerOpen(false);
    setName("");
    setCategory("Shopping");
    setAmount("");
    setDate(todayEST());
    setNotes("");
    setSaving(false);

    // Pull last 90 days of charges on this card so the user can pick the
    // original purchase to refund (auto-fills name + category + amount)
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const sinceISO = since.toISOString().slice(0, 10);
    (async () => {
      let q = supabase
        .from("expenses")
        .select("*")
        .eq("credit_card_id", card.id)
        .eq("is_card_payment", false)
        .gt("amount", 0) // only charges (not prior refunds)
        .gte("date", sinceISO)
        .order("date", { ascending: false })
        .limit(50);
      if (user) q = q.eq("user_id", user.id);
      else q = q.is("user_id", null);
      const { data } = await q;
      setRecentCharges((data as Expense[]) || []);
    })();
  }, [isOpen, card, user, supabase]);

  const visibleAmount = parseFloat(amount) || 0;
  const canSubmit = card !== null && name.trim().length > 0 && visibleAmount > 0 && !saving;

  const newBalance = useMemo(() => {
    if (!card) return 0;
    return Math.max(0, card.balance - visibleAmount);
  }, [card, visibleAmount]);

  const handlePickCharge = (e: Expense) => {
    setPickedExpenseId(e.id);
    setName(e.name);
    setCategory(e.category);
    setAmount(String(e.amount));
    setNotes(e.notes ?? "");
    setPickerOpen(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !card) return;
    setSaving(true);

    // Insert a negative-amount charge expense → reduces card balance
    const refundName = name.trim().toLowerCase().startsWith("refund")
      ? name.trim()
      : `Refund: ${name.trim()}`;

    const { error } = await supabase.from("expenses").insert({
      user_id: user?.id ?? null,
      name: refundName,
      category,
      amount: -Math.abs(visibleAmount), // negative = reversal of a charge
      date,
      recurring: false,
      frequency: null,
      notes: notes.trim() || (pickedExpenseId ? `Refund of expense ${pickedExpenseId}` : null),
      payment_method: "credit",
      credit_card_id: card.id,
      is_card_payment: false, // it's a charge-side adjustment, not a payment
    });

    setSaving(false);

    if (!error) {
      onSaved?.();
      onClose();
    } else {
      console.error("[RefundCardModal] insert failed:", error);
    }
  };

  if (!isOpen || !card) return null;

  const inputClass = "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 text-sm";
  const labelClass = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", damping: 28, stiffness: 260 }}
          className="relative bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-gray-800"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Undo2 size={16} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Return / Refund</h2>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Onto {card.name}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2.5 border border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">Card balance</p>
                <p className="text-sm font-bold tabular-nums text-red-600 dark:text-red-400">${card.balance.toFixed(2)}</p>
              </div>
              {visibleAmount > 0 && (
                <>
                  <span className="text-gray-400 dark:text-gray-500">→</span>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">After refund</p>
                    <p className="text-sm font-bold tabular-nums text-green-600 dark:text-green-400">${newBalance.toFixed(2)}</p>
                  </div>
                </>
              )}
            </div>

            {/* Recent charges picker — optional, helps auto-fill */}
            {recentCharges.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setPickerOpen((o) => !o)}
                  className="w-full flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <span>{pickedExpenseId ? "Picked from a recent charge" : "Pick from recent charges (auto-fills)"}</span>
                  <ChevronDown size={12} className={`transition-transform ${pickerOpen ? "rotate-180" : ""}`} />
                </button>
                {pickerOpen && (
                  <div className="mt-2 space-y-1 max-h-48 overflow-y-auto border border-gray-100 dark:border-gray-800 rounded-lg p-1">
                    {recentCharges.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => handlePickCharge(e)}
                        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{e.name}</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500">{e.category} · {new Date(e.date).toLocaleDateString()}</p>
                        </div>
                        <span className="text-xs font-bold tabular-nums text-gray-700 dark:text-gray-300">${Number(e.amount).toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Item name */}
            <div>
              <label className={labelClass}>What was returned *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setPickedExpenseId(null); }}
                className={inputClass}
                placeholder="e.g. Nike Air Max from Best Buy"
                required
              />
            </div>

            {/* Amount + category */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Refund amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={inputClass + " pl-7 font-semibold"}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className={inputClass}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Date + notes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Refund date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Note (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={inputClass}
                  placeholder="Order #, reason, etc."
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-1.5"
              >
                <Undo2 size={14} />
                {saving ? "Saving…" : `Refund $${visibleAmount.toFixed(2)}`}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
