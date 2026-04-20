"use client";

import { useState, useEffect } from "react";
import { X, Wallet, Banknote, PiggyBank, Coins, ArrowRight, ArrowLeftRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useCashAccounts } from "@/hooks/useCashAccounts";
import { adjustAccountBalance } from "@/lib/updateBalance";
import { todayEST } from "@/lib/dates";
import type { CashAccountType } from "@/lib/types";

const ACCOUNT_ICONS: Record<CashAccountType, typeof Wallet> = {
  checking: Wallet,
  savings: PiggyBank,
  cash: Banknote,
  other: Coins,
};

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransferred: () => void;
  defaultFromId?: string;
}

export default function TransferModal({ isOpen, onClose, onTransferred, defaultFromId }: TransferModalProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const { accounts } = useCashAccounts();
  const [loading, setLoading] = useState(false);
  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayEST());
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (defaultFromId) setFromId(defaultFromId);
      else if (accounts.length > 0 && !fromId) setFromId(accounts[0].id);
      // Auto-select a different account as destination
      if (accounts.length > 1 && !toId) {
        const firstOther = accounts.find((a) => a.id !== (defaultFromId || accounts[0].id));
        if (firstOther) setToId(firstOther.id);
      }
    }
  }, [isOpen, defaultFromId, accounts, fromId, toId]);

  if (!isOpen) return null;

  const fromAccount = accounts.find((a) => a.id === fromId);
  const toAccount = accounts.find((a) => a.id === toId);
  const val = parseFloat(amount) || 0;
  const fromBalance = fromAccount ? Number(fromAccount.balance) : 0;
  const toBalance = toAccount ? Number(toAccount.balance) : 0;
  const canSubmit = fromId && toId && fromId !== toId && val > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);

    // Log the transfer
    const { error } = await supabase.from("transfers").insert({
      user_id: user?.id ?? null,
      from_account_id: fromId,
      to_account_id: toId,
      amount: val,
      date,
      notes: notes || null,
    });

    if (!error) {
      // Adjust both account balances
      await adjustAccountBalance(fromId, -val);
      await adjustAccountBalance(toId, val);
      setAmount("");
      setNotes("");
      setDate(todayEST());
      setFromId("");
      setToId("");
      onTransferred();
      onClose();
    }
    setLoading(false);
  };

  const inputClass = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl shadow-gray-900/10 border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Transfer Money</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={20} /></button>
        </div>

        {accounts.length < 2 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500">You need at least 2 accounts to transfer.</p>
            <p className="text-xs text-gray-400 mt-1">Add another account first.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {/* From account */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">From</label>
                {fromId && toId && fromId !== toId && (
                  <button type="button" onClick={() => { const f = fromId; setFromId(toId); setToId(f); }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    <ArrowLeftRight size={11} /> Swap
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {accounts.map((acc) => {
                  const Icon = ACCOUNT_ICONS[acc.type];
                  const isSelected = fromId === acc.id;
                  const isDest = toId === acc.id;
                  return (
                    <button key={acc.id} type="button" onClick={() => {
                        // If clicking the current To, swap them
                        if (isDest) { setToId(fromId); setFromId(acc.id); }
                        else setFromId(acc.id);
                      }}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all text-left ${
                        isSelected ? "border-red-400 bg-red-50/50" : isDest ? "border-green-200 bg-green-50/30" : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${acc.color}20`, color: acc.color }}>
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{acc.name}</p>
                        <p className="text-xs text-gray-400 capitalize">{acc.type} · ${Number(acc.balance).toFixed(2)}</p>
                      </div>
                      {isSelected && <span className="text-xs font-semibold text-red-600">FROM</span>}
                      {isDest && !isSelected && <span className="text-[10px] text-green-600 font-medium">currently TO</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Arrow divider */}
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <ArrowRight size={14} className="text-blue-600 rotate-90" />
              </div>
            </div>

            {/* To account */}
            <div>
              <label className={labelClass}>To</label>
              <div className="space-y-1.5">
                {accounts.map((acc) => {
                  const Icon = ACCOUNT_ICONS[acc.type];
                  const isSelected = toId === acc.id;
                  const isSource = fromId === acc.id;
                  return (
                    <button key={acc.id} type="button" onClick={() => {
                        // If clicking the current From, swap them
                        if (isSource) { setFromId(toId); setToId(acc.id); }
                        else setToId(acc.id);
                      }}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all text-left ${
                        isSelected ? "border-green-400 bg-green-50/50" : isSource ? "border-red-200 bg-red-50/30" : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${acc.color}20`, color: acc.color }}>
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{acc.name}</p>
                        <p className="text-xs text-gray-400 capitalize">{acc.type} · ${Number(acc.balance).toFixed(2)}</p>
                      </div>
                      {isSelected && <span className="text-xs font-semibold text-green-600">TO</span>}
                      {isSource && !isSelected && <span className="text-[10px] text-red-600 font-medium">currently FROM</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">$</span>
                  <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className={`${inputClass} pl-7`} placeholder="0.00" autoFocus />
                </div>
              </div>
              <div>
                <label className={labelClass}>Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Notes</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="Optional" />
            </div>

            {/* Preview */}
            {val > 0 && fromAccount && toAccount && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm">
                <p className="text-blue-700 font-medium mb-1.5">After transfer:</p>
                <div className="flex items-center justify-between text-blue-900">
                  <span className="text-xs">{fromAccount.name}</span>
                  <span className="font-semibold tabular-nums">${(fromBalance - val).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-blue-900 mt-1">
                  <span className="text-xs">{toAccount.name}</span>
                  <span className="font-semibold tabular-nums">${(toBalance + val).toFixed(2)}</span>
                </div>
                {val > fromBalance && (
                  <p className="text-red-600 text-xs mt-2 font-medium">⚠ This will overdraw {fromAccount.name}</p>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
              <button type="submit" disabled={loading || !canSubmit} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-600/20">
                {loading ? "Transferring..." : "Transfer"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
