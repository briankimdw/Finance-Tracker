"use client";

import { useState, useRef } from "react";
import { Plus, Pencil, Trash2, CreditCard as CardIcon, ArrowUpRight, ArrowDownRight, GripVertical, Wallet, PiggyBank, Banknote, Coins, Calendar, ArrowLeftRight, HandCoins, Undo2 } from "lucide-react";
import AddCreditCardModal from "@/components/AddCreditCardModal";
import AddCashAccountModal from "@/components/AddCashAccountModal";
import AddExpenseModal from "@/components/AddExpenseModal";
import TransferModal from "@/components/TransferModal";
import ReceiveMoneyModal from "@/components/ReceiveMoneyModal";
import RefundCardModal from "@/components/RefundCardModal";
import CashAccountDetailsSheet from "@/components/CashAccountDetailsSheet";
import CreditCardDetailsSheet from "@/components/CreditCardDetailsSheet";
import { useCreditCards } from "@/hooks/useCreditCards";
import { useCashAccounts } from "@/hooks/useCashAccounts";
import type { CreditCard, CreditCardWithStats, CashAccount, CashAccountType } from "@/lib/types";

const ACCOUNT_ICONS: Record<CashAccountType, typeof Wallet> = {
  checking: Wallet,
  savings: PiggyBank,
  cash: Banknote,
  other: Coins,
};

function formatDueDate(isoDate: string | null, daysUntil: number | null): string {
  if (!isoDate) return "";
  const date = new Date(isoDate + "T12:00:00");
  const monthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (daysUntil === 0) return `Due today (${monthDay})`;
  if (daysUntil === 1) return `Due tomorrow (${monthDay})`;
  if (daysUntil !== null && daysUntil <= 7) return `Due in ${daysUntil} days (${monthDay})`;
  return `Due ${monthDay}`;
}

function getDueColor(daysUntil: number | null): string {
  if (daysUntil === null) return "text-gray-500 dark:text-gray-400";
  if (daysUntil <= 3) return "text-red-600 dark:text-red-400";
  if (daysUntil <= 7) return "text-amber-600 dark:text-amber-400";
  return "text-gray-500 dark:text-gray-400";
}

export default function CardsPage() {
  const { cards, loading: loadingCards, refetch: refetchCards, createCard, updateCard, deleteCard, reorderCards } = useCreditCards();
  const { accounts, totalBalance: totalCash, loading: loadingAccounts, createAccount, updateAccount, deleteAccount, reorderAccounts } = useCashAccounts();

  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [editCard, setEditCard] = useState<CreditCard | null>(null);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [editAccount, setEditAccount] = useState<CashAccount | null>(null);
  const [payCard, setPayCard] = useState<CreditCardWithStats | null>(null);
  const [chargeCard, setChargeCard] = useState<CreditCardWithStats | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferFromId, setTransferFromId] = useState<string | undefined>(undefined);
  const [showReceive, setShowReceive] = useState(false);
  const [receiveDefaultAccount, setReceiveDefaultAccount] = useState<string | undefined>(undefined);
  const [refundCard, setRefundCard] = useState<CreditCardWithStats | null>(null);
  const [detailsAccountId, setDetailsAccountId] = useState<string | null>(null);
  const [detailsCardId, setDetailsCardId] = useState<string | null>(null);
  const detailsCard = detailsCardId ? cards.find((c) => c.id === detailsCardId) ?? null : null;

  // Drag & drop state
  const dragCardIdx = useRef<number | null>(null);
  const dragAccountIdx = useRef<number | null>(null);
  const [dragOverCard, setDragOverCard] = useState<number | null>(null);
  const [dragOverAccount, setDragOverAccount] = useState<number | null>(null);

  const handleSaveCard = async (data: { name: string; last_four?: string; color?: string; credit_limit?: number | null; due_day?: number | null; statement_day?: number | null }) => {
    if (editCard) {
      await updateCard(editCard.id, { ...data, last_four: data.last_four ?? null });
      setEditCard(null);
    } else {
      await createCard(data);
    }
  };

  const handleSaveAccount = async (data: { name: string; type: CashAccountType; balance: number; color?: string }) => {
    if (editAccount) {
      await updateAccount(editAccount.id, data);
      setEditAccount(null);
    } else {
      await createAccount(data);
    }
  };

  // Card drag handlers
  const onCardDragStart = (i: number) => { dragCardIdx.current = i; };
  const onCardDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOverCard(i); };
  const onCardDragEnd = () => { setDragOverCard(null); dragCardIdx.current = null; };
  const onCardDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    const from = dragCardIdx.current;
    if (from === null || from === i) { onCardDragEnd(); return; }
    const next = [...cards];
    const [moved] = next.splice(from, 1);
    next.splice(i, 0, moved);
    reorderCards(next);
    onCardDragEnd();
  };

  // Account drag handlers
  const onAccountDragStart = (i: number) => { dragAccountIdx.current = i; };
  const onAccountDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOverAccount(i); };
  const onAccountDragEnd = () => { setDragOverAccount(null); dragAccountIdx.current = null; };
  const onAccountDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    const from = dragAccountIdx.current;
    if (from === null || from === i) { onAccountDragEnd(); return; }
    const next = [...accounts];
    const [moved] = next.splice(from, 1);
    next.splice(i, 0, moved);
    reorderAccounts(next);
    onAccountDragEnd();
  };

  const totalDebt = cards.reduce((sum, c) => sum + Math.max(0, c.balance), 0);
  const totalLimit = cards.reduce((sum, c) => sum + Number(c.credit_limit || 0), 0);
  const totalUtilization = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0;
  const netWorth = totalCash - totalDebt;

  // Upcoming payments (next 30 days)
  const upcomingPayments = cards
    .filter((c) => c.balance > 0 && c.daysUntilDue !== null && c.daysUntilDue <= 30)
    .sort((a, b) => (a.daysUntilDue || 0) - (b.daysUntilDue || 0));

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Accounts & Cards</h1>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5 break-words">Track your cash, checking, and credit cards</p>
        </div>
      </div>

      {/* Net summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Cash & Checking</span>
          <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">${totalCash.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Credit Card Debt</span>
          <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">${totalDebt.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Liquid Net Worth</span>
          <p className={`text-xl font-bold mt-1 ${netWorth >= 0 ? "text-gray-900 dark:text-gray-100" : "text-red-600 dark:text-red-400"}`}>
            {netWorth < 0 ? "-" : ""}${Math.abs(netWorth).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Upcoming payments alert */}
      {upcomingPayments.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={16} className="text-gray-400 dark:text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Upcoming Payments</h2>
          </div>
          <div className="space-y-2">
            {upcomingPayments.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100/80 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.name}</p>
                    <p className={`text-xs ${getDueColor(c.daysUntilDue)}`}>{formatDueDate(c.nextDueDate, c.daysUntilDue)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-red-600 dark:text-red-400 tabular-nums">${c.balance.toFixed(2)}</span>
                  <button onClick={() => setPayCard(c)} className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md transition-colors">Pay Now</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cash Accounts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Cash & Bank Accounts</h2>
          <div className="flex items-center gap-2">
            {accounts.length >= 1 && (
              <button onClick={() => { setReceiveDefaultAccount(undefined); setShowReceive(true); }} className="text-sm text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 font-medium px-3 py-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-950/40 transition-colors flex items-center gap-1" title="Friend sent you money — log it and credit an account">
                <HandCoins size={14} /> Receive
              </button>
            )}
            {accounts.length >= 2 && (
              <button onClick={() => setShowTransfer(true)} className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center gap-1">
                <ArrowLeftRight size={14} /> Transfer
              </button>
            )}
            <button onClick={() => { setEditAccount(null); setShowAddAccountModal(true); }} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center gap-1">
              <Plus size={14} /> Add Account
            </button>
          </div>
        </div>

        {loadingAccounts ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center text-gray-400 dark:text-gray-500 shadow-sm">Loading...</div>
        ) : accounts.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                <Wallet size={18} className="text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No accounts yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add your checking, savings, or cash on hand</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Quick-add Cash on Hand if no cash-type account */}
            {!accounts.some((a) => a.type === "cash") && (
              <button
                onClick={() => {
                  setEditAccount(null);
                  setShowAddAccountModal(true);
                }}
                className="group border-2 border-dashed border-gray-200 dark:border-gray-800 hover:border-blue-300 rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all min-h-[100px]"
              >
                <Banknote size={20} />
                <span className="text-xs font-medium">Add Cash on Hand</span>
                <span className="text-[11px] text-gray-300 dark:text-gray-600 group-hover:text-blue-400">Track physical cash</span>
              </button>
            )}
            {accounts.map((acc, i) => {
              const Icon = ACCOUNT_ICONS[acc.type];
              const isOver = dragOverAccount === i;
              return (
                <div key={acc.id}
                  draggable
                  onDragStart={() => onAccountDragStart(i)}
                  onDragOver={(e) => onAccountDragOver(e, i)}
                  onDragEnd={onAccountDragEnd}
                  onDrop={(e) => onAccountDrop(e, i)}
                  onClick={() => setDetailsAccountId(acc.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailsAccountId(acc.id); } }}
                  role="button"
                  tabIndex={0}
                  aria-label={`View ${acc.name} details`}
                  className={`group bg-white dark:bg-gray-900 border rounded-xl shadow-sm transition-all cursor-pointer ${isOver ? "border-blue-400 ring-2 ring-blue-200 -translate-y-0.5" : "border-gray-200 dark:border-gray-800 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700"}`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <GripVertical size={14} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400 cursor-move" />
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${acc.color}20`, color: acc.color }}>
                          <Icon size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-tight">{acc.name}</p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">{acc.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); setEditAccount(acc); setShowAddAccountModal(true); }} className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 p-1" title="Edit"><Pencil size={12} /></button>
                        <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete ${acc.name}?`)) deleteAccount(acc.id); }} className="text-gray-300 dark:text-gray-600 hover:text-red-500 p-1" title="Delete"><Trash2 size={12} /></button>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">${Number(acc.balance).toFixed(2)}</p>
                    {(() => {
                      const reserved = acc.reserved ?? 0;
                      const free = Number(acc.balance) - reserved;
                      if (reserved <= 0) return null;
                      const pct = Number(acc.balance) > 0 ? Math.min(100, (reserved / Number(acc.balance)) * 100) : 0;
                      return (
                        <div className="mt-2">
                          <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full" style={{ width: `${pct}%`, background: acc.color }} />
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-medium tabular-nums mt-1">
                            <span className="text-gray-500 dark:text-gray-400" title="Reserved for active goals">${reserved.toFixed(2)} reserved</span>
                            <span className={free >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>${free.toFixed(2)} free</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Credit Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Credit Cards</h2>
          <div className="flex items-center gap-3">
            {totalLimit > 0 && (
              <span className={`text-xs ${totalUtilization > 30 ? "text-red-600 dark:text-red-400" : totalUtilization > 10 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                {totalUtilization.toFixed(1)}% utilization
              </span>
            )}
            <button onClick={() => { setEditCard(null); setShowAddCardModal(true); }} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center gap-1">
              <Plus size={14} /> Add Card
            </button>
          </div>
        </div>

        {loadingCards ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center text-gray-400 dark:text-gray-500 shadow-sm">Loading...</div>
        ) : cards.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                <CardIcon size={18} className="text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No cards yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add a credit card to start tracking</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card, i) => {
              const utilColor = card.utilization > 30 ? "text-red-600 dark:text-red-400" : card.utilization > 10 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400";
              const barColor = card.utilization > 30 ? "bg-red-500" : card.utilization > 10 ? "bg-amber-500" : "bg-green-500";
              const isOver = dragOverCard === i;
              return (
                <div key={card.id}
                  draggable
                  onDragStart={() => onCardDragStart(i)}
                  onDragOver={(e) => onCardDragOver(e, i)}
                  onDragEnd={onCardDragEnd}
                  onDrop={(e) => onCardDrop(e, i)}
                  onClick={() => setDetailsCardId(card.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailsCardId(card.id); } }}
                  role="button"
                  tabIndex={0}
                  aria-label={`View ${card.name} details`}
                  className={`bg-white dark:bg-gray-900 border rounded-xl shadow-sm overflow-hidden transition-all cursor-pointer ${isOver ? "border-blue-400 ring-2 ring-blue-200 -translate-y-0.5" : "border-gray-200 dark:border-gray-800 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700"}`}>
                  {/* Card visual */}
                  <div className="p-5 text-white relative" style={{ background: `linear-gradient(135deg, ${card.color}, ${card.color}cc)` }}>
                    <GripVertical size={14} className="absolute top-2 right-2 opacity-50" />
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <p className="text-xs opacity-80 uppercase tracking-wider">Credit Card</p>
                        <p className="text-lg font-semibold mt-1">{card.name}</p>
                      </div>
                      <CardIcon size={22} className="opacity-70" />
                    </div>
                    <p className="text-sm font-mono opacity-90">•••• •••• •••• {card.last_four || "0000"}</p>
                  </div>

                  {/* Stats */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Balance</span>
                      <span className={`text-xl font-bold tabular-nums ${card.balance > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                        ${card.balance.toFixed(2)}
                      </span>
                    </div>

                    {card.due_day && card.balance > 0 && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar size={12} className="text-gray-400 dark:text-gray-500" />
                        <span className={getDueColor(card.daysUntilDue)}>{formatDueDate(card.nextDueDate, card.daysUntilDue)}</span>
                      </div>
                    )}

                    {card.credit_limit && Number(card.credit_limit) > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-gray-400 dark:text-gray-500">Utilization</span>
                          <span className={`text-xs font-medium ${utilColor}`}>{card.utilization.toFixed(1)}% of ${Number(card.credit_limit).toFixed(0)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div className={`h-full transition-all ${barColor}`} style={{ width: `${Math.max(0, Math.min(100, card.utilization))}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <div>
                        <p className="text-gray-400 dark:text-gray-500">Charges</p>
                        <p className="font-medium text-gray-700 dark:text-gray-300 tabular-nums">${card.totalCharges.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-gray-500">Payments</p>
                        <p className="font-medium text-gray-700 dark:text-gray-300 tabular-nums">${card.totalPayments.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <button onClick={(e) => { e.stopPropagation(); setChargeCard(card); }} className="flex-1 flex items-center justify-center gap-1 text-xs bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800 px-2.5 py-1.5 rounded-md transition-colors">
                        <ArrowUpRight size={12} /> Charge
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setPayCard(card); }} className="flex-1 flex items-center justify-center gap-1 text-xs bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 hover:bg-green-100 border border-green-200 dark:border-green-800 px-2.5 py-1.5 rounded-md transition-colors">
                        <ArrowDownRight size={12} /> Pay
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setRefundCard(card); }} className="flex items-center justify-center gap-1 text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 px-2.5 py-1.5 rounded-md transition-colors" title="Record a return / refund onto this card">
                        <Undo2 size={12} /> Refund
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setEditCard(card); setShowAddCardModal(true); }} className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-1.5" title="Edit"><Pencil size={14} /></button>
                      <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete ${card.name}?`)) deleteCard(card.id); }} className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors p-1.5" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddCreditCardModal isOpen={showAddCardModal} card={editCard} onClose={() => { setShowAddCardModal(false); setEditCard(null); }} onSave={handleSaveCard} />
      <AddCashAccountModal isOpen={showAddAccountModal} account={editAccount} onClose={() => { setShowAddAccountModal(false); setEditAccount(null); }} onSave={handleSaveAccount} />
      <AddExpenseModal isOpen={!!chargeCard} onClose={() => setChargeCard(null)} onAdded={refetchCards} defaultCardId={chargeCard?.id} />
      <AddExpenseModal isOpen={!!payCard} onClose={() => setPayCard(null)} onAdded={refetchCards} defaultCardId={payCard?.id} defaultIsCardPayment={true} />
      <TransferModal isOpen={showTransfer} onClose={() => { setShowTransfer(false); setTransferFromId(undefined); }} onTransferred={refetchCards} defaultFromId={transferFromId} />
      <ReceiveMoneyModal isOpen={showReceive} onClose={() => { setShowReceive(false); setReceiveDefaultAccount(undefined); }} defaultAccountId={receiveDefaultAccount} />
      <RefundCardModal isOpen={refundCard !== null} card={refundCard} onClose={() => setRefundCard(null)} onSaved={refetchCards} />

      <CashAccountDetailsSheet
        isOpen={detailsAccountId !== null}
        accountId={detailsAccountId}
        onClose={() => setDetailsAccountId(null)}
        onEdit={(acc) => {
          setDetailsAccountId(null);
          setEditAccount(acc);
          setShowAddAccountModal(true);
        }}
        onTransfer={(fromId) => {
          setDetailsAccountId(null);
          setTransferFromId(fromId);
          setShowTransfer(true);
        }}
        onDelete={async (id) => {
          await deleteAccount(id);
        }}
      />

      <CreditCardDetailsSheet
        isOpen={detailsCardId !== null}
        card={detailsCard}
        onClose={() => setDetailsCardId(null)}
        onEdit={(c) => {
          setDetailsCardId(null);
          setEditCard(c);
          setShowAddCardModal(true);
        }}
        onAddCharge={(cardId) => {
          const c = cards.find((cc) => cc.id === cardId);
          if (!c) return;
          setDetailsCardId(null);
          setChargeCard(c);
        }}
        onMakePayment={(cardId) => {
          const c = cards.find((cc) => cc.id === cardId);
          if (!c) return;
          setDetailsCardId(null);
          setPayCard(c);
        }}
        onDelete={async (id) => {
          await deleteCard(id);
        }}
      />
    </div>
  );
}
