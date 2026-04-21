"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Wallet, PiggyBank, Banknote, Coins,
  Pencil, ArrowLeftRight, Trash2, ArrowRight, Target,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useCashAccounts } from "@/hooks/useCashAccounts";
import { useGoals } from "@/hooks/useGoals";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { getGoalIcon } from "@/lib/goalIcons";
import { formatESTDate } from "@/lib/dates";
import type { CashAccount, CashAccountType } from "@/lib/types";

const ACCOUNT_ICON: Record<CashAccountType, typeof Wallet> = {
  checking: Wallet,
  savings: PiggyBank,
  cash: Banknote,
  other: Coins,
};

const TYPE_LABEL: Record<CashAccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  cash: "Cash",
  other: "Other",
};

interface GoalReservation {
  goalId: string;
  goalName: string;
  goalColor: string;
  goalIcon: string;
  amount: number;
}

interface TransferRow {
  id: string;
  from_account_id: string | null;
  to_account_id: string | null;
  amount: number;
  date: string;
  notes: string | null;
}

interface CashAccountDetailsSheetProps {
  isOpen: boolean;
  accountId: string | null;
  onClose: () => void;
  onEdit: (account: CashAccount) => void;
  onTransfer: (fromAccountId: string) => void;
  onDelete: (id: string) => void;
}

export default function CashAccountDetailsSheet({
  isOpen,
  accountId,
  onClose,
  onEdit,
  onTransfer,
  onDelete,
}: CashAccountDetailsSheetProps) {
  const { accounts } = useCashAccounts();
  const { goals } = useGoals();
  const { user } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const supabase = createClient();

  const account = accounts.find((a) => a.id === accountId) ?? null;

  const [reservations, setReservations] = useState<GoalReservation[]>([]);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Fetch reservations (contributions) + recent transfers when open + account change
  useEffect(() => {
    if (!isOpen || !accountId) return;
    let cancelled = false;

    const run = async () => {
      setLoadingData(true);
      try {
        // Contributions from this account, grouped by goal_id (excluding completed goals)
        let contribQ = supabase
          .from("goal_contributions")
          .select("goal_id, amount")
          .eq("source_cash_account_id", accountId);
        if (user) contribQ = contribQ.eq("user_id", user.id);
        else contribQ = contribQ.is("user_id", null);

        // Recent transfers where this account is either from or to
        let transfersQ = supabase
          .from("transfers")
          .select("id, from_account_id, to_account_id, amount, date, notes")
          .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(8);
        if (user) transfersQ = transfersQ.eq("user_id", user.id);
        else transfersQ = transfersQ.is("user_id", null);

        const [contribRes, transfersRes] = await Promise.all([contribQ, transfersQ]);
        if (cancelled) return;

        // Group contributions by goal
        type ContribRow = { goal_id: string; amount: number | string };
        const rowsByGoal = new Map<string, number>();
        for (const c of (contribRes.data || []) as ContribRow[]) {
          rowsByGoal.set(c.goal_id, (rowsByGoal.get(c.goal_id) || 0) + Number(c.amount));
        }

        const out: GoalReservation[] = [];
        for (const [goalId, amount] of rowsByGoal.entries()) {
          if (amount <= 0) continue;
          const g = goals.find((gg) => gg.id === goalId);
          if (!g || g.completed) continue;
          out.push({
            goalId,
            goalName: g.name,
            goalColor: g.color,
            goalIcon: g.icon,
            amount: Math.round(amount * 100) / 100,
          });
        }
        out.sort((a, b) => b.amount - a.amount);
        setReservations(out);
        setTransfers((transfersRes.data || []) as TransferRow[]);
      } catch {
        if (!cancelled) {
          setReservations([]);
          setTransfers([]);
        }
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [isOpen, accountId, user, supabase, goals]);

  if (!account) return null;

  const Icon = ACCOUNT_ICON[account.type];
  const balance = Number(account.balance);
  const reserved = account.reserved ?? 0;
  const free = balance - reserved;
  const reservedPct = balance > 0 ? Math.min(100, (reserved / balance) * 100) : 0;
  const freePct = Math.max(0, 100 - reservedPct);

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete ${account.name}?`,
      message: "This will permanently remove the account. Contributions sourced from this account will lose their link but stay attached to their goals.",
      destructive: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await onDelete(account.id);
      toast.success(`${account.name} deleted`);
      onClose();
    } catch {
      toast.error("Failed to delete account");
    }
  };

  const canTransfer = accounts.length >= 2;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} size="lg" title={account.name}>
      <div className="space-y-5">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="flex items-center gap-3"
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: `${account.color}20`, color: account.color }}
          >
            <Icon size={26} />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              {account.name}
            </p>
            <span
              className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ background: `${account.color}15`, color: account.color }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: account.color }}
              />
              {TYPE_LABEL[account.type]}
            </span>
          </div>
        </motion.div>

        {/* Big balance */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.04 }}
          className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4"
        >
          <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Balance
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums mt-1">
            ${balance.toFixed(2)}
          </p>

          {reserved > 0 && (
            <div className="mt-3">
              {/* Two-tone bar */}
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                <div
                  className="h-full"
                  style={{ width: `${reservedPct}%`, background: account.color }}
                />
                <div
                  className="h-full"
                  style={{
                    width: `${freePct}%`,
                    background: free >= 0 ? "#10b981" : "#ef4444",
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-medium tabular-nums mt-1.5">
                <span className="text-gray-500 dark:text-gray-400">
                  <span
                    className="inline-block w-2 h-2 rounded-sm mr-1 align-middle"
                    style={{ background: account.color }}
                  />
                  ${reserved.toFixed(2)} reserved
                </span>
                <span
                  className={
                    free >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }
                >
                  <span
                    className="inline-block w-2 h-2 rounded-sm mr-1 align-middle"
                    style={{ background: free >= 0 ? "#10b981" : "#ef4444" }}
                  />
                  ${free.toFixed(2)} free
                </span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Reservations */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target size={14} className="text-gray-400 dark:text-gray-500" />
            <h3 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Reserved For
            </h3>
          </div>
          {loadingData ? (
            <div className="text-xs text-gray-400 dark:text-gray-500 py-3">Loading…</div>
          ) : reservations.length === 0 ? (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
              Nothing reserved from this account.
            </div>
          ) : (
            <div className="space-y-1.5">
              {reservations.map((r) => {
                const GoalIconComp = getGoalIcon(r.goalIcon);
                return (
                  <Link
                    key={r.goalId}
                    href="/goals"
                    className="group flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    onClick={onClose}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${r.goalColor}20`, color: r.goalColor }}
                    >
                      <GoalIconComp size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {r.goalName}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Goal reservation
                      </p>
                    </div>
                    <span
                      className="text-sm font-semibold tabular-nums shrink-0"
                      style={{ color: r.goalColor }}
                    >
                      ${r.amount.toFixed(2)}
                    </span>
                    <ArrowRight
                      size={14}
                      className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500 shrink-0 transition-colors"
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent activity (transfers) */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ArrowLeftRight size={14} className="text-gray-400 dark:text-gray-500" />
            <h3 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Recent Transfers
            </h3>
          </div>
          {loadingData ? (
            <div className="text-xs text-gray-400 dark:text-gray-500 py-3">Loading…</div>
          ) : transfers.length === 0 ? (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
              No transfers involving this account yet.
            </div>
          ) : (
            <div className="space-y-1.5">
              {transfers.map((t) => {
                const incoming = t.to_account_id === account.id;
                const otherAccountId = incoming ? t.from_account_id : t.to_account_id;
                const otherAccount = accounts.find((a) => a.id === otherAccountId);
                const otherName = otherAccount?.name ?? "Unknown account";
                const sign = incoming ? "+" : "−";
                const amountClass = incoming
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400";
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        incoming
                          ? "bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400"
                          : "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                      }`}
                    >
                      <ArrowRight
                        size={15}
                        className={incoming ? "" : "rotate-180"}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {incoming ? `From ${otherName}` : `To ${otherName}`}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Transfer · {formatESTDate(t.date, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums shrink-0 ${amountClass}`}>
                      {sign}${Number(t.amount).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={() => {
              onEdit(account);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-xl transition-colors"
          >
            <Pencil size={14} /> Edit
          </button>
          {canTransfer && (
            <button
              type="button"
              onClick={() => {
                onTransfer(account.id);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-blue-600/20"
            >
              <ArrowLeftRight size={14} /> Transfer
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            aria-label={`Delete ${account.name}`}
            className="flex items-center justify-center gap-1.5 text-sm font-medium bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800 px-4 py-2.5 rounded-xl transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
