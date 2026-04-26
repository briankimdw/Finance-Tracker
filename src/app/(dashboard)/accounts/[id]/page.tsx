"use client";

/**
 * Full activity report for a single cash account.
 *
 * Aggregates every "money in" / "money out" event tied to this account into
 * one chronological timeline grouped by month. Sources merged here:
 *   - Transfers (in / out)
 *   - Debt payments (receives if direction='they_owe', payouts if 'i_owe')
 *   - Expenses paid from this account (cash_account_id matches)
 *
 * Linked from CashAccountDetailsSheet via "See all" links on its recent
 * activity sections.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, Wallet, PiggyBank, Banknote, Coins,
  ArrowDown, ArrowUp, ArrowLeftRight, HandCoins, CreditCard, Receipt,
} from "lucide-react";
import { useCashAccounts } from "@/hooks/useCashAccounts";
import { useCreditCards } from "@/hooks/useCreditCards";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeRefetch } from "@/lib/useRealtimeRefetch";
import { formatESTDate } from "@/lib/dates";
import type { CashAccountType } from "@/lib/types";

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

type ActivityKind = "receive" | "payout" | "transfer-in" | "transfer-out" | "expense" | "card-payment";

interface ActivityRow {
  id: string;
  kind: ActivityKind;
  date: string;        // YYYY-MM-DD
  amount: number;      // always positive — sign comes from kind
  signed: number;      // +X for incoming, -X for outgoing
  title: string;
  subtitle: string;
  notes: string | null;
  // Optional links for click-through
  href?: string;
}

interface MonthGroup {
  monthKey: string;        // "2025-04"
  monthLabel: string;      // "April 2025"
  rows: ActivityRow[];
  inflow: number;
  outflow: number;
  net: number;
}

function kindMeta(kind: ActivityKind) {
  switch (kind) {
    case "receive":
      return { Icon: ArrowDown, accent: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-950/40" };
    case "transfer-in":
      return { Icon: ArrowLeftRight, accent: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950/40" };
    case "payout":
      return { Icon: ArrowUp, accent: "text-rose-600 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-950/40" };
    case "transfer-out":
      return { Icon: ArrowLeftRight, accent: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-950/40" };
    case "expense":
      return { Icon: Receipt, accent: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-950/40" };
    case "card-payment":
      return { Icon: CreditCard, accent: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950/40" };
  }
}

const KIND_LABEL: Record<ActivityKind, string> = {
  receive: "Receive",
  payout: "Payout",
  "transfer-in": "Transfer in",
  "transfer-out": "Transfer out",
  expense: "Expense",
  "card-payment": "Card payment",
};

export default function AccountHistoryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const accountId = params?.id;
  const { user } = useAuth();
  const { accounts } = useCashAccounts();
  const { cards } = useCreditCards();
  const supabase = createClient();
  const account = accounts.find((a) => a.id === accountId) ?? null;

  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "in" | "out">("all");
  const [kindFilter, setKindFilter] = useState<ActivityKind | "all">("all");

  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const fetchActivity = useMemo(
    () => async () => {
      if (!accountId) return;
      setLoading(true);
      try {
        const filters = (q: ReturnType<typeof supabase.from>) =>
          user ? q.eq("user_id", user.id) : q.is("user_id", null);

        // Transfers — either side
        const transfersP = filters(
          supabase.from("transfers").select("id, from_account_id, to_account_id, amount, date, notes, created_at")
            .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`)
            .order("date", { ascending: false })
            .order("created_at", { ascending: false })
        ) as unknown as Promise<{ data: { id: string; from_account_id: string | null; to_account_id: string | null; amount: number; date: string; notes: string | null }[] | null }>;

        // Debt payments — tied to this account
        const dpP = filters(
          supabase.from("debt_payments").select("id, amount, date, notes, debts(person, direction, description)")
            .eq("cash_account_id", accountId)
            .order("date", { ascending: false })
            .order("created_at", { ascending: false })
        ) as unknown as Promise<{ data: { id: string; amount: number; date: string; notes: string | null; debts: { person: string; direction: "i_owe" | "they_owe"; description: string | null } | { person: string; direction: "i_owe" | "they_owe"; description: string | null }[] | null }[] | null }>;

        // Expenses paid from this account (includes card payments funded by it)
        const expensesP = filters(
          supabase.from("expenses").select("id, name, category, amount, date, notes, payment_method, credit_card_id, is_card_payment")
            .eq("cash_account_id", accountId)
            .order("date", { ascending: false })
            .order("created_at", { ascending: false })
        ) as unknown as Promise<{ data: { id: string; name: string; category: string; amount: number; date: string; notes: string | null; payment_method: string; credit_card_id: string | null; is_card_payment: boolean }[] | null }>;

        const [transfersR, dpR, expensesR] = await Promise.all([transfersP, dpP, expensesP]);

        const merged: ActivityRow[] = [];

        // Transfers
        for (const t of transfersR.data ?? []) {
          const incoming = t.to_account_id === accountId;
          const otherAccount = incoming ? t.from_account_id : t.to_account_id;
          const otherName = (otherAccount && accountMap.get(otherAccount)?.name) || "another account";
          const amt = Math.abs(Number(t.amount));
          merged.push({
            id: `t-${t.id}`,
            kind: incoming ? "transfer-in" : "transfer-out",
            date: t.date,
            amount: amt,
            signed: incoming ? amt : -amt,
            title: incoming ? `From ${otherName}` : `To ${otherName}`,
            subtitle: "Transfer",
            notes: t.notes,
          });
        }

        // Debt payments
        for (const p of dpR.data ?? []) {
          const debt = Array.isArray(p.debts) ? p.debts[0] : p.debts;
          const incoming = debt?.direction === "they_owe";
          const personName = debt?.person ?? "Unknown";
          const amt = Math.abs(Number(p.amount));
          merged.push({
            id: `dp-${p.id}`,
            kind: incoming ? "receive" : "payout",
            date: p.date,
            amount: amt,
            signed: incoming ? amt : -amt,
            title: incoming ? `From ${personName}` : `To ${personName}`,
            subtitle: incoming ? "Money received" : "Paid out",
            notes: p.notes ?? debt?.description ?? null,
            href: "/debts",
          });
        }

        // Expenses (incl. card payments)
        for (const e of expensesR.data ?? []) {
          const amt = Math.abs(Number(e.amount));
          if (e.is_card_payment) {
            const card = e.credit_card_id ? cardMap.get(e.credit_card_id) : null;
            merged.push({
              id: `e-${e.id}`,
              kind: "card-payment",
              date: e.date,
              amount: amt,
              signed: -amt,
              title: card ? `Paid ${card.name}` : e.name,
              subtitle: "Credit card payment",
              notes: e.notes,
            });
          } else {
            merged.push({
              id: `e-${e.id}`,
              kind: "expense",
              date: e.date,
              amount: amt,
              signed: -amt,
              title: e.name,
              subtitle: e.category,
              notes: e.notes,
            });
          }
        }

        // Sort by date desc
        merged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

        setActivity(merged);
      } catch (err) {
        console.error("[AccountHistory] fetch failed:", err);
        setActivity([]);
      } finally {
        setLoading(false);
      }
    },
    [accountId, user, supabase, accountMap, cardMap]
  );

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);
  useRealtimeRefetch(["transfers", "debt_payments", "expenses", "cash_accounts"], fetchActivity);

  // Apply filters
  const filteredActivity = useMemo(() => {
    return activity.filter((r) => {
      if (filter === "in" && r.signed < 0) return false;
      if (filter === "out" && r.signed > 0) return false;
      if (kindFilter !== "all" && r.kind !== kindFilter) return false;
      return true;
    });
  }, [activity, filter, kindFilter]);

  // Group by month
  const monthGroups = useMemo<MonthGroup[]>(() => {
    const groups = new Map<string, MonthGroup>();
    for (const row of filteredActivity) {
      const monthKey = row.date.slice(0, 7);
      if (!groups.has(monthKey)) {
        const [y, m] = monthKey.split("-");
        const monthLabel = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });
        groups.set(monthKey, {
          monthKey,
          monthLabel,
          rows: [],
          inflow: 0,
          outflow: 0,
          net: 0,
        });
      }
      const g = groups.get(monthKey)!;
      g.rows.push(row);
      if (row.signed > 0) g.inflow += row.signed;
      else g.outflow += -row.signed;
      g.net += row.signed;
    }
    return Array.from(groups.values()).sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1));
  }, [filteredActivity]);

  const totalIn = activity.filter((r) => r.signed > 0).reduce((s, r) => s + r.signed, 0);
  const totalOut = activity.filter((r) => r.signed < 0).reduce((s, r) => s + -r.signed, 0);

  if (!accountId) {
    return <div className="text-center py-20 text-gray-400 dark:text-gray-500">No account.</div>;
  }
  if (!account) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading account…</p>
        <Link href="/cards" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">← Back to Cards</Link>
      </div>
    );
  }

  const Icon = ACCOUNT_ICON[account.type];
  const balance = Number(account.balance);

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.back()}
        className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 transition-colors"
      >
        <ArrowLeft size={12} /> Back
      </button>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${account.color}20`, color: account.color }}
          >
            <Icon size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{account.name}</h1>
              <span
                className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${account.color}20`, color: account.color }}
              >
                {TYPE_LABEL[account.type]}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Full activity report — every receive, payout, transfer, and expense linked to this account.</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">Balance</p>
            <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">${balance.toFixed(2)}</p>
          </div>
        </div>
      </motion.div>

      {/* Lifetime totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile label="Money in" value={`+$${totalIn.toFixed(2)}`} accent="text-green-600 dark:text-green-400" />
        <StatTile label="Money out" value={`−$${totalOut.toFixed(2)}`} accent="text-red-600 dark:text-red-400" />
        <StatTile label="Entries" value={String(activity.length)} accent="text-gray-900 dark:text-gray-100" />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 shadow-sm">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Direction filter */}
          {([
            { v: "all", label: "All" },
            { v: "in", label: "Money in" },
            { v: "out", label: "Money out" },
          ] as const).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setFilter(opt.v)}
              className={`text-xs px-2.5 py-1.5 rounded-md font-medium border transition-colors ${
                filter === opt.v
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {opt.label}
            </button>
          ))}

          <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

          {/* Kind filter */}
          {(["all", "receive", "payout", "transfer-in", "transfer-out", "expense", "card-payment"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKindFilter(k)}
              className={`text-xs px-2.5 py-1.5 rounded-md font-medium border transition-colors ${
                kindFilter === k
                  ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {k === "all" ? "All types" : KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">Loading activity…</div>
      ) : monthGroups.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center">
          <HandCoins size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No activity yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Receives, transfers, and expenses tied to this account will show up here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {monthGroups.map((g) => (
            <section key={g.monthKey} className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{g.monthLabel}</h2>
                <div className="flex items-center gap-3 text-[11px] tabular-nums">
                  <span className="text-green-600 dark:text-green-400">+${g.inflow.toFixed(2)}</span>
                  <span className="text-red-600 dark:text-red-400">−${g.outflow.toFixed(2)}</span>
                  <span className={`font-semibold ${g.net >= 0 ? "text-gray-900 dark:text-gray-100" : "text-red-600 dark:text-red-400"}`}>
                    Net {g.net >= 0 ? "+" : "−"}${Math.abs(g.net).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
                {g.rows.map((row, i) => {
                  const meta = kindMeta(row.kind);
                  const Inner = (
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
                        <meta.Icon size={15} className={meta.accent} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{row.title}</p>
                          <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 shrink-0">{KIND_LABEL[row.kind]}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                          {row.subtitle} · {formatESTDate(row.date, { month: "short", day: "numeric", year: "numeric" })}
                          {row.notes ? ` · ${row.notes}` : ""}
                        </p>
                      </div>
                      <span className={`text-sm font-semibold tabular-nums shrink-0 ${row.signed >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {row.signed >= 0 ? "+" : "−"}${row.amount.toFixed(2)}
                      </span>
                    </div>
                  );
                  return (
                    <div key={row.id} className={i > 0 ? "border-t border-gray-100 dark:border-gray-800" : ""}>
                      {row.href ? <Link href={row.href}>{Inner}</Link> : Inner}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
      <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold tabular-nums mt-1 ${accent}`}>{value}</p>
    </div>
  );
}
