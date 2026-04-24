"use client";

import { ArrowDownLeft, ArrowUpRight, Calendar, HandCoins, Pencil, Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { formatESTDate } from "@/lib/dates";
import type { Debt, DebtWithStats } from "@/lib/types";

interface DebtDetailsSheetProps {
  isOpen: boolean;
  debt: DebtWithStats | null;
  onClose: () => void;
  onEdit: (debt: Debt) => void;
  onPay: (debt: DebtWithStats) => void;
  onDelete: (id: string) => void;
}

export default function DebtDetailsSheet({
  isOpen,
  debt,
  onClose,
  onEdit,
  onPay,
  onDelete,
}: DebtDetailsSheetProps) {
  const confirm = useConfirm();

  if (!debt) return null;

  const iOwe = debt.direction === "i_owe";
  const original = Number(debt.original_amount);
  const paid = Number(debt.totalPaid);
  const remaining = Number(debt.remaining);
  const progress = Math.min(100, debt.progress);
  const partiallyPaid = paid > 0 && remaining > 0;
  const fullyPaid = progress >= 100 || remaining <= 0;
  const hasProgress = paid > 0 || fullyPaid;

  const directionPillClass = iOwe
    ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/60"
    : "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-900/60";

  const amountColor = fullyPaid
    ? "text-gray-500 dark:text-gray-400"
    : iOwe
    ? "text-red-600 dark:text-red-400"
    : "text-green-600 dark:text-green-400";

  const handleDelete = async () => {
    const ok = await confirm({
      title: iOwe ? `Delete debt to ${debt.person}?` : `Delete debt from ${debt.person}?`,
      message: "This removes the debt and all its payment history. This cannot be undone.",
      destructive: true,
      confirmLabel: "Delete",
    });
    if (ok) {
      onDelete(debt.id);
      onClose();
    }
  };

  const handleEdit = () => {
    onEdit(debt);
  };

  const handlePay = () => {
    onPay(debt);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} size="lg" title="Debt details">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white text-base font-bold"
            style={{ background: debt.color }}
          >
            {debt.person.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${directionPillClass}`}
              >
                {iOwe ? <ArrowUpRight size={11} /> : <ArrowDownLeft size={11} />}
                {iOwe ? "You owe" : "Owes you"}
              </span>
              {debt.settled && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                  Settled
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {debt.person}
            </h3>
            {debt.date && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                <Calendar size={11} />
                {iOwe ? "Borrowed" : "Lent"} on {formatESTDate(debt.date, { month: "short", day: "numeric", year: "numeric" })}
              </p>
            )}
          </div>
        </div>

        {/* Big outstanding amount */}
        <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold mb-1">
            {fullyPaid ? "Fully paid" : "Outstanding"}
          </p>
          <p className={`text-4xl font-bold tabular-nums ${amountColor}`}>
            ${remaining.toFixed(2)}
          </p>
          {partiallyPaid && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 tabular-nums">
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                ${paid.toFixed(2)}
              </span>{" "}
              paid of{" "}
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                ${original.toFixed(2)}
              </span>{" "}
              original
            </p>
          )}
          {hasProgress && (
            <div className="mt-3 space-y-1.5">
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 dark:bg-green-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
                <span>{progress.toFixed(0)}% paid</span>
                {!fullyPaid && <span>${remaining.toFixed(2)} left</span>}
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        {debt.description && (
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold mb-2">
              Notes
            </p>
            <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl px-3.5 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
              {debt.description}
            </div>
          </div>
        )}

        {/* Payment history */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">
              Payment history
            </p>
            {debt.payments.length > 0 && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                {debt.payments.length} payment{debt.payments.length === 1 ? "" : "s"}
              </p>
            )}
          </div>
          {debt.payments.length === 0 ? (
            <div className="bg-gray-50 dark:bg-gray-800/60 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl px-4 py-6 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">No payments yet</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                {iOwe
                  ? "Record a payment when you pay them back"
                  : "Record a payment when you receive one"}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {debt.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400">
                    <HandCoins size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                      ${Number(p.amount).toFixed(2)}
                    </p>
                    {p.notes && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {p.notes}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 tabular-nums">
                    {formatESTDate(p.date, { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action row */}
        <div className="pt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={handlePay}
            disabled={debt.settled}
            className={`flex-1 flex items-center justify-center gap-2 font-medium py-2.5 px-4 rounded-xl transition-all text-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
              iOwe
                ? "bg-red-600 hover:bg-red-700 hover:shadow-red-600/20"
                : "bg-green-600 hover:bg-green-700 hover:shadow-green-600/20"
            }`}
          >
            <HandCoins size={16} />
            {iOwe ? "Pay" : "Receive Payment"}
          </button>
          <button
            type="button"
            onClick={handleEdit}
            aria-label="Edit debt"
            className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            aria-label="Delete debt"
            className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/60 text-red-600 dark:text-red-400 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
