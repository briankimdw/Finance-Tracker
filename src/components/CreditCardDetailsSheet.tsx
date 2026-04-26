"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CreditCard as CardIcon,
  Pencil, Trash2, ArrowUpRight, ArrowDownRight, Calendar, Wand2,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import AdjustBalanceModal from "@/components/AdjustBalanceModal";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { formatESTDate } from "@/lib/dates";
import type { CreditCardWithStats } from "@/lib/types";

interface CardTransaction {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  is_card_payment: boolean;
  notes: string | null;
}

interface CreditCardDetailsSheetProps {
  isOpen: boolean;
  card: CreditCardWithStats | null;
  onClose: () => void;
  onEdit: (card: CreditCardWithStats) => void;
  onAddCharge: (cardId: string) => void;
  onMakePayment: (cardId: string) => void;
  onDelete: (id: string) => void;
}

function formatDueDate(isoDate: string | null, daysUntil: number | null): string {
  if (!isoDate) return "";
  const monthDay = formatESTDate(isoDate, { month: "short", day: "numeric" });
  if (daysUntil === 0) return `Due today (${monthDay})`;
  if (daysUntil === 1) return `Due tomorrow (${monthDay})`;
  if (daysUntil !== null && daysUntil <= 7) return `Due in ${daysUntil} days (${monthDay})`;
  return `Due ${monthDay}`;
}

export default function CreditCardDetailsSheet({
  isOpen,
  card,
  onClose,
  onEdit,
  onAddCharge,
  onMakePayment,
  onDelete,
}: CreditCardDetailsSheetProps) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const supabase = createClient();

  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);

  useEffect(() => {
    if (!isOpen || !card) return;
    let cancelled = false;

    const run = async () => {
      setLoadingTx(true);
      try {
        // The app stores credit-card activity in the "expenses" table with credit_card_id set.
        // Charges have is_card_payment=false; payments have is_card_payment=true.
        let q = supabase
          .from("expenses")
          .select("id, name, category, amount, date, is_card_payment, notes")
          .eq("credit_card_id", card.id)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(8);
        if (user) q = q.eq("user_id", user.id);
        else q = q.is("user_id", null);

        const { data } = await q;
        if (cancelled) return;
        setTransactions((data || []) as CardTransaction[]);
      } catch {
        if (!cancelled) setTransactions([]);
      } finally {
        if (!cancelled) setLoadingTx(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [isOpen, card, user, supabase]);

  if (!card) return null;

  const balance = Number(card.balance);
  const limit = card.credit_limit ? Number(card.credit_limit) : 0;
  const available = limit > 0 ? Math.max(0, limit - Math.max(0, balance)) : 0;
  const utilization = card.utilization;
  const utilPct = Math.max(0, Math.min(100, utilization));
  const utilColorText =
    utilization >= 80
      ? "text-red-600 dark:text-red-400"
      : utilization >= 30
      ? "text-amber-600 dark:text-amber-400"
      : "text-green-600 dark:text-green-400";
  const utilBarBg =
    utilization >= 80 ? "bg-red-500" : utilization >= 30 ? "bg-amber-500" : "bg-green-500";

  const dueColor =
    card.daysUntilDue !== null
      ? card.daysUntilDue <= 3
        ? "text-red-600 dark:text-red-400"
        : card.daysUntilDue <= 7
        ? "text-amber-600 dark:text-amber-400"
        : "text-gray-700 dark:text-gray-300"
      : "text-gray-500 dark:text-gray-400";

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete ${card.name}?`,
      message: "This removes the card. Associated charges and payments will stay in your expense history but lose their card link.",
      destructive: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await onDelete(card.id);
      toast.success(`${card.name} deleted`);
      onClose();
    } catch {
      toast.error("Failed to delete card");
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} size="lg" title={card.name}>
      <div className="space-y-5">
        {/* Card visual header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm"
          style={{ background: `linear-gradient(135deg, ${card.color}, ${card.color}cc)` }}
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-[11px] opacity-80 uppercase tracking-wider">Credit Card</p>
              <p className="text-lg font-semibold mt-1 truncate">{card.name}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/20"
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#fff" }} />
                {card.last_four ? `•• ${card.last_four}` : "—"}
              </span>
              <CardIcon size={20} className="opacity-80" />
            </div>
          </div>
          <p className="text-sm font-mono opacity-90 mt-6 tracking-wider">
            •••• •••• •••• {card.last_four || "0000"}
          </p>
        </motion.div>

        {/* Big balance */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.04 }}
          className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 relative"
        >
          <button
            type="button"
            onClick={() => setShowAdjust(true)}
            className="absolute top-3 right-3 inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-950/40 px-2 py-1 rounded-md transition-colors"
            title="Correct a wrong balance — useful when a payment was logged for the wrong amount"
          >
            <Wand2 size={11} /> Correct
          </button>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Current balance
          </p>
          <p
            className={`text-3xl font-bold tabular-nums mt-1 ${
              balance > 0
                ? "text-red-600 dark:text-red-400"
                : balance < 0
                ? "text-green-600 dark:text-green-400"
                : "text-gray-900 dark:text-gray-100"
            }`}
          >
            ${Math.abs(balance).toFixed(2)}
          </p>
          {limit > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
              Limit ${limit.toFixed(0)} · ${available.toFixed(2)} available
            </p>
          )}

          {limit > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Utilization
                </span>
                <span className={`text-xs font-medium ${utilColorText}`}>
                  {utilization.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${utilBarBg}`}
                  style={{ width: `${utilPct}%` }}
                />
              </div>
            </div>
          )}
        </motion.div>

        {/* Payment due */}
        {card.due_day && (
          <div className="rounded-2xl bg-gray-50 dark:bg-gray-800 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={14} className="text-gray-400 dark:text-gray-500" />
              <h3 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Payment Due
              </h3>
            </div>
            {balance > 0 && card.daysUntilDue !== null ? (
              <>
                <p className={`text-xl font-semibold ${dueColor}`}>
                  {card.daysUntilDue === 0
                    ? "Due today"
                    : card.daysUntilDue === 1
                    ? "Due tomorrow"
                    : `Due in ${card.daysUntilDue} days`}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {formatDueDate(card.nextDueDate, card.daysUntilDue)}
                </p>
              </>
            ) : balance <= 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No balance — nothing due right now.
              </p>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Due day {card.due_day} each month.
              </p>
            )}
          </div>
        )}

        {/* Charges / Payments summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Charges
            </p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100 tabular-nums mt-0.5">
              ${card.totalCharges.toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Payments
            </p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100 tabular-nums mt-0.5">
              ${card.totalPayments.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <CardIcon size={14} className="text-gray-400 dark:text-gray-500" />
              <h3 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Recent Activity
              </h3>
            </div>
            {card && transactions.length > 0 && (
              <Link
                href={`/cards/${card.id}`}
                onClick={onClose}
                className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                See all
              </Link>
            )}
          </div>
          {loadingTx ? (
            <div className="text-xs text-gray-400 dark:text-gray-500 py-3">Loading…</div>
          ) : transactions.length === 0 ? (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
              No activity on this card yet.
            </div>
          ) : (
            <div className="space-y-1.5">
              {transactions.map((tx) => {
                const isPayment = tx.is_card_payment;
                const amount = Number(tx.amount);
                const sign = isPayment ? "−" : "+";
                const amountClass = isPayment
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400";
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isPayment
                          ? "bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400"
                          : "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                      }`}
                    >
                      {isPayment ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {tx.name}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                        {isPayment ? "Payment" : tx.category} ·{" "}
                        {formatESTDate(tx.date, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums shrink-0 ${amountClass}`}>
                      {sign}${amount.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={() => onAddCharge(card.id)}
            className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-red-600/20"
          >
            <ArrowUpRight size={14} /> Add Charge
          </button>
          <button
            type="button"
            onClick={() => onMakePayment(card.id)}
            className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-green-600/20"
          >
            <ArrowDownRight size={14} /> Make Payment
          </button>
          <button
            type="button"
            onClick={() => onEdit(card)}
            className="flex items-center justify-center gap-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2.5 rounded-xl transition-colors"
          >
            <Pencil size={14} /> Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            aria-label={`Delete ${card.name}`}
            className="flex items-center justify-center gap-1.5 text-sm font-medium bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800 px-4 py-2.5 rounded-xl transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {card && (
        <AdjustBalanceModal
          isOpen={showAdjust}
          kind="card"
          targetId={card.id}
          targetName={card.name}
          currentBalance={Number(card.balance)}
          onClose={() => setShowAdjust(false)}
        />
      )}
    </BottomSheet>
  );
}
