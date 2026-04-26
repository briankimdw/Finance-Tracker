"use client";

/**
 * AdjustBalanceModal — fix a drifted balance.
 *
 * Use cases:
 *   - Cash account: app shows $1,650 but your real Chase Checking is $1,500.
 *     Enter the actual balance, app makes up the difference and (optionally)
 *     records an "Adjustment" expense for the audit trail.
 *   - Credit card: app shows $400 paid but you actually paid $500. Enter the
 *     correct balance OR a delta; app inserts a synthetic expense in the
 *     right direction so totalCharges/totalPayments reflect reality.
 *
 * Two input modes:
 *   - "Set to" — type the actual balance, modal computes the delta
 *   - "Adjust by" — type the delta directly (positive = up, negative = down)
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wand2, Plus, Minus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { adjustAccountBalance } from "@/lib/updateBalance";
import { todayEST } from "@/lib/dates";

type Kind = "cash" | "card";

interface Props {
  isOpen: boolean;
  kind: Kind;
  // Cash account or credit card identity
  targetId: string;
  targetName: string;
  currentBalance: number;
  onClose: () => void;
  onSaved?: () => void;
}

export default function AdjustBalanceModal({
  isOpen,
  kind,
  targetId,
  targetName,
  currentBalance,
  onClose,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const supabase = createClient();

  const [mode, setMode] = useState<"set" | "delta">("set");
  const [target, setTarget] = useState("");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [recordEntry, setRecordEntry] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMode("set");
    setTarget(currentBalance.toFixed(2));
    setDelta("");
    setReason("");
    setRecordEntry(true);
    setSaving(false);
  }, [isOpen, currentBalance]);

  if (!isOpen) return null;

  const computedDelta = mode === "set"
    ? (parseFloat(target) || 0) - currentBalance
    : parseFloat(delta) || 0;
  const newBalance = currentBalance + computedDelta;
  const canSave = Math.abs(computedDelta) >= 0.01 && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);

    const note = reason.trim() || (kind === "cash" ? "Manual balance adjustment" : "Manual card-balance adjustment");

    if (kind === "cash") {
      // Bump the stored balance directly. Optionally record a synthetic expense
      // so the change appears in history.
      await adjustAccountBalance(targetId, computedDelta);
      if (recordEntry) {
        // Use payment_method='other' + cash_account_id so it shows up tagged
        // to the right account in filters and history pages.
        // Negative delta = money LEFT the account → expense is a positive amount
        //   (a normal debit-style expense).
        // Positive delta = money APPEARED → expense is a negative amount
        //   (a "refund-style" entry that reads as an inflow).
        // Both ways, the cash account balance reflects reality after the
        // adjustAccountBalance call above; this row is just for the audit trail.
        await supabase.from("expenses").insert({
          user_id: user?.id ?? null,
          name: `Adjustment: ${note}`,
          category: "Other",
          amount: -computedDelta, // outflow positive, inflow negative
          date: todayEST(),
          recurring: false,
          frequency: "One-time",
          notes: `Manual reconciliation. Old balance $${currentBalance.toFixed(2)} → new $${newBalance.toFixed(2)}.`,
          payment_method: "other",
          credit_card_id: null,
          cash_account_id: targetId,
          is_card_payment: false,
        });
      }
    } else {
      // Credit card: card balance is computed from expenses. Insert a synthetic
      // expense to shift the balance:
      //   - Increase balance (positive delta) → charge-side entry, amount=+delta, is_card_payment=false
      //   - Decrease balance (negative delta) → either:
      //       a) charge-side with negative amount (looks like a refund), or
      //       b) payment-side with positive amount (is_card_payment=true)
      // We use option (a) for symmetry with the refund flow — keeps the
      // "totalPayments" stat clean.
      await supabase.from("expenses").insert({
        user_id: user?.id ?? null,
        name: `Adjustment: ${note}`,
        category: "Other",
        amount: computedDelta, // +X to add charges, -X to reduce balance (refund-style)
        date: todayEST(),
        recurring: false,
        frequency: "One-time",
        notes: `Manual reconciliation on ${targetName}. Old balance $${currentBalance.toFixed(2)} → new $${newBalance.toFixed(2)}.`,
        payment_method: "credit",
        credit_card_id: targetId,
        cash_account_id: null,
        is_card_payment: false,
      });
    }

    setSaving(false);
    onSaved?.();
    onClose();
  };

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
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Wand2 size={16} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Correct balance</h2>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">{targetName}</p>
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
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {kind === "cash"
                ? "Use this when the app's balance has drifted from your real account. We'll bump the balance and (optionally) record an audit entry."
                : "Use this when the card balance is wrong (e.g. a payment was logged for the wrong amount). We'll insert a synthetic charge / refund to make the math right."}
            </p>

            {/* Mode toggle */}
            <div className="grid grid-cols-2 gap-2">
              {([
                { v: "set", label: "Set to…" },
                { v: "delta", label: "Adjust by…" },
              ] as const).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setMode(opt.v)}
                  className={`text-xs px-3 py-2 rounded-lg font-medium border transition-colors ${
                    mode === opt.v
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Current → New summary */}
            <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">Currently</p>
                <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">${currentBalance.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">After fix</p>
                <p className={`text-sm font-bold tabular-nums ${computedDelta === 0 ? "text-gray-400 dark:text-gray-500" : computedDelta > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  ${newBalance.toFixed(2)}
                  {computedDelta !== 0 && (
                    <span className="text-[10px] ml-1 inline-flex items-center">
                      ({computedDelta > 0 ? "+" : "−"}${Math.abs(computedDelta).toFixed(2)})
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Amount input */}
            {mode === "set" ? (
              <div>
                <label className={labelClass}>Actual balance *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className={inputClass + " pl-7 font-semibold"}
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">What the balance should actually be right now.</p>
              </div>
            ) : (
              <div>
                <label className={labelClass}>Adjustment amount *</label>
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 p-1">
                    <button
                      type="button"
                      onClick={() => setDelta((prev) => prev.startsWith("-") ? prev.slice(1) : prev ? `-${prev}` : "-")}
                      className={`p-1.5 rounded ${delta.startsWith("-") ? "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400" : "text-gray-400 dark:text-gray-500"}`}
                      title="Negative (reduce balance)"
                    >
                      <Minus size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDelta((prev) => prev.startsWith("-") ? prev.slice(1) : prev)}
                      className={`p-1.5 rounded ${!delta.startsWith("-") && delta ? "bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400" : "text-gray-400 dark:text-gray-500"}`}
                      title="Positive (increase balance)"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={delta}
                      onChange={(e) => setDelta(e.target.value)}
                      className={inputClass + " pl-7 font-semibold"}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                  Positive = balance goes up, negative = balance goes down. {kind === "card" && "On a card, +$X means more debt, −$X means less."}
                </p>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className={labelClass}>Reason / note (optional)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={inputClass}
                placeholder={kind === "cash" ? "e.g. Cash spent that wasn't logged" : "e.g. Payment was actually $500"}
              />
            </div>

            {/* Audit-trail toggle (only for cash — card always records since balance derives from expenses) */}
            {kind === "cash" && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={recordEntry} onChange={(e) => setRecordEntry(e.target.checked)} className="rounded border-gray-300 dark:border-gray-700" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Also record as an &quot;Adjustment&quot; entry for the audit trail</span>
              </label>
            )}

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
                disabled={!canSave}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-1.5"
              >
                <Wand2 size={14} />
                {saving ? "Fixing…" : "Apply correction"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
