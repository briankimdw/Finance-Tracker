"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Wallet, PiggyBank, Banknote, Coins } from "lucide-react";
import { todayEST } from "@/lib/dates";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useCashAccounts } from "@/hooks/useCashAccounts";
import type { GoalWithStats, CashAccountType } from "@/lib/types";

const ACCOUNT_ICON: Record<CashAccountType, typeof Wallet> = {
  checking: Wallet,
  savings: PiggyBank,
  cash: Banknote,
  other: Coins,
};

interface AddContributionModalProps {
  isOpen: boolean;
  goal: GoalWithStats | null;
  onClose: () => void;
  onSave: (goalId: string, amount: number, notes?: string, date?: string, sourceCashAccountId?: string | null) => Promise<void>;
}

export default function AddContributionModal({ isOpen, goal, onClose, onSave }: AddContributionModalProps) {
  const { accounts } = useCashAccounts();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayEST());
  const [sourceAccountId, setSourceAccountId] = useState<string>("");

  // Reset source account to first checking/savings when modal opens
  useEffect(() => {
    if (!isOpen) return;
    if (accounts.length > 0 && !sourceAccountId) {
      const preferred = accounts.find((a) => a.type === "checking" || a.type === "savings") || accounts[0];
      setSourceAccountId(preferred?.id ?? "");
    }
  }, [isOpen, accounts, sourceAccountId]);

  if (!goal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const value = parseFloat(amount) || 0;
    const signed = type === "withdraw" ? -value : value;
    await onSave(goal.id, signed, notes || undefined, date, sourceAccountId || null);
    setLoading(false);
    setAmount(""); setNotes(""); setType("deposit"); setDate(todayEST());
    onClose();
  };

  const inputClass = "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  const value = parseFloat(amount) || 0;
  const newSaved = type === "withdraw" ? Math.max(0, goal.saved - value) : goal.saved + value;
  const newProgress = goal.target_amount > 0 ? Math.min(100, (newSaved / goal.target_amount) * 100) : 0;

  const selectedAccount = accounts.find((a) => a.id === sourceAccountId);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Add Contribution" size="md">
      <div className="space-y-4">
        {/* Goal preview */}
        <div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3.5">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{goal.name}</p>
            <div className="flex items-baseline justify-between mt-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">${goal.saved.toFixed(2)} of ${goal.target_amount.toFixed(2)}</p>
              <p className="text-xs font-medium" style={{ color: goal.color }}>{goal.progress.toFixed(0)}%</p>
            </div>
            <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full transition-all" style={{ width: `${goal.progress}%`, background: goal.color }} />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setType("deposit")}
                className={`flex items-center gap-2 p-2.5 rounded-lg text-sm font-medium transition-all ${type === "deposit" ? "bg-green-600 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                <ArrowDown size={16} /> Deposit
              </button>
              <button type="button" onClick={() => setType("withdraw")}
                className={`flex items-center gap-2 p-2.5 rounded-lg text-sm font-medium transition-all ${type === "withdraw" ? "bg-red-600 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                <ArrowUp size={16} /> Withdraw
              </button>
            </div>
          </div>

          <div>
            <label className={labelClass}>Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
              <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className={`${inputClass} pl-7`} placeholder="0.00" autoFocus />
            </div>
          </div>

          {/* Source cash account */}
          {accounts.length > 0 && (
            <div>
              <label className={labelClass}>
                {type === "deposit" ? "Set aside from" : "Return to"} <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                <button type="button" onClick={() => setSourceAccountId("")}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-all text-left ${sourceAccountId === "" ? "border-blue-300 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700"}`}>
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0"><Wallet size={14} className="text-gray-400" /></div>
                  <div className="flex-1">
                    <p>Not from any account</p>
                    <p className="text-[10px] text-gray-400 font-normal">Just track progress — don&apos;t reserve cash</p>
                  </div>
                </button>
                {accounts.map((a) => {
                  const Icon = ACCOUNT_ICON[a.type];
                  const isSelected = sourceAccountId === a.id;
                  const alreadyReserved = a.reserved ?? 0;
                  const free = Number(a.balance) - alreadyReserved;
                  return (
                    <button key={a.id} type="button" onClick={() => setSourceAccountId(a.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-all text-left ${isSelected ? "border-blue-300 bg-blue-50 dark:bg-blue-950/40" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700"}`}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${a.color}20`, color: a.color }}>
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`truncate ${isSelected ? "text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-300"}`}>{a.name}</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-normal tabular-nums">
                          ${Number(a.balance).toFixed(2)} · <span className={free >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>${free.toFixed(2)} free</span>
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>Date *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="Optional" />
          </div>

          {/* Preview after */}
          {amount && (
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800 rounded-xl p-3 text-sm">
              <p className="text-blue-700 dark:text-blue-300 font-medium">After this contribution:</p>
              <p className="text-blue-900 dark:text-blue-200 mt-1 font-semibold">${newSaved.toFixed(2)} saved · {newProgress.toFixed(1)}%</p>
              {selectedAccount && value > 0 && (
                <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-1">
                  {type === "deposit"
                    ? `$${value.toFixed(2)} from ${selectedAccount.name} will be reserved for this goal`
                    : `$${value.toFixed(2)} will be returned to ${selectedAccount.name}`}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className={`flex-1 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-lg ${type === "deposit" ? "bg-green-600 hover:bg-green-700 hover:shadow-green-600/20" : "bg-red-600 hover:bg-red-700 hover:shadow-red-600/20"}`}>
              {loading ? "Saving..." : type === "deposit" ? "Add Deposit" : "Withdraw"}
            </button>
          </div>
        </form>
      </div>
    </BottomSheet>
  );
}
