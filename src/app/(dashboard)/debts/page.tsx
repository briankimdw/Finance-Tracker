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
  const inputClass = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl shadow-gray-900/10 border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{debt ? "Edit Debt" : "Add Debt / IOU"}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className={labelClass}>Who?</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button type="button" onClick={() => setForm((p) => ({ ...p, direction: "i_owe" }))}
                className={`flex items-center gap-2 p-2.5 rounded-lg text-sm font-medium transition-all ${form.direction === "i_owe" ? "bg-red-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                <ArrowUpRight size={16} /> I owe them
              </button>
              <button type="button" onClick={() => setForm((p) => ({ ...p, direction: "they_owe" }))}
                className={`flex items-center gap-2 p-2.5 rounded-lg text-sm font-medium transition-all ${form.direction === "they_owe" ? "bg-green-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                <ArrowDownLeft size={16} /> They owe me
              </button>
            </div>
            <input type="text" value={form.person} onChange={(e) => setForm((p) => ({ ...p, person: e.target.value }))} required className={inputClass} placeholder="Person's name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400">$</span>
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
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
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
  const inputClass = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";
  const val = parseFloat(amount) || 0;
  const newRemaining = Math.max(0, debt.remaining - val);
  const newProgress = Number(debt.original_amount) > 0 ? Math.min(100, ((debt.totalPaid + val) / Number(debt.original_amount)) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl shadow-gray-900/10 border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{iOwe ? "Pay Back" : "Record Payment"}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="px-5 pt-4">
          <div className="bg-gray-50 rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ background: debt.color }} />
              <p className="text-sm font-semibold text-gray-900">{debt.person}</p>
            </div>
            <p className="text-xs text-gray-500">{debt.description || "No description"} &middot; ${debt.remaining.toFixed(2)} remaining</p>
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
                <span className="absolute left-3 top-2.5 text-gray-400">$</span>
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
                        isSelected ? "border-blue-400 bg-blue-50/50" : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${acc.color}20`, color: acc.color }}>
                        {acc.type === "cash" ? <Banknote size={14} /> : <Wallet size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{acc.name}</p>
                        <p className="text-xs text-gray-400 capitalize">{acc.type} · ${Number(acc.balance).toFixed(2)}</p>
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
            <div className={`rounded-xl p-3 text-sm ${newRemaining === 0 ? "bg-green-50 border border-green-200 text-green-700" : "bg-blue-50 border border-blue-100 text-blue-700"}`}>
              {newRemaining === 0 ? "🎉 This will settle the debt completely!" : `After: $${newRemaining.toFixed(2)} remaining (${newProgress.toFixed(0)}% paid)`}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-all">{loading ? "Saving..." : val >= debt.remaining ? "Settle Debt" : "Record Payment"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DebtsPage() {
  const { debts, loading, createDebt, updateDebt, deleteDebt, addPayment, deletePayment, totalIOwe, totalTheyOwe } = useDebts();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editDebt, setEditDebt] = useState<Debt | null>(null);
  const [payDebt, setPayDebt] = useState<DebtWithStats | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  const activeDebts = debts.filter((d) => !d.settled);
  const settledDebts = debts.filter((d) => d.settled);
  const iOwe = activeDebts.filter((d) => d.direction === "i_owe");
  const theyOwe = activeDebts.filter((d) => d.direction === "they_owe");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Debts & IOUs</h1>
          <p className="text-gray-400 text-sm mt-0.5">{activeDebts.length} active</p>
        </div>
        <button onClick={() => { setEditDebt(null); setShowAddModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-blue-600/20">
          <Plus size={16} /> Add Debt
        </button>
      </div>

      {/* Summary */}
      {activeDebts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <span className="text-xs text-gray-400 uppercase tracking-wider">I Owe</span>
            <p className="text-xl font-bold text-red-600 mt-1">${totalIOwe.toFixed(2)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Others Owe Me</span>
            <p className="text-xl font-bold text-green-600 mt-1">${totalTheyOwe.toFixed(2)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Net</span>
            {(() => { const net = totalTheyOwe - totalIOwe; return <p className={`text-xl font-bold mt-1 ${net >= 0 ? "text-green-600" : "text-red-600"}`}>{net >= 0 ? "+" : ""}${net.toFixed(2)}</p>; })()}
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 shadow-sm">Loading...</div>
      ) : activeDebts.length === 0 && settledDebts.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-3"><HandCoins size={22} className="text-amber-500" /></div>
            <p className="text-sm font-semibold text-gray-700">No debts</p>
            <p className="text-xs text-gray-400 mt-1">Track money you owe or people owe you</p>
          </div>
        </div>
      ) : (
        <>
          {/* I owe section */}
          {iOwe.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-1.5"><ArrowUpRight size={14} /> I Owe</h2>
              <div className="space-y-3">
                {iOwe.map((d) => (
                  <DebtCard key={d.id} debt={d} expanded={expanded.has(d.id)} onToggle={() => toggleExpand(d.id)} onPay={() => setPayDebt(d)} onEdit={() => { setEditDebt(d); setShowAddModal(true); }} onDelete={() => { if (confirm(`Delete debt to ${d.person}?`)) deleteDebt(d.id); }} onSettle={() => updateDebt(d.id, { settled: true, settled_date: todayEST() })} onDeletePayment={deletePayment} />
                ))}
              </div>
            </div>
          )}

          {/* They owe section */}
          {theyOwe.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-3 flex items-center gap-1.5"><ArrowDownLeft size={14} /> They Owe Me</h2>
              <div className="space-y-3">
                {theyOwe.map((d) => (
                  <DebtCard key={d.id} debt={d} expanded={expanded.has(d.id)} onToggle={() => toggleExpand(d.id)} onPay={() => setPayDebt(d)} onEdit={() => { setEditDebt(d); setShowAddModal(true); }} onDelete={() => { if (confirm(`Delete debt from ${d.person}?`)) deleteDebt(d.id); }} onSettle={() => updateDebt(d.id, { settled: true, settled_date: todayEST() })} onDeletePayment={deletePayment} />
                ))}
              </div>
            </div>
          )}

          {/* Settled */}
          {settledDebts.length > 0 && (
            <div className="pt-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Check size={14} /> Settled</h2>
              <div className="space-y-2">
                {settledDebts.map((d) => (
                  <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity">
                    <div className="w-2 h-8 rounded-sm" style={{ background: d.color }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{d.person}</p>
                      <p className="text-xs text-gray-400">{d.direction === "i_owe" ? "I owed" : "They owed"} ${Number(d.original_amount).toFixed(2)} &middot; Settled {d.settled_date ? new Date(d.settled_date).toLocaleDateString() : ""}</p>
                    </div>
                    <button onClick={() => updateDebt(d.id, { settled: false, settled_date: null })} className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-md font-medium">Reopen</button>
                    <button onClick={() => { if (confirm(`Delete?`)) deleteDebt(d.id); }} className="text-gray-300 hover:text-red-500 p-1.5"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <AddDebtModal isOpen={showAddModal} debt={editDebt} onClose={() => { setShowAddModal(false); setEditDebt(null); }} onSave={handleSave} />
      <PayDebtModal isOpen={!!payDebt} debt={payDebt} onClose={() => setPayDebt(null)} onPay={addPayment} />
    </div>
  );
}

function DebtCard({ debt: d, expanded, onToggle, onPay, onEdit, onDelete, onSettle, onDeletePayment }: {
  debt: DebtWithStats; expanded: boolean; onToggle: () => void; onPay: () => void;
  onEdit: () => void; onDelete: () => void; onSettle: () => void; onDeletePayment: (id: string) => void;
}) {
  return (
    <div className="group bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-all">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-bold" style={{ background: d.color }}>
            {d.person.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{d.person}</h3>
                {d.description && <p className="text-xs text-gray-400 mt-0.5">{d.description}</p>}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {d.progress >= 100 && <button onClick={onSettle} className="text-green-600 hover:bg-green-50 p-1.5 rounded" title="Mark settled"><Check size={14} /></button>}
                <button onClick={onEdit} className="text-gray-400 hover:text-blue-600 p-1.5 rounded"><Pencil size={14} /></button>
                <button onClick={onDelete} className="text-gray-300 hover:text-red-500 p-1.5 rounded"><Trash2 size={14} /></button>
              </div>
            </div>

            <div className="flex items-baseline justify-between mt-3 mb-1.5">
              <div>
                <span className="text-xl font-bold text-gray-900 tabular-nums">${d.remaining.toFixed(2)}</span>
                <span className="text-sm text-gray-400 ml-1">/ ${Number(d.original_amount).toFixed(2)}</span>
              </div>
              <span className="text-sm font-bold tabular-nums" style={{ color: d.color }}>{d.progress.toFixed(0)}%</span>
            </div>

            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full transition-all rounded-full" style={{ width: `${Math.min(100, d.progress)}%`, background: d.color }} />
            </div>

            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-500">{d.progress >= 100 ? "Fully paid!" : `$${d.remaining.toFixed(2)} left`}</span>
              <div className="flex items-center gap-2">
                <button onClick={onPay} className="text-xs font-medium text-white px-3 py-1.5 rounded-md transition-all" style={{ background: d.color }}>
                  {d.direction === "i_owe" ? "Pay Back" : "Received"}
                </button>
                <button onClick={onToggle} className="text-xs text-gray-400 hover:text-gray-600 p-1.5 rounded hover:bg-gray-50">
                  {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Payment History</h4>
          {d.payments.length === 0 ? (
            <p className="text-xs text-gray-400 py-3 text-center">No payments yet</p>
          ) : (
            <div className="space-y-1">
              {d.payments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center bg-green-50 text-green-600"><HandCoins size={12} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">${Number(p.amount).toFixed(2)} paid</p>
                    {p.notes && <p className="text-xs text-gray-400 truncate">{p.notes}</p>}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{new Date(p.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  <button onClick={() => onDeletePayment(p.id)} className="text-gray-300 hover:text-red-500 p-1 transition-colors"><Trash size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
