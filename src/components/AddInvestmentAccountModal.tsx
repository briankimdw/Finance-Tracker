"use client";

import { useState, useEffect } from "react";
import { X, TrendingUp, Landmark, Briefcase, Coins, Trash2 } from "lucide-react";
import type { InvestmentAccount } from "@/lib/types";

const TYPE_META: { key: string; label: string; icon: typeof TrendingUp }[] = [
  { key: "individual", label: "Individual", icon: TrendingUp },
  { key: "roth_ira", label: "Roth IRA", icon: Landmark },
  { key: "traditional_ira", label: "Trad. IRA", icon: Briefcase },
  { key: "other", label: "Other", icon: Coins },
];

interface AddInvestmentAccountModalProps {
  isOpen: boolean;
  account?: InvestmentAccount | null;
  onClose: () => void;
  onSave: (data: Partial<InvestmentAccount>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export default function AddInvestmentAccountModal({ isOpen, account, onClose, onSave, onDelete }: AddInvestmentAccountModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nickname: "",
    account_type: "individual",
    trading_type: "cash",
    mask: "",
    equity: "",
    options: "",
    eventContracts: "",
    crypto: "",
    cash: "",
  });

  useEffect(() => {
    if (account) {
      setForm({
        nickname: account.nickname || "",
        account_type: account.account_type || "individual",
        trading_type: account.trading_type || "cash",
        mask: account.mask || "",
        equity: String(account.equity_value ?? 0),
        options: String(account.options_value ?? 0),
        eventContracts: String(account.event_contracts_value ?? 0),
        crypto: String(account.crypto_value ?? 0),
        cash: String(account.cash ?? 0),
      });
    } else if (isOpen) {
      setForm({ nickname: "", account_type: "individual", trading_type: "cash", mask: "", equity: "", options: "", eventContracts: "", crypto: "", cash: "" });
    }
  }, [account, isOpen]);

  if (!isOpen) return null;

  const num = (v: string) => parseFloat(v) || 0;
  const total = num(form.equity) + num(form.options) + num(form.eventContracts) + num(form.crypto) + num(form.cash);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave({
      nickname: form.nickname || null,
      account_type: form.account_type,
      trading_type: form.trading_type || null,
      mask: form.mask.replace(/\D/g, "").slice(-4) || null,
      equity_value: num(form.equity),
      options_value: num(form.options),
      event_contracts_value: num(form.eventContracts),
      crypto_value: num(form.crypto),
      cash: num(form.cash),
      total_value: Math.round(total * 100) / 100,
      last_synced_at: new Date().toISOString(),
    });
    setLoading(false);
    onClose();
  };

  const inputClass = "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  const balanceFields: { key: keyof typeof form; label: string }[] = [
    { key: "equity", label: "Stocks / ETFs" },
    { key: "options", label: "Options" },
    { key: "eventContracts", label: "Predictions" },
    { key: "crypto", label: "Crypto" },
    { key: "cash", label: "Cash" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl shadow-gray-900/10 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{account ? "Edit Investment Account" : "Add Investment Account"}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className={labelClass}>Account Type</label>
            <div className="grid grid-cols-4 gap-2">
              {TYPE_META.map((t) => {
                const Icon = t.icon;
                return (
                  <button key={t.key} type="button" onClick={() => setForm((p) => ({ ...p, account_type: t.key }))}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-lg text-xs font-medium transition-all ${
                      form.account_type === t.key ? "bg-teal-600 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}>
                    <Icon size={16} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nickname</label>
              <input type="text" value={form.nickname} onChange={(e) => setForm((p) => ({ ...p, nickname: e.target.value }))} className={inputClass} placeholder="e.g. Roth IRA" />
            </div>
            <div>
              <label className={labelClass}>Last 4 digits</label>
              <input type="text" inputMode="numeric" maxLength={4} value={form.mask} onChange={(e) => setForm((p) => ({ ...p, mask: e.target.value.replace(/\D/g, "") }))} className={inputClass} placeholder="1234" />
            </div>
          </div>

          <div>
            <label className={labelClass}>Trading Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(["cash", "margin"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setForm((p) => ({ ...p, trading_type: t }))}
                  className={`p-2.5 rounded-lg text-sm font-medium capitalize transition-all ${
                    form.trading_type === t ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Balances</label>
            <div className="grid grid-cols-2 gap-2.5">
              {balanceFields.map((f) => (
                <div key={f.key}>
                  <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">{f.label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
                    <input type="number" step="0.01" value={form[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} className={`${inputClass} pl-7`} placeholder="0.00" />
                  </div>
                </div>
              ))}
              <div>
                <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">Total</label>
                <div className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  ${total.toFixed(2)}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
              Stocks/ETFs auto-recalculates from positions when you edit them — set the rest manually or ask Claude to sync.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            {account && onDelete && (
              <button
                type="button"
                onClick={async () => { setLoading(true); await onDelete(account.id); setLoading(false); onClose(); }}
                className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                title="Delete account"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all hover:shadow-lg hover:shadow-teal-600/20">
              {loading ? "Saving..." : account ? "Save" : "Add Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
