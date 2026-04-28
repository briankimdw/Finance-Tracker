"use client";

/**
 * Full activity report for a single credit card.
 *
 * Shows every charge, payment, and refund tied to this card, grouped by
 * statement-style months. Linked from CreditCardDetailsSheet via "See all".
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, CreditCard as CardIcon, ArrowUpRight, ArrowDownRight, Undo2, Receipt,
  Calendar,
} from "lucide-react";
import { useCreditCards } from "@/hooks/useCreditCards";
import { useCashAccounts } from "@/hooks/useCashAccounts";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeRefetch } from "@/lib/useRealtimeRefetch";
import { formatESTDate } from "@/lib/dates";
import EditExpenseModal from "@/components/EditExpenseModal";
import type { Expense } from "@/lib/types";

type Kind = "charge" | "payment" | "refund";

interface Row {
  id: string;
  kind: Kind;
  date: string;
  name: string;
  category: string;
  amount: number;       // always positive
  signed: number;       // contribution to balance: + for charges, − for payments/refunds
  notes: string | null;
  fundingAccountName: string | null;
  fundingAccountColor: string | null;
  // Full expense row carried through so we can open EditExpenseModal on click
  expense: Expense;
}

interface MonthGroup {
  monthKey: string;
  monthLabel: string;
  rows: Row[];
  charges: number;
  payments: number;
  refunds: number;
  net: number;
}

function kindMeta(k: Kind) {
  switch (k) {
    case "charge":
      return { Icon: ArrowUpRight, label: "Charge", bg: "bg-red-100 dark:bg-red-950/40", accent: "text-red-600 dark:text-red-400" };
    case "payment":
      return { Icon: ArrowDownRight, label: "Payment", bg: "bg-green-100 dark:bg-green-950/40", accent: "text-green-600 dark:text-green-400" };
    case "refund":
      return { Icon: Undo2, label: "Refund", bg: "bg-blue-100 dark:bg-blue-950/40", accent: "text-blue-600 dark:text-blue-400" };
  }
}

export default function CardHistoryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const cardId = params?.id;
  const { user } = useAuth();
  const { cards } = useCreditCards();
  const { accounts } = useCashAccounts();
  const supabase = createClient();
  const card = cards.find((c) => c.id === cardId) ?? null;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const fetch = useMemo(
    () => async () => {
      if (!cardId) return;
      setLoading(true);
      try {
        let q = supabase
          .from("expenses")
          .select("*")
          .eq("credit_card_id", cardId)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false });
        if (user) q = q.eq("user_id", user.id);
        else q = q.is("user_id", null);
        const { data } = await q;

        const out: Row[] = ((data || []) as Expense[]).map((e) => {
          const amtRaw = Number(e.amount);
          const isRefund = !e.is_card_payment && amtRaw < 0;
          const kind: Kind = e.is_card_payment ? "payment" : isRefund ? "refund" : "charge";
          const amt = Math.abs(amtRaw);
          const signed = kind === "charge" ? amt : -amt;
          const acc = e.cash_account_id ? accountMap.get(e.cash_account_id) : null;
          return {
            id: e.id,
            kind,
            date: e.date,
            name: e.name,
            category: e.category,
            amount: amt,
            signed,
            notes: e.notes,
            fundingAccountName: acc?.name ?? null,
            fundingAccountColor: acc?.color ?? null,
            expense: e,
          };
        });

        setRows(out);
      } catch (err) {
        console.error("[CardHistory] fetch failed:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [cardId, user, supabase, accountMap]
  );

  useEffect(() => {
    fetch();
  }, [fetch]);
  useRealtimeRefetch(["expenses", "credit_cards"], fetch);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.kind === filter);
  }, [rows, filter]);

  const monthGroups = useMemo<MonthGroup[]>(() => {
    const groups = new Map<string, MonthGroup>();
    for (const r of filtered) {
      const key = r.date.slice(0, 7);
      if (!groups.has(key)) {
        const [y, m] = key.split("-");
        const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });
        groups.set(key, {
          monthKey: key,
          monthLabel: label,
          rows: [],
          charges: 0,
          payments: 0,
          refunds: 0,
          net: 0,
        });
      }
      const g = groups.get(key)!;
      g.rows.push(r);
      if (r.kind === "charge") g.charges += r.amount;
      else if (r.kind === "payment") g.payments += r.amount;
      else g.refunds += r.amount;
      g.net += r.signed;
    }
    return Array.from(groups.values()).sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1));
  }, [filtered]);

  const totalCharges = rows.filter((r) => r.kind === "charge").reduce((s, r) => s + r.amount, 0);
  const totalPayments = rows.filter((r) => r.kind === "payment").reduce((s, r) => s + r.amount, 0);
  const totalRefunds = rows.filter((r) => r.kind === "refund").reduce((s, r) => s + r.amount, 0);

  if (!cardId) {
    return <div className="text-center py-20 text-gray-400 dark:text-gray-500">No card.</div>;
  }
  if (!card) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading card…</p>
        <Link href="/cards" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">← Back to Cards</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.back()}
        className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 transition-colors"
      >
        <ArrowLeft size={12} /> Back
      </button>

      {/* Card hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl shadow-sm overflow-hidden"
      >
        <div className="p-6 text-white relative" style={{ background: `linear-gradient(135deg, ${card.color}, ${card.color}cc)` }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] opacity-80 uppercase tracking-wider">Credit Card</p>
              <p className="text-2xl font-bold mt-1">{card.name}</p>
              <p className="text-xs font-mono opacity-90 mt-2">•••• •••• •••• {card.last_four || "0000"}</p>
            </div>
            <CardIcon size={26} className="opacity-70" />
          </div>
          <div className="mt-4 flex items-baseline gap-3">
            <div>
              <p className="text-[10px] opacity-80 uppercase tracking-wider">Balance</p>
              <p className="text-2xl font-bold tabular-nums">${card.balance.toFixed(2)}</p>
            </div>
            {card.credit_limit && Number(card.credit_limit) > 0 && (
              <div className="text-right">
                <p className="text-[10px] opacity-80 uppercase tracking-wider">Utilization</p>
                <p className="text-sm font-semibold">{card.utilization.toFixed(1)}% of ${Number(card.credit_limit).toFixed(0)}</p>
              </div>
            )}
            {card.due_day && card.balance > 0 && card.nextDueDate && (
              <div className="ml-auto text-right">
                <p className="text-[10px] opacity-80 uppercase tracking-wider flex items-center gap-1 justify-end"><Calendar size={10} /> Next due</p>
                <p className="text-sm font-semibold">{formatESTDate(card.nextDueDate, { month: "short", day: "numeric" })}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Lifetime totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total charges" value={`$${totalCharges.toFixed(2)}`} accent="text-red-600 dark:text-red-400" />
        <StatTile label="Total payments" value={`$${totalPayments.toFixed(2)}`} accent="text-green-600 dark:text-green-400" />
        <StatTile label="Total refunds" value={`$${totalRefunds.toFixed(2)}`} accent="text-blue-600 dark:text-blue-400" />
        <StatTile label="Entries" value={String(rows.length)} accent="text-gray-900 dark:text-gray-100" />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 shadow-sm">
        <div className="flex flex-wrap gap-2 items-center">
          {([
            { v: "all", label: "All", count: rows.length },
            { v: "charge", label: "Charges", count: rows.filter((r) => r.kind === "charge").length },
            { v: "payment", label: "Payments", count: rows.filter((r) => r.kind === "payment").length },
            { v: "refund", label: "Refunds", count: rows.filter((r) => r.kind === "refund").length },
          ] as const).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setFilter(opt.v)}
              className={`text-xs px-2.5 py-1.5 rounded-md font-medium border transition-colors flex items-center gap-1.5 ${
                filter === opt.v
                  ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {opt.label}
              <span className={`text-[10px] px-1 rounded ${filter === opt.v ? "bg-white/20 dark:bg-gray-900/20" : "bg-gray-100 dark:bg-gray-800"}`}>
                {opt.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">Loading activity…</div>
      ) : monthGroups.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center">
          <Receipt size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No activity yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Charges, payments, and refunds tied to this card will show up here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {monthGroups.map((g) => (
            <section key={g.monthKey} className="space-y-2">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{g.monthLabel}</h2>
                <div className="flex items-center gap-3 text-[11px] tabular-nums">
                  {g.charges > 0 && <span className="text-red-600 dark:text-red-400">+${g.charges.toFixed(2)} charges</span>}
                  {g.payments > 0 && <span className="text-green-600 dark:text-green-400">−${g.payments.toFixed(2)} paid</span>}
                  {g.refunds > 0 && <span className="text-blue-600 dark:text-blue-400">−${g.refunds.toFixed(2)} refunded</span>}
                  <span className={`font-semibold ${g.net >= 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                    Net {g.net >= 0 ? "+" : "−"}${Math.abs(g.net).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
                {g.rows.map((row, i) => {
                  const meta = kindMeta(row.kind);
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setEditingExpense(row.expense)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${i > 0 ? "border-t border-gray-100 dark:border-gray-800" : ""}`}
                      title="Click to edit — balances rebalance automatically"
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
                        <meta.Icon size={15} className={meta.accent} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{row.name}</p>
                          <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 shrink-0">{meta.label}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                          {row.category} · {formatESTDate(row.date, { month: "short", day: "numeric", year: "numeric" })}
                          {row.fundingAccountName && row.kind === "payment" ? ` · from ${row.fundingAccountName}` : ""}
                          {row.notes ? ` · ${row.notes}` : ""}
                        </p>
                      </div>
                      <span className={`text-sm font-semibold tabular-nums shrink-0 ${row.signed >= 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                        {row.signed >= 0 ? "+" : "−"}${row.amount.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <EditExpenseModal
        isOpen={!!editingExpense}
        expense={editingExpense}
        onClose={() => setEditingExpense(null)}
        onUpdated={() => {
          // Realtime subscription refreshes us automatically; no extra action needed.
        }}
      />
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 shadow-sm">
      <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold tabular-nums mt-0.5 ${accent}`}>{value}</p>
    </div>
  );
}
