"use client";

import { useMemo, useState } from "react";
import {
  Repeat, Plus, CalendarClock, Wallet, CreditCard as CardIcon, Zap,
  ArrowDownCircle, ArrowUpCircle, PauseCircle, Scale,
} from "lucide-react";
import AddRecurringRuleModal from "@/components/AddRecurringRuleModal";
import AnimatedNumber from "@/components/animated/AnimatedNumber";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useRecurringRules, type RecurringRuleInput } from "@/hooks/useRecurring";
import { useExpenses } from "@/hooks/useExpenses";
import { useCashAccounts } from "@/hooks/useCashAccounts";
import { useCreditCards } from "@/hooks/useCreditCards";
import { advanceDueDate, firstDueOnOrAfterToday, upcomingOccurrences, RULE_FREQ_LABEL } from "@/lib/recurring";
import { todayEST, formatESTDate } from "@/lib/dates";
import type { RecurringRule, RecurringFrequency, Expense } from "@/lib/types";

function daysUntil(isoDate: string): number {
  const today = new Date(todayEST() + "T12:00:00").getTime();
  const due = new Date(isoDate + "T12:00:00").getTime();
  return Math.round((due - today) / 86400000);
}

function dueLabel(isoDate: string): string {
  const d = daysUntil(isoDate);
  if (d <= 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d <= 14) return `In ${d} days`;
  return formatESTDate(isoDate, { month: "short", day: "numeric" });
}

const EXPENSE_FREQ_TO_RULE: Record<string, RecurringFrequency> = {
  Weekly: "weekly",
  Biweekly: "biweekly",
  Monthly: "monthly",
  Yearly: "yearly",
};

export default function RecurringPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { rules, totals, loading, createRule, updateRule, deleteRule } = useRecurringRules();
  const { expenses } = useExpenses();
  const { accounts } = useCashAccounts();
  const { cards } = useCreditCards();

  const [showModal, setShowModal] = useState(false);
  const [editRule, setEditRule] = useState<RecurringRule | null>(null);

  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name || null;
  const cardName = (id: string | null) => {
    const c = cards.find((x) => x.id === id);
    return c ? `${c.name}${c.last_four ? ` ••${c.last_four}` : ""}` : null;
  };

  const expenseRules = rules.filter((r) => r.kind === "expense");
  const incomeRules = rules.filter((r) => r.kind === "income");

  // Next 30 days schedule, date-grouped
  const schedule = useMemo(() => {
    const byDate = new Map<string, { rule: RecurringRule; date: string }[]>();
    for (const rule of rules.filter((r) => r.active)) {
      for (const date of upcomingOccurrences(rule, 30)) {
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date)!.push({ rule, date });
      }
    }
    return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [rules]);

  const weekAhead = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const [date, items] of schedule) {
      if (daysUntil(date) > 7) continue;
      for (const { rule } of items) {
        count++;
        total += rule.kind === "expense" ? -Number(rule.amount) : Number(rule.amount);
      }
    }
    return { total, count };
  }, [schedule]);

  // Recurring-flagged expenses that don't have a rule yet → automation suggestions
  const suggestions = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 120);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    const seen = new Map<string, Expense>();
    for (const e of expenses) {
      if (!e.recurring || e.is_card_payment || !e.frequency || e.frequency === "One-time") continue;
      if (e.date < cutoffStr) continue;
      const key = `${e.name.trim().toLowerCase()}|${Number(e.amount).toFixed(2)}`;
      const existing = seen.get(key);
      if (!existing || e.date > existing.date) seen.set(key, e);
    }
    return [...seen.values()].filter((e) =>
      !rules.some((r) => r.name.trim().toLowerCase() === e.name.trim().toLowerCase() && Math.abs(Number(r.amount) - Number(e.amount)) < 0.01)
    ).slice(0, 6);
  }, [expenses, rules]);

  const automateSuggestion = async (e: Expense) => {
    const frequency = EXPENSE_FREQ_TO_RULE[e.frequency || "Monthly"] || "monthly";
    const dom = frequency === "monthly" || frequency === "yearly" ? Math.min(28, Number(e.date.split("-")[2]) || 1) : null;
    // Start strictly AFTER the already-logged occurrence so nothing double-applies.
    const next = firstDueOnOrAfterToday(advanceDueDate(e.date, frequency, dom), frequency, dom);
    try {
      await createRule({
        kind: "expense",
        name: e.name,
        category: e.category,
        amount: Number(e.amount),
        frequency,
        day_of_month: dom,
        payment_method: e.payment_method === "credit" ? "credit" : "debit",
        credit_card_id: e.payment_method === "credit" ? e.credit_card_id : null,
        cash_account_id: e.payment_method === "credit" ? null : e.cash_account_id,
        income_type: "main",
        next_due_date: next,
        active: true,
        autopay: true,
        notes: null,
      });
      toast.success(`"${e.name}" automated — next on ${formatESTDate(next, { month: "short", day: "numeric" })}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create rule");
    }
  };

  const handleSave = async (data: RecurringRuleInput, id?: string) => {
    try {
      if (id) { await updateRule(id, data); toast.success("Rule updated"); }
      else { await createRule(data); toast.success(`Rule created — first run ${formatESTDate(data.next_due_date, { month: "short", day: "numeric" })}`); }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save rule");
      throw err;
    }
  };

  const RuleRow = ({ rule }: { rule: RecurringRule }) => {
    const isExpense = rule.kind === "expense";
    const payChip = isExpense
      ? rule.payment_method === "credit"
        ? cardName(rule.credit_card_id)
        : accountName(rule.cash_account_id)
      : accountName(rule.cash_account_id);
    return (
      <div
        onClick={() => { setEditRule(rule); setShowModal(true); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditRule(rule); setShowModal(true); } }}
        role="button"
        tabIndex={0}
        aria-label={`Edit ${rule.name}`}
        className={`flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer ${!rule.active ? "opacity-50" : ""}`}
      >
        <div className={`p-2 rounded-lg shrink-0 ${isExpense ? "bg-red-50 dark:bg-red-950/40" : "bg-green-50 dark:bg-green-950/40"}`}>
          {isExpense ? <ArrowDownCircle size={16} className="text-red-600 dark:text-red-400" /> : <ArrowUpCircle size={16} className="text-green-600 dark:text-green-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{rule.name}</p>
            {!rule.active && <PauseCircle size={13} className="text-gray-400 shrink-0" />}
            {!rule.autopay && rule.active && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 shrink-0">Manual</span>
            )}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
            {rule.category} · {RULE_FREQ_LABEL[rule.frequency]}
            {rule.frequency === "monthly" && rule.day_of_month ? ` (day ${rule.day_of_month})` : ""}
            {payChip ? ` · ${payChip}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-semibold tabular-nums ${isExpense ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
            {isExpense ? "-" : "+"}${Number(rule.amount).toFixed(2)}
          </p>
          <p className={`text-xs ${daysUntil(rule.next_due_date) <= 3 && rule.active ? "text-amber-600 dark:text-amber-400 font-medium" : "text-gray-400 dark:text-gray-500"}`}>
            {rule.active ? dueLabel(rule.next_due_date) : "Paused"}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Recurring</h1>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5">Bills and income that log themselves and update your balances</p>
        </div>
        <button onClick={() => { setEditRule(null); setShowModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 hover:shadow-lg hover:shadow-blue-600/20 shrink-0 self-start sm:self-auto">
          <Plus size={16} /><span>New Rule</span>
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Monthly Bills</span>
            <div className="p-1.5 rounded-md bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"><ArrowDownCircle size={14} /></div>
          </div>
          <AnimatedNumber value={totals.monthlyExpenses} prefix="$" className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400" />
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Monthly Income</span>
            <div className="p-1.5 rounded-md bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400"><ArrowUpCircle size={14} /></div>
          </div>
          <AnimatedNumber value={totals.monthlyIncome} prefix="$" className="text-xl font-bold tabular-nums text-green-600 dark:text-green-400" />
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Net Monthly</span>
            <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"><Scale size={14} /></div>
          </div>
          <AnimatedNumber value={totals.monthlyNet} prefix="$" className={`text-xl font-bold tabular-nums ${totals.monthlyNet >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} />
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Next 7 Days</span>
            <div className="p-1.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"><CalendarClock size={14} /></div>
          </div>
          <p className={`text-xl font-bold tabular-nums ${weekAhead.total >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {weekAhead.total >= 0 ? "+" : "-"}${Math.abs(weekAhead.total).toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{weekAhead.count} item{weekAhead.count === 1 ? "" : "s"} due</p>
        </div>
      </div>

      {/* Automation suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={15} className="text-amber-600 dark:text-amber-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Automate these?</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">Recurring expenses you&apos;ve logged that aren&apos;t automated yet</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {suggestions.map((e) => (
              <div key={e.id} className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-amber-100 dark:border-amber-900/60 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{e.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">${Number(e.amount).toFixed(2)} · {e.frequency}</p>
                </div>
                <button onClick={() => automateSuggestion(e)}
                  className="text-xs font-medium bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/70 text-amber-800 dark:text-amber-300 px-2.5 py-1.5 rounded-md shrink-0 transition-colors">
                  Automate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {rules.length === 0 && !loading ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <EmptyState
            icon={Repeat}
            title="No recurring rules yet"
            description="Set up rent, subscriptions, insurance or your paycheck once — each due date they're logged automatically and your checking balance updates itself."
            action={{ label: "Create your first rule", onClick: () => { setEditRule(null); setShowModal(true); } }}
          />
        </div>
      ) : rules.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Rules lists */}
          <div className="lg:col-span-2 space-y-6">
            {expenseRules.length > 0 && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                  <CardIcon size={15} className="text-gray-400 dark:text-gray-500" />
                  <h2 className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Bills & Subscriptions ({expenseRules.length})</h2>
                </div>
                <div className="p-3 space-y-1">
                  {expenseRules.map((r) => <RuleRow key={r.id} rule={r} />)}
                </div>
              </div>
            )}
            {incomeRules.length > 0 && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                  <Wallet size={15} className="text-gray-400 dark:text-gray-500" />
                  <h2 className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Recurring Income ({incomeRules.length})</h2>
                </div>
                <div className="p-3 space-y-1">
                  {incomeRules.map((r) => <RuleRow key={r.id} rule={r} />)}
                </div>
              </div>
            )}
          </div>

          {/* 30-day schedule */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm h-fit">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
              <CalendarClock size={15} className="text-gray-400 dark:text-gray-500" />
              <h2 className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Next 30 Days</h2>
            </div>
            <div className="p-3 space-y-3 max-h-[480px] overflow-y-auto">
              {schedule.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Nothing scheduled</p>
              ) : (
                schedule.map(([date, items]) => (
                  <div key={date}>
                    <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-2 mb-1">
                      {dueLabel(date)} · {formatESTDate(date, { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    <div className="space-y-0.5">
                      {items.map(({ rule }) => (
                        <div key={`${date}-${rule.id}`} className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800">
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{rule.name}</span>
                          <span className={`text-sm font-medium tabular-nums shrink-0 ml-2 ${rule.kind === "expense" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                            {rule.kind === "expense" ? "-" : "+"}${Number(rule.amount).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <AddRecurringRuleModal
        isOpen={showModal}
        rule={editRule}
        onClose={() => { setShowModal(false); setEditRule(null); }}
        onSave={handleSave}
        onDelete={async (id) => {
          const ok = await confirm({
            title: "Delete this rule?",
            message: "Already-logged expenses and income stay — only future automation stops.",
            confirmLabel: "Delete",
            destructive: true,
          });
          if (ok) { await deleteRule(id); toast.success("Rule deleted"); }
        }}
      />
    </div>
  );
}
