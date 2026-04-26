"use client";

/**
 * ReceiveMoneyModal — record money sent to you by a friend or another person.
 *
 * Single-step flow that:
 *   1. Records the transaction in `debts` (direction='they_owe') + a matching
 *      `debt_payments` row covering the full amount, so it shows up in your
 *      Debts history and Friends activity.
 *   2. Marks that debt as settled immediately (since the money is already in
 *      hand — no balance to chase).
 *   3. Credits the chosen cash account by the amount.
 *
 * Saves you the two-step "create IOU then mark paid" dance for the common
 * case of "friend just paid me, log it and bump my checking balance".
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, Banknote, PiggyBank, Coins, HandCoins, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useCashAccounts } from "@/hooks/useCashAccounts";
import { useFriends } from "@/hooks/useFriends";
import { adjustAccountBalance } from "@/lib/updateBalance";
import { todayEST } from "@/lib/dates";
import type { CashAccountType } from "@/lib/types";

const ACCOUNT_ICONS: Record<CashAccountType, typeof Wallet> = {
  checking: Wallet,
  savings: PiggyBank,
  cash: Banknote,
  other: Coins,
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  defaultAccountId?: string;
}

export default function ReceiveMoneyModal({ isOpen, onClose, onSaved, defaultAccountId }: Props) {
  const { user } = useAuth();
  const supabase = createClient();
  const { accounts } = useCashAccounts();
  const { friends } = useFriends();

  const [person, setPerson] = useState("");
  const [pickedFriendId, setPickedFriendId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(todayEST());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPerson("");
    setPickedFriendId(null);
    setAmount("");
    setNotes("");
    setDate(todayEST());
    setSaving(false);
    // Default to a checking account, or the first account, or whatever the caller passed
    const firstChecking = accounts.find((a) => a.type === "checking");
    setAccountId(defaultAccountId ?? firstChecking?.id ?? accounts[0]?.id ?? "");
  }, [isOpen, accounts, defaultAccountId]);

  if (!isOpen) return null;

  const val = parseFloat(amount) || 0;
  const account = accounts.find((a) => a.id === accountId);
  const newBalance = account ? Number(account.balance) + val : 0;
  const canSubmit = person.trim().length > 0 && val > 0 && accountId !== "" && !saving;

  const handlePickFriend = (friendId: string, name: string) => {
    setPickedFriendId(friendId);
    setPerson(name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);

    // 1. Create the debt row (settled immediately — money is already received)
    const { data: debtRow, error: debtErr } = await supabase
      .from("debts")
      .insert({
        user_id: user?.id ?? null,
        person: person.trim(),
        direction: "they_owe",
        description: notes.trim() || null,
        original_amount: val,
        date,
        settled: true,
        settled_date: date,
        color: "#10b981",
      })
      .select("id")
      .single();

    if (debtErr || !debtRow) {
      console.error("[ReceiveMoneyModal] debt insert failed:", debtErr);
      setSaving(false);
      return;
    }

    // 2. Record the payment (full amount, tagged with the destination account
    //    so the account's "Recent Receives" history can show it)
    await supabase.from("debt_payments").insert({
      debt_id: debtRow.id,
      user_id: user?.id ?? null,
      amount: val,
      date,
      notes: notes.trim() || null,
      cash_account_id: accountId,
    });

    // 3. Credit the cash account
    await adjustAccountBalance(accountId, val);

    setSaving(false);
    onSaved?.();
    onClose();
  };

  const inputClass = "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 dark:focus:border-green-500 text-sm";
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
              <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 flex items-center justify-center">
                <HandCoins size={16} />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Receive money</h2>
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
              Records the payment in your Debts history and credits the chosen account immediately.
            </p>

            {/* Friend picker (chips) */}
            {friends.length > 0 && (
              <div>
                <label className={labelClass}>
                  <Users size={11} className="inline mr-1" />
                  From friend
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {friends.slice(0, 8).map((f) => {
                    const name = f.profile?.display_name || f.profile?.username || "Friend";
                    const active = pickedFriendId === f.userId;
                    return (
                      <button
                        key={f.userId}
                        type="button"
                        onClick={() => handlePickFriend(f.userId, name)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          active
                            ? "bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300"
                            : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700"
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Free-text name (also overridable when chip picked) */}
            <div>
              <label className={labelClass}>{friends.length > 0 ? "Or type a name" : "From whom"}*</label>
              <input
                type="text"
                value={person}
                onChange={(e) => { setPerson(e.target.value); setPickedFriendId(null); }}
                className={inputClass}
                placeholder="e.g. Mom, Alex, Roommate"
                required
              />
            </div>

            {/* Amount */}
            <div>
              <label className={labelClass}>Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={inputClass + " pl-7 text-lg font-semibold"}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {/* Deposit-to account */}
            <div>
              <label className={labelClass}>Deposit to *</label>
              {accounts.length === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
                  Add a cash account first (Cards page → Add Account).
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {accounts.map((a) => {
                    const Icon = ACCOUNT_ICONS[a.type];
                    const active = accountId === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setAccountId(a.id)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left ${
                          active
                            ? "bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-700"
                            : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ background: `${a.color}20`, color: a.color }}>
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{a.name}</p>
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">{a.type}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">${Number(a.balance).toFixed(2)}</p>
                          {active && val > 0 && (
                            <p className="text-[10px] font-semibold text-green-600 dark:text-green-400 tabular-nums">→ ${newBalance.toFixed(2)}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Date + notes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Note (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={inputClass}
                  placeholder="Splitwise, Venmo, etc."
                />
              </div>
            </div>

            {/* Buttons */}
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
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-1.5"
              >
                <HandCoins size={14} />
                {saving ? "Saving…" : `Receive $${val.toFixed(2)}`}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
