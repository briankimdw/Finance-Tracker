"use client";

import { useState, useEffect } from "react";
import { X, CreditCard as CardIcon, Banknote, Wallet, Split } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useCreditCards } from "@/hooks/useCreditCards";
import { useCashAccounts } from "@/hooks/useCashAccounts";
import { adjustAccountBalance } from "@/lib/updateBalance";
import { todayEST } from "@/lib/dates";
import type { ExpenseCategory, ExpenseFrequency, PaymentMethod } from "@/lib/types";

const categories: ExpenseCategory[] = [
  "Rent / Mortgage", "Utilities", "Groceries", "Dining Out", "Transportation",
  "Gas", "Insurance", "Subscriptions", "Entertainment", "Shopping", "Health",
  "Education", "Phone / Internet", "Personal Care", "Gifts", "Travel",
  "Debt Payment", "Savings", "Taxes", "Other",
];
const frequencies: ExpenseFrequency[] = ["Weekly", "Biweekly", "Monthly", "Yearly", "One-time"];

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
  defaultCardId?: string;
  defaultIsCardPayment?: boolean;
}

export default function AddExpenseModal({ isOpen, onClose, onAdded, defaultCardId, defaultIsCardPayment }: AddExpenseModalProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const { cards } = useCreditCards();
  const { accounts } = useCashAccounts();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [creditCardId, setCreditCardId] = useState<string>("");
  const [payFromAccount, setPayFromAccount] = useState<string>("");
  const [isCardPayment, setIsCardPayment] = useState(false);
  const [form, setForm] = useState({
    name: "", category: "Groceries" as ExpenseCategory, amount: "",
    date: todayEST(),
    recurring: false, frequency: "Monthly" as ExpenseFrequency, notes: "",
  });

  // ───── Split-payment state ──────────────────────────────────────────────
  // Split mode lets the user pay one purchase with multiple methods (e.g.
  // $40 cash + $60 credit). Disabled by default; toggling it reveals two
  // portion blocks with their own amount + method pickers. On save, we
  // insert one expense row per portion sharing a single split_group_id.
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitCashAmount, setSplitCashAmount] = useState("");
  const [splitCardAmount, setSplitCardAmount] = useState("");
  const [splitCashAccountId, setSplitCashAccountId] = useState("");
  const [splitCardId, setSplitCardId] = useState("");

  useEffect(() => {
    if (isOpen && defaultCardId) {
      setPaymentMethod("credit");
      setCreditCardId(defaultCardId);
    }
    if (isOpen && defaultIsCardPayment) {
      setIsCardPayment(true);
      setPaymentMethod("bank_transfer");
      setForm((p) => ({ ...p, category: "Debt Payment", name: "Credit Card Payment" }));
      if (defaultCardId) setCreditCardId(defaultCardId);
    }
    // Auto-select first account
    if (isOpen && accounts.length > 0 && !payFromAccount) {
      setPayFromAccount(accounts[0].id);
    }
    // Initialize split defaults: first checking + first card
    if (isOpen && !splitCashAccountId) {
      const firstChecking = accounts.find((a) => a.type === "checking") || accounts[0];
      if (firstChecking) setSplitCashAccountId(firstChecking.id);
    }
    if (isOpen && !splitCardId && cards.length > 0) {
      setSplitCardId(cards[0].id);
    }
  }, [isOpen, defaultCardId, defaultIsCardPayment, accounts, cards, payFromAccount, splitCashAccountId, splitCardId]);

  if (!isOpen) return null;

  const selectedAccount = payFromAccount || (accounts.length > 0 ? accounts[0].id : "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const resetForm = () => {
      setForm({ name: "", category: "Groceries", amount: "", date: todayEST(), recurring: false, frequency: "Monthly", notes: "" });
      setPaymentMethod("cash");
      setCreditCardId("");
      setPayFromAccount("");
      setIsCardPayment(false);
      setSplitEnabled(false);
      setSplitCashAmount("");
      setSplitCardAmount("");
    };

    if (splitEnabled) {
      // Generate a shared split_group_id. crypto.randomUUID is available in
      // modern browsers + Edge Runtime.
      const splitGroupId = (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : `split-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const cashAmt = parseFloat(splitCashAmount) || 0;
      const cardAmt = parseFloat(splitCardAmount) || 0;
      const baseFields = {
        user_id: user?.id ?? null,
        name: form.name,
        category: form.category,
        date: form.date,
        recurring: form.recurring,
        frequency: form.recurring ? form.frequency : "One-time",
        notes: form.notes || null,
        is_card_payment: false,
        split_group_id: splitGroupId,
      };

      const inserts: Record<string, unknown>[] = [];
      if (cashAmt > 0 && splitCashAccountId) {
        inserts.push({
          ...baseFields,
          amount: cashAmt,
          payment_method: "cash" as PaymentMethod,
          credit_card_id: null,
          cash_account_id: splitCashAccountId,
        });
      }
      if (cardAmt > 0 && splitCardId) {
        inserts.push({
          ...baseFields,
          amount: cardAmt,
          payment_method: "credit" as PaymentMethod,
          credit_card_id: splitCardId,
          cash_account_id: null,
        });
      }
      if (inserts.length === 0) {
        setLoading(false);
        return;
      }
      const { error } = await supabase.from("expenses").insert(inserts);
      if (!error && cashAmt > 0 && splitCashAccountId) {
        // Debit the cash account for the cash portion only
        await adjustAccountBalance(splitCashAccountId, -cashAmt);
      }
      setLoading(false);
      if (!error) {
        resetForm();
        onAdded();
        onClose();
      }
      return;
    }

    // ───── Single-method path (existing behavior) ─────
    const cardIdToUse = isCardPayment ? (creditCardId || null) : paymentMethod === "credit" ? (creditCardId || null) : null;
    const accountIdToUse = (paymentMethod !== "credit" || isCardPayment) ? (selectedAccount || null) : null;

    const { error } = await supabase.from("expenses").insert({
      user_id: user?.id ?? null,
      name: form.name,
      category: form.category,
      amount: parseFloat(form.amount),
      date: form.date,
      recurring: form.recurring,
      frequency: form.recurring ? form.frequency : "One-time",
      notes: form.notes || null,
      payment_method: paymentMethod,
      credit_card_id: cardIdToUse,
      cash_account_id: accountIdToUse,
      is_card_payment: isCardPayment,
      split_group_id: null,
    });
    setLoading(false);
    if (!error) {
      const amt = parseFloat(form.amount) || 0;
      if ((paymentMethod !== "credit" || isCardPayment) && selectedAccount) {
        await adjustAccountBalance(selectedAccount, -amt);
      }
      resetForm();
      onAdded();
      onClose();
    }
  };

  const update = (field: string, value: string | boolean) => setForm((prev) => ({ ...prev, [field]: value }));
  const inputClass = "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  // Show account picker when paying from an account (not credit card charge)
  const showAccountPicker = paymentMethod !== "credit" || isCardPayment;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-gray-900/10 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{isCardPayment ? "Pay Credit Card" : "Add Expense"}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Card payment toggle */}
          {!defaultIsCardPayment && (
            <button type="button" onClick={() => {
                const next = !isCardPayment;
                setIsCardPayment(next);
                if (next) { setPaymentMethod("bank_transfer"); update("category", "Debt Payment"); update("name", form.name || "Credit Card Payment"); }
                else { setPaymentMethod("cash"); }
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                isCardPayment ? "border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-800" : "border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700"
              }`}>
              <CardIcon size={18} className={isCardPayment ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"} />
              <div className="text-left">
                <p className="text-sm font-medium">{isCardPayment ? "Credit Card Payment" : "This is a credit card payment?"}</p>
                <p className="text-xs opacity-70">{isCardPayment ? "Reduces card balance, deducts from your account" : "Toggle if you're paying off a card balance"}</p>
              </div>
            </button>
          )}

          <div>
            <label className={labelClass}>{isCardPayment ? "Description" : "What did you pay for? *"}</label>
            <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)} required className={inputClass} placeholder={isCardPayment ? "e.g. Chase Sapphire payment" : "e.g. Netflix, Electric bill"} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Category *</label>
              <select value={form.category} onChange={(e) => update("category", e.target.value)} className={inputClass}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {!splitEnabled && (
              <div>
                <label className={labelClass}>Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
                  <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => update("amount", e.target.value)} required className={`${inputClass} pl-7`} placeholder="0.00" />
                </div>
              </div>
            )}
            {splitEnabled && (
              <div>
                <label className={labelClass}>Total</label>
                <div className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  ${((parseFloat(splitCashAmount) || 0) + (parseFloat(splitCardAmount) || 0)).toFixed(2)}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>Date *</label>
            <input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} required className={inputClass} />
          </div>

          {/* Split-payment toggle (only available for non-card-payments) */}
          {!isCardPayment && (accounts.length > 0 || cards.length > 0) && (
            <button
              type="button"
              onClick={() => {
                const next = !splitEnabled;
                setSplitEnabled(next);
                if (next) {
                  // Pre-fill split fields from any single-mode amount typed
                  const totalSoFar = parseFloat(form.amount) || 0;
                  if (totalSoFar > 0 && !splitCashAmount && !splitCardAmount) {
                    setSplitCashAmount((totalSoFar / 2).toFixed(2));
                    setSplitCardAmount((totalSoFar / 2).toFixed(2));
                  }
                }
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                splitEnabled
                  ? "border-purple-400 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200"
                  : "border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700"
              }`}
            >
              <Split size={18} className={splitEnabled ? "text-purple-600 dark:text-purple-400" : "text-gray-400 dark:text-gray-500"} />
              <div className="text-left flex-1">
                <p className="text-sm font-medium">{splitEnabled ? "Splitting between cash and card" : "Split between cash and card?"}</p>
                <p className="text-xs opacity-70">{splitEnabled ? "Two rows will be saved sharing this purchase" : "Tap if you paid part with cash and part with credit"}</p>
              </div>
            </button>
          )}

          {/* Split portion blocks */}
          {splitEnabled && !isCardPayment && (
            <div className="space-y-3">
              {/* Cash portion */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Banknote size={14} />
                  </div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Cash / Debit portion</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={splitCashAmount}
                        onChange={(e) => setSplitCashAmount(e.target.value)}
                        className={`${inputClass} pl-7`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">From account</label>
                    {accounts.length === 0 ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400 py-2">No cash accounts</p>
                    ) : (
                      <select value={splitCashAccountId} onChange={(e) => setSplitCashAccountId(e.target.value)} className={inputClass}>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* Card portion */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <CardIcon size={14} />
                  </div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Credit card portion</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={splitCardAmount}
                        onChange={(e) => setSplitCardAmount(e.target.value)}
                        className={`${inputClass} pl-7`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">Card</label>
                    {cards.length === 0 ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400 py-2">No cards</p>
                    ) : (
                      <select value={splitCardId} onChange={(e) => setSplitCardId(e.target.value)} className={inputClass}>
                        {cards.map((c) => <option key={c.id} value={c.id}>{c.name}{c.last_four ? ` ••${c.last_four}` : ""}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                Two expense rows will be saved with the same name &amp; date so you can later see them as one purchase.
              </p>
            </div>
          )}

          {/* Payment method + card picker — only when NOT splitting */}
          {!isCardPayment && !splitEnabled && (
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
              {paymentMethod === "credit" && (
                cards.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-2">No cards yet.</p>
                ) : (
                  <select value={creditCardId} onChange={(e) => setCreditCardId(e.target.value)} required className={inputClass}>
                    <option value="">Select a card...</option>
                    {cards.map((c) => <option key={c.id} value={c.id}>{c.name}{c.last_four ? ` •••• ${c.last_four}` : ""}</option>)}
                  </select>
                )
              )}
            </div>
          )}

          {/* Card being paid (for card payments) */}
          {isCardPayment && (
            <div>
              <label className={labelClass}>Card to pay *</label>
              {cards.length === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-2">No cards yet.</p>
              ) : (
                <select value={creditCardId} onChange={(e) => setCreditCardId(e.target.value)} required className={inputClass}>
                  <option value="">Select a card...</option>
                  {cards.map((c) => <option key={c.id} value={c.id}>{c.name}{c.last_four ? ` •••• ${c.last_four}` : ""} (Balance: ${c.balance.toFixed(2)})</option>)}
                </select>
              )}
            </div>
          )}

          {/* Pay from account picker — hidden when splitting */}
          {!splitEnabled && showAccountPicker && accounts.length > 0 && (
            <div>
              <label className={labelClass}>{isCardPayment ? "Pay from" : "Deduct from"}</label>
              <div className="space-y-1.5">
                {accounts.map((acc) => {
                  const isSelected = selectedAccount === acc.id;
                  return (
                    <button key={acc.id} type="button" onClick={() => setPayFromAccount(acc.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all text-left ${
                        isSelected ? "border-blue-400 bg-blue-50/50" : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900"
                      }`}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${acc.color}20`, color: acc.color }}>
                        {acc.type === "cash" ? <Banknote size={14} /> : <Wallet size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{acc.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{acc.type} · ${Number(acc.balance).toFixed(2)}</p>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={form.recurring} onChange={(e) => update("recurring", e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
            </label>
            <span className="text-sm text-gray-700 dark:text-gray-300">Recurring expense</span>
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
            <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} className={`${inputClass} resize-none`} placeholder="Any details..." />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            {(() => {
              const splitTotal = (parseFloat(splitCashAmount) || 0) + (parseFloat(splitCardAmount) || 0);
              const splitInvalid = splitEnabled && (
                splitTotal <= 0 ||
                ((parseFloat(splitCashAmount) || 0) > 0 && !splitCashAccountId) ||
                ((parseFloat(splitCardAmount) || 0) > 0 && !splitCardId)
              );
              const singleInvalid = !splitEnabled && (
                (paymentMethod === "credit" && !creditCardId && !isCardPayment) ||
                (isCardPayment && !creditCardId)
              );
              return (
                <button type="submit" disabled={loading || splitInvalid || singleInvalid} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-red-600/20">
                  {loading ? "Adding..." : isCardPayment ? "Pay Card" : splitEnabled ? `Add Split Expense ($${splitTotal.toFixed(2)})` : "Add Expense"}
                </button>
              );
            })()}
          </div>
        </form>
      </div>
    </div>
  );
}
