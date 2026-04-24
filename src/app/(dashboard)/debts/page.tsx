"use client";

import { useState } from "react";
import {
  Plus, Trash2, Pencil, X, ChevronDown, ChevronUp, Check,
  ArrowUpRight, ArrowDownLeft, Users, HandCoins, Trash,
} from "lucide-react";
import { useDebts } from "@/hooks/useDebts";
import { useCashAccounts } from "@/hooks/useCashAccounts";
import { todayEST } from "@/lib/dates";
import { Wallet, Banknote } from "lucide-react";
import DebtDetailsSheet from "@/components/DebtDetailsSheet";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import type { Debt, DebtWithStats } from "@/lib/types";

const COLORS = ["#f59e0b", "#3b82f6", "#ef4444", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#1f2937"];

function AddDebtModal({ isOpen, debt, onClose, onSave }: {
  isOpen: boolean; debt?: Debt | null; onClose: () => void;
  onSave: (d: { person: string; direction: "i_owe" | "they_owe"; description?: string; original_amount: number; date?: string; color?: string }) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ person: debt?.person || "", direction: debt?.direction || "i_owe" as "i_owe" | "they_owe", description: debt?.description || "", amount: debt ? String(debt.original_amount) : "", date: debt?.date || todayEST(), color: debt?.color || COLORS[0] });

  if (!isOpen) return null;
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    await onSave({ person: form.person, direction: form.direction, description: form.description, original_amount: parseFloat(form.amount) || 0, date: form.date, color: form.color });
    setLoading(false); onClose();
  };
  const inputClass = "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl shadow-gray-900/10 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{debt ? "Edit Debt" : "Add Debt / IOU"}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className={labelClass}>Who?</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button type="button" onClick={() => setForm((p) => ({ ...p, direction: "i_owe" }))}
                className={`flex items-center gap-2 p-2.5 rounded-lg text-sm font-medium transition-all ${form.direction === "i_owe" ? "bg-red-600 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                <ArrowUpRight size={16} /> I owe them
              </button>
              <button type="button" onClick={() => setForm((p) => ({ ...p, direction: "they_owe" }))}
                className={`flex items-center gap-2 p-2.5 rounded-lg text-sm font-medium transition-all ${form.direction === "they_owe" ? "bg-green-600 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                <ArrowDownLeft size={16} /> They owe me
              </button>
            </div>
            <input type="text" value={form.person} onChange={(e) => setForm((p) => ({ ...p, person: e.target.value }))} required className={inputClass} placeholder="Person's name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
                <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} required className={`${inputClass} pl-7`} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>What for?</label>
            <input type="text" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className={inputClass} placeholder="e.g. Dinner, Concert tickets, Rent split" />
          </div>
          <div>
            <label className={labelClass}>Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => <button key={c} type="button" onClick={() => setForm((p) => ({ ...p, color: c }))} className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "border-white"}`} style={{ background: c }} />)}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all">{loading ? "Saving..." : debt ? "Save" : "Add Debt"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PayDebtModal({ isOpen, debt, onClose, onPay }: {
  isOpen: boolean; debt: DebtWithStats | null; onClose: () => void;
  onPay: (debtId: string, amount: number, notes?: string, date?: string, accountId?: string) => Promise<void>;
}) {
  const { accounts } = useCashAccounts();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayEST());
  const [accountId, setAccountId] = useState<string>("");

  if (!isOpen || !debt) return null;

  const selectedAccount = accountId || (accounts.length > 0 ? accounts[0].id : "");
  const iOwe = debt.direction === "i_owe";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    await onPay(debt.id, parseFloat(amount) || 0, notes, date, selectedAccount || undefined);
    setLoading(false); setAmount(""); setNotes(""); setAccountId(""); onClose();
  };
  const inputClass = "w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";
  const val = parseFloat(amount) || 0;
  const newRemaining = Math.max(0, debt.remaining - val);
  const newProgress = Number(debt.original_amount) > 0 ? Math.min(100, ((debt.totalPaid + val) / Number(debt.original_amount)) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl shadow-gray-900/10 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{iOwe ? "Pay Back" : "Record Payment"}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20} /></button>
        </div>
        <div className="px-5 pt-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ background: debt.color }} />
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{debt.person}</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{debt.description || "No description"} · ${debt.remaining.toFixed(2)} remaining</p>
            <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full transition-all rounded-full" style={{ width: `${debt.progress}%`, background: debt.color }} />
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">$</span>
                <input type="number" step="0.01" min="0" max={debt.remaining} value={amount} onChange={(e) => setAmount(e.target.value)} required className={`${inputClass} pl-7`} placeholder={debt.remaining.toFixed(2)} autoFocus />
              </div>
            </div>
            <div>
              <label className={labelClass}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Account picker */}
          {accounts.length > 0 && (
            <div>
              <label className={labelClass}>{iOwe ? "Pay from" : "Deposit to"}</label>
              <div className="space-y-1.5">
                {accounts.map((acc) => {
                  const isSelected = selectedAccount === acc.id;
                  return (
                    <button key={acc.id} type="button" onClick={() => setAccountId(acc.id)}
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

          <div>
            <label className={labelClass}>Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="Optional" />
          </div>
          {amount && (
            <div className={`rounded-xl p-3 text-sm ${newRemaining === 0 ? "bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300" : "bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-300"}`}>
              {newRemaining === 0 ? "🎉 This will settle the debt completely!" : `After: $${newRemaining.toFixed(2)} remaining (${newProgress.toFixed(0)}% paid)`}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all">{loading ? "Saving..." : val >= debt.remaining ? "Settle Debt" : "Record Payment"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DebtsPage() {
  const { debts, loading, createDebt, updateDebt, deleteDebt, addPayment, deletePayment, totalIOwe, totalTheyOwe } = useDebts();
  const confirm = useConfirm();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editDebt, setEditDebt] = useState<Debt | null>(null);
  const [payDebt, setPayDebt] = useState<DebtWithStats | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [detailsDebtId, setDetailsDebtId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const handleSave = async (data: Parameters<typeof createDebt>[0]) => {
    if (editDebt) {
      await updateDebt(editDebt.id, data);
      setEditDebt(null);
    } else {
      await createDebt(data);
    }
  };

  const handleDeleteDebt = async (debt: DebtWithStats | { id: string; person: string; direction: "i_owe" | "they_owe" }) => {
    const iOweThem = debt.direction === "i_owe";
    const ok = await confirm({
      title: iOweThem ? `Delete debt to ${debt.person}?` : `Delete debt from ${debt.person}?`,
      message: "This removes the debt and all its payment history. This cannot be undone.",
      destructive: true,
      confirmLabel: "Delete",
    });
    if (ok) await deleteDebt(debt.id);
  };

  const handleDeleteSettled = async (debt: DebtWithStats) => {
    const ok = await confirm({
      title: `Delete ${debt.person}'s settled debt?`,
      message: "This removes the debt and all its payment history.",
      destructive: true,
      confirmLabel: "Delete",
    });
    if (ok) await deleteDebt(debt.id);
  };

  const activeDebts = debts.filter((d) => !d.settled);
  const settledDebts = debts.filter((d) => d.settled);
  const iOwe = activeDebts.filter((d) => d.direction === "i_owe");
  const theyOwe = activeDebts.filter((d) => d.direction === "they_owe");
  const detailsDebt = detailsDebtId ? debts.find((d) => d.id === detailsDebtId) ?? null : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Debts & IOUs</h1>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5 break-words">{activeDebts.length} active</p>
        </div>
        <button onClick={() => { setEditDebt(null); setShowAddModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-blue-600/20 shrink-0 self-start sm:self-auto">
          <Plus size={16} /> <span>Add Debt</span>
        </button>
      </div>

      {/* Summary */}
      {activeDebts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
            <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">I Owe</span>
            <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">${totalIOwe.toFixed(2)}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
            <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Others Owe Me</span>
            <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">${totalTheyOwe.toFixed(2)}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
            <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Net</span>
            {(() => { const net = totalTheyOwe - totalIOwe; return <p className={`text-xl font-bold mt-1 ${net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{net >= 0 ? "+" : ""}${net.toFixed(2)}</p>; })()}
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-12 text-center text-gray-400 dark:text-gray-500 shadow-sm">Loading...</div>
      ) : activeDebts.length === 0 && settledDebts.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center mb-3"><HandCoins size={22} className="text-amber-500" /></div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No debts</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Track money you owe or people owe you</p>
          </div>
        </div>
      ) : (
        <>
          {/* I owe section */}
          {iOwe.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><ArrowUpRight size={14} /> I Owe</h2>
              <div className="space-y-3">
                {iOwe.map((d) => (
                  <DebtCard key={d.id} debt={d} expanded={expanded.has(d.id)} onClick={() => setDetailsDebtId(d.id)} onToggle={() => toggleExpand(d.id)} onPay={() => setPayDebt(d)} onEdit={() => { setEditDebt(d); setShowAddModal(true); }} onDelete={() => handleDeleteDebt(d)} onSettle={() => updateDebt(d.id, { settled: true, settled_date: todayEST() })} onDeletePayment={deletePayment} />
                ))}
              </div>
            </div>
          )}

          {/* They owe section */}
          {theyOwe.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><ArrowDownLeft size={14} /> They Owe Me</h2>
              <div className="space-y-3">
                {theyOwe.map((d) => (
                  <DebtCard key={d.id} debt={d} expanded={expanded.has(d.id)} onClick={() => setDetailsDebtId(d.id)} onToggle={() => toggleExpand(d.id)} onPay={() => setPayDebt(d)} onEdit={() => { setEditDebt(d); setShowAddModal(true); }} onDelete={() => handleDeleteDebt(d)} onSettle={() => updateDebt(d.id, { settled: true, settled_date: todayEST() })} onDeletePayment={deletePayment} />
                ))}
              </div>
            </div>
          )}

          {/* Settled */}
          {settledDebts.length > 0 && (
            <div className="pt-4">
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Check size={14} /> Settled</h2>
              <div className="space-y-2">
                {settledDebts.map((d) => (
                  <div
                    key={d.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailsDebtId(d.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailsDebtId(d.id); } }}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm flex items-center gap-3 opacity-60 hover:opacity-100 hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <div className="w-2 h-8 rounded-sm" style={{ background: d.color }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{d.person}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{d.direction === "i_owe" ? "I owed" : "They owed"} ${Number(d.original_amount).toFixed(2)} · Settled {d.settled_date ? new Date(d.settled_date).toLocaleDateString() : ""}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); updateDebt(d.id, { settled: false, settled_date: null }); }} className="text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-2 py-1 rounded-md font-medium">Reopen</button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteSettled(d); }} className="text-gray-300 dark:text-gray-600 hover:text-red-500 p-1.5"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <AddDebtModal isOpen={showAddModal} debt={editDebt} onClose={() => { setShowAddModal(false); setEditDebt(null); }} onSave={handleSave} />
      <PayDebtModal isOpen={!!payDebt} debt={payDebt} onClose={() => setPayDebt(null)} onPay={addPayment} />
      <DebtDetailsSheet
        isOpen={!!detailsDebtId}
        debt={detailsDebt}
        onClose={() => setDetailsDebtId(null)}
        onEdit={(debt) => {
          setEditDebt(debt);
          setShowAddModal(true);
          setDetailsDebtId(null);
        }}
        onPay={(debt) => {
          setPayDebt(debt);
          setDetailsDebtId(null);
        }}
        onDelete={(id) => {
          deleteDebt(id);
          setDetailsDebtId(null);
        }}
      />
    </div>
  );
}

function DebtCard({ debt: d, expanded, onClick, onToggle, onPay, onEdit, onDelete, onSettle, onDeletePayment }: {
  debt: DebtWithStats; expanded: boolean; onClick: () => void; onToggle: () => void; onPay: () => void;
  onEdit: () => void; onDelete: () => void; onSettle: () => void; onDeletePayment: (id: string) => void;
}) {
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30"
    >
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-bold" style={{ background: d.color }}>
            {d.person.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{d.person}</h3>
                {d.description && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{d.description}</p>}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {d.progress >= 100 && <button onClick={stop(onSettle)} className="text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 p-1.5 rounded" title="Mark settled"><Check size={14} /></button>}
                <button onClick={stop(onEdit)} className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 p-1.5 rounded" aria-label="Edit debt"><Pencil size={14} /></button>
                <button onClick={stop(onDelete)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 p-1.5 rounded" aria-label="Delete debt"><Trash2 size={14} /></button>
              </div>
            </div>

            <div className="flex items-baseline justify-between mt-3 mb-1.5">
              <div>
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">${d.remaining.toFixed(2)}</span>
                <span className="text-sm text-gray-400 dark:text-gray-500 ml-1">/ ${Number(d.original_amount).toFixed(2)}</span>
              </div>
              <span className="text-sm font-bold tabular-nums" style={{ color: d.color }}>{d.progress.toFixed(0)}%</span>
            </div>

            <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full transition-all rounded-full" style={{ width: `${Math.min(100, d.progress)}%`, background: d.color }} />
            </div>

            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">{d.progress >= 100 ? "Fully paid!" : `$${d.remaining.toFixed(2)} left`}</span>
              <div className="flex items-center gap-2">
                <button onClick={stop(onPay)} className="text-xs font-medium text-white px-3 py-1.5 rounded-md transition-all" style={{ background: d.color }}>
                  {d.direction === "i_owe" ? "Pay Back" : "Received"}
                </button>
                <button onClick={stop(onToggle)} className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-800" aria-label={expanded ? "Collapse payment history" : "Expand payment history"}>
                  {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div
          className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Payment History</h4>
          {d.payments.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 py-3 text-center">No payments yet</p>
          ) : (
            <div className="space-y-1">
              {d.payments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:border-gray-200 transition-colors">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400"><HandCoins size={12} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">${Number(p.amount).toFixed(2)} paid</p>
                    {p.notes && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{p.notes}</p>}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{new Date(p.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  <button onClick={(e) => { e.stopPropagation(); onDeletePayment(p.id); }} className="text-gray-300 dark:text-gray-600 hover:text-red-500 p-1 transition-colors" aria-label="Delete payment"><Trash size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
