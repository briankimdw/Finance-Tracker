"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
  Wallet,
  Activity,
} from "lucide-react";
import { useMonthlyIncomeStats } from "@/hooks/useIncome";
import { useMonthlyExpenseStats, useExpenses } from "@/hooks/useExpenses";
import { useChartData } from "@/hooks/useChartData";
import { useGoals } from "@/hooks/useGoals";
import { useNetWorthHistory } from "@/hooks/useNetWorthHistory";
import { useCashAccounts } from "@/hooks/useCashAccounts";
import type { Expense } from "@/lib/types";

// ---- pure helpers (exported for testing only; tree-shaken in production) ----

/** Average of numbers — returns 0 for empty input. */
function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/**
 * Linear regression over (x, y) points. Returns slope in y-units per x-unit.
 * Returns 0 slope if fewer than 2 points or all x values identical.
 */
function linearSlope(points: { x: number; y: number }[]): number {
  if (points.length < 2) return 0;
  const n = points.length;
  const xMean = mean(points.map((p) => p.x));
  const yMean = mean(points.map((p) => p.y));
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - xMean) * (p.y - yMean);
    den += (p.x - xMean) ** 2;
  }
  if (den === 0) return 0;
  return num / den;
}

/** Format large-ish dollar values with commas, no decimals. Handles negatives. */
function formatDollars(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}

/** Format monthly net with explicit +/- sign. */
function formatSignedDollars(n: number): string {
  if (Math.abs(n) < 0.5) return "$0";
  const sign = n > 0 ? "+" : "-";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}

/** Turn a month offset into a "Feb 2027"-style label. */
function etaLabel(monthsOut: number): string {
  if (!isFinite(monthsOut) || monthsOut <= 0) return "Not on track";
  if (monthsOut > 36) return "3+ years";
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + Math.ceil(monthsOut));
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/**
 * Build an SVG path string (smooth cubic bezier) from a series of 0..1 values.
 * Maps into a box of width w, height h, with small padding.
 */
function sparklinePath(values: number[], w: number, h: number): string {
  if (values.length < 2) return "";
  const pad = 2;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const range = hi - lo || 1;
  const points = values.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (values.length - 1);
    const y = h - pad - ((v - lo) / range) * (h - pad * 2);
    return { x, y };
  });
  // Smooth-step: cubic bezier with midpoint tangents
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    d += ` C ${cx.toFixed(2)} ${prev.y.toFixed(2)}, ${cx.toFixed(2)} ${curr.y.toFixed(2)}, ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
  }
  return d;
}

// ---- category trend helpers ----

interface CategoryTrend {
  category: string;
  pctChange: number; // +0.34 = +34%
  icon: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  "Rent / Mortgage": "\u{1F3E0}",
  Utilities: "\u{1F4A1}",
  Groceries: "\u{1F6D2}",
  "Dining Out": "\u{1F354}",
  Transportation: "\u{1F697}",
  Gas: "\u26FD",
  Insurance: "\u{1F6E1}",
  Subscriptions: "\u{1F4FA}",
  Entertainment: "\u{1F3AC}",
  Shopping: "\u{1F6CD}",
  Health: "\u{1FA7A}",
  Education: "\u{1F4DA}",
  "Phone / Internet": "\u{1F4F1}",
  "Personal Care": "\u{1F484}",
  Gifts: "\u{1F381}",
  Travel: "\u2708",
  "Debt Payment": "\u{1F4B3}",
  Savings: "\u{1F4B0}",
  Taxes: "\u{1F4DC}",
  Other: "\u{1F4B8}",
};

function computeCategoryTrends(
  expenses: Expense[],
  now: Date = new Date()
): CategoryTrend[] {
  if (expenses.length === 0) return [];

  const thisStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisStartStr = thisStart.toISOString().slice(0, 10);
  const lastStartStr = lastStart.toISOString().slice(0, 10);

  const thisMonth = new Map<string, number>();
  const lastMonth = new Map<string, number>();
  for (const e of expenses) {
    if (e.is_card_payment) continue;
    if (e.date >= thisStartStr) {
      thisMonth.set(e.category, (thisMonth.get(e.category) || 0) + Number(e.amount));
    } else if (e.date >= lastStartStr && e.date < thisStartStr) {
      lastMonth.set(e.category, (lastMonth.get(e.category) || 0) + Number(e.amount));
    }
  }

  const cats = new Set<string>([...thisMonth.keys(), ...lastMonth.keys()]);
  const trends: CategoryTrend[] = [];
  for (const c of cats) {
    const t = thisMonth.get(c) || 0;
    const l = lastMonth.get(c) || 0;
    // Skip tiny categories — noisy % changes on small baselines
    if (Math.max(t, l) < 20) continue;
    if (l === 0) continue; // no prior data to compare
    const pctChange = (t - l) / l;
    trends.push({
      category: c,
      pctChange,
      icon: CATEGORY_ICONS[c] || "\u{1F4B8}",
    });
  }
  return trends;
}

// ---- card primitives ----

function MetricCard({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={12} className="text-gray-400 dark:text-gray-500" />
        <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 60;
  const h = 20;
  const d = sparklinePath(values, w, h);
  if (!d) return null;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---- main component ----

export default function FinancialTrajectory() {
  const { mainTotal, sideTotal } = useMonthlyIncomeStats();
  const { total: monthlyExpenses } = useMonthlyExpenseStats();
  const { monthlyData } = useChartData();
  const { goals } = useGoals();
  const { snapshots } = useNetWorthHistory(90);
  const { totalBalance } = useCashAccounts();
  const { expenses } = useExpenses();

  const monthlyIncome = mainTotal + sideTotal;

  // ---- Savings rate: 3-month moving average, plus 6-mo sparkline ----
  const savingsRateSeries = useMemo(() => {
    // Per-month rate; ignore months with no income (undefined rather than 0-divide)
    return monthlyData.map((m) => {
      if (m.income <= 0) return 0;
      return (m.income - m.expenses) / m.income;
    });
  }, [monthlyData]);

  const savingsRate3Mo = useMemo(() => {
    const last3 = monthlyData.slice(-3);
    const totalIncome = last3.reduce((s, m) => s + m.income, 0);
    const totalExpenses = last3.reduce((s, m) => s + m.expenses, 0);
    if (totalIncome <= 0) return null;
    return (totalIncome - totalExpenses) / totalIncome;
  }, [monthlyData]);

  // ---- Monthly net + vs last month ----
  const monthlyNet = monthlyIncome - monthlyExpenses;
  const priorMonthNet = useMemo(() => {
    // Second-to-last entry in monthlyData is last calendar month
    if (monthlyData.length < 2) return null;
    const prev = monthlyData[monthlyData.length - 2];
    return prev.income - prev.expenses;
  }, [monthlyData]);

  const vsLastMonthPct = useMemo(() => {
    if (priorMonthNet === null) return null;
    if (priorMonthNet === 0) return null;
    return ((monthlyNet - priorMonthNet) / Math.abs(priorMonthNet)) * 100;
  }, [monthlyNet, priorMonthNet]);

  // ---- Cash runway ----
  const avgMonthlyExpenses = useMemo(() => {
    const last3 = monthlyData.slice(-3).filter((m) => m.expenses > 0);
    if (last3.length === 0) return 0;
    return mean(last3.map((m) => m.expenses));
  }, [monthlyData]);

  const runwayInfo = useMemo<
    | { kind: "infinite" }
    | { kind: "months"; value: number }
    | { kind: "unknown" }
  >(() => {
    // If you're net-positive over the last 3 months on average, no runway needed.
    const last3 = monthlyData.slice(-3);
    const avgIncome = last3.length > 0 ? mean(last3.map((m) => m.income)) : 0;
    if (avgIncome >= avgMonthlyExpenses && avgMonthlyExpenses > 0) {
      return { kind: "infinite" };
    }
    if (avgMonthlyExpenses <= 0) return { kind: "unknown" };
    return { kind: "months", value: totalBalance / avgMonthlyExpenses };
  }, [totalBalance, avgMonthlyExpenses, monthlyData]);

  // ---- Net worth trajectory (linear regression over last 90 days) ----
  const trajectory = useMemo(() => {
    if (snapshots.length < 2) return null;
    // Convert each snapshot into (days since first, net_worth)
    const firstDate = new Date(snapshots[0].date + "T12:00:00");
    const points = snapshots.map((s) => {
      const d = new Date(s.date + "T12:00:00");
      const x = (d.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
      return { x, y: Number(s.net_worth) };
    });
    const slopePerDay = linearSlope(points);
    return {
      slopePerDay,
      annualized: slopePerDay * 365,
    };
  }, [snapshots]);

  // ---- Goal ETAs ----
  const activeGoals = useMemo(() => {
    return goals
      .filter((g) => !g.completed && Number(g.target_amount) > g.saved)
      .slice(0, 3)
      .map((g) => {
        const remaining = Number(g.target_amount) - g.saved;
        const eta = monthlyNet > 0 ? remaining / monthlyNet : Infinity;
        const progress = Math.min(100, (g.saved / Number(g.target_amount)) * 100);
        return {
          id: g.id,
          name: g.name,
          color: g.color,
          saved: g.saved,
          target: Number(g.target_amount),
          progress,
          etaMonths: eta,
        };
      });
  }, [goals, monthlyNet]);

  // ---- Category trends ----
  const categoryTrends = useMemo(() => {
    const trends = computeCategoryTrends(expenses);
    if (trends.length === 0) return { top: null, bottom: null };
    // Biggest increase and biggest decrease
    const byChange = [...trends].sort((a, b) => b.pctChange - a.pctChange);
    const top = byChange[0];
    const bottom = byChange[byChange.length - 1];
    // Only surface meaningful movers — ignore sub-5% changes and avoid duplicating
    const pick = (t: CategoryTrend | undefined): CategoryTrend | null =>
      t && Math.abs(t.pctChange) >= 0.05 ? t : null;
    return {
      top: pick(top),
      bottom: top === bottom ? null : pick(bottom),
    };
  }, [expenses]);

  // ---- Empty state: not enough data ----
  const monthsWithData = monthlyData.filter(
    (m) => m.income > 0 || m.expenses > 0
  ).length;

  if (monthsWithData < 2) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
          <Activity size={16} className="text-gray-400 dark:text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
            Financial Trajectory
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
          <div className="w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mb-3">
            <TrendingUp size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 max-w-sm">
            Keep logging your income and expenses for a few weeks — we&apos;ll show
            your trajectory here.
          </p>
        </div>
      </motion.div>
    );
  }

  // ---- Color helpers ----
  const savingsColor =
    savingsRate3Mo === null
      ? "text-gray-500 dark:text-gray-400"
      : savingsRate3Mo >= 0.2
        ? "text-green-600 dark:text-green-400"
        : savingsRate3Mo >= 0.05
          ? "text-amber-600 dark:text-amber-400"
          : "text-red-600 dark:text-red-400";
  const savingsStroke =
    savingsRate3Mo === null
      ? "#9ca3af"
      : savingsRate3Mo >= 0.2
        ? "#10b981"
        : savingsRate3Mo >= 0.05
          ? "#f59e0b"
          : "#ef4444";

  const netColor =
    monthlyNet >= 0
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";

  const runwayColor =
    runwayInfo.kind === "infinite"
      ? "text-green-600 dark:text-green-400"
      : runwayInfo.kind === "months"
        ? runwayInfo.value >= 6
          ? "text-green-600 dark:text-green-400"
          : runwayInfo.value >= 3
            ? "text-amber-600 dark:text-amber-400"
            : "text-red-600 dark:text-red-400"
        : "text-gray-500 dark:text-gray-400";

  const trajectoryPositive = (trajectory?.annualized ?? 0) >= 0;
  const trajectoryColor = trajectory
    ? trajectoryPositive
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400"
    : "text-gray-500 dark:text-gray-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-gray-400 dark:text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
            Financial Trajectory
          </h2>
        </div>
        <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          This month
        </span>
      </div>

      {/* 2x2 metric grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-gray-800">
        {/* Savings rate */}
        <div className="sm:border-b sm:border-gray-100 sm:dark:border-gray-800">
          <MetricCard label="Savings rate" icon={Target}>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className={`text-2xl font-bold tabular-nums ${savingsColor}`}>
                  {savingsRate3Mo === null
                    ? "—"
                    : `${Math.round(savingsRate3Mo * 100)}%`}
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                  3-mo average
                </p>
              </div>
              {savingsRateSeries.length >= 2 && (
                <Sparkline values={savingsRateSeries} color={savingsStroke} />
              )}
            </div>
          </MetricCard>
        </div>

        {/* Monthly net */}
        <div className="sm:border-b sm:border-gray-100 sm:dark:border-gray-800">
          <MetricCard label="Monthly net" icon={Wallet}>
            <div>
              <p className={`text-2xl font-bold tabular-nums ${netColor}`}>
                {formatSignedDollars(monthlyNet)}
              </p>
              <div className="flex items-center gap-1 mt-0.5 text-[11px]">
                {vsLastMonthPct !== null ? (
                  <>
                    {vsLastMonthPct >= 0 ? (
                      <TrendingUp
                        size={11}
                        className="text-green-600 dark:text-green-400"
                      />
                    ) : (
                      <TrendingDown
                        size={11}
                        className="text-red-600 dark:text-red-400"
                      />
                    )}
                    <span
                      className={
                        vsLastMonthPct >= 0
                          ? "text-green-600 dark:text-green-400 font-medium tabular-nums"
                          : "text-red-600 dark:text-red-400 font-medium tabular-nums"
                      }
                    >
                      {vsLastMonthPct >= 0 ? "+" : ""}
                      {Math.round(vsLastMonthPct)}%
                    </span>
                    <span className="text-gray-400 dark:text-gray-500">
                      vs last month
                    </span>
                  </>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500">
                    No prior month data
                  </span>
                )}
              </div>
            </div>
          </MetricCard>
        </div>

        {/* Cash runway */}
        <MetricCard label="Cash runway" icon={Calendar}>
          <div>
            <p className={`text-2xl font-bold tabular-nums ${runwayColor}`}>
              {runwayInfo.kind === "infinite"
                ? "\u221E"
                : runwayInfo.kind === "months"
                  ? `${runwayInfo.value.toFixed(1)} mo`
                  : "—"}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
              {runwayInfo.kind === "infinite"
                ? "You\u2019re net-positive"
                : runwayInfo.kind === "months"
                  ? `at ${formatDollars(avgMonthlyExpenses)}/mo burn`
                  : "Not enough spend data"}
            </p>
          </div>
        </MetricCard>

        {/* Net worth pace */}
        <MetricCard label="Net worth pace" icon={TrendingUp}>
          <div>
            <p className={`text-2xl font-bold tabular-nums ${trajectoryColor}`}>
              {trajectory === null
                ? "—"
                : `${trajectory.annualized >= 0 ? "+" : "-"}$${Math.abs(Math.round(trajectory.annualized)).toLocaleString("en-US")}`}
            </p>
            <div className="flex items-center gap-1 mt-0.5 text-[11px]">
              {trajectory !== null ? (
                <>
                  {trajectoryPositive ? (
                    <TrendingUp
                      size={11}
                      className="text-green-600 dark:text-green-400"
                    />
                  ) : (
                    <TrendingDown
                      size={11}
                      className="text-red-600 dark:text-red-400"
                    />
                  )}
                  <span className="text-gray-400 dark:text-gray-500">
                    /yr at current pace
                  </span>
                </>
              ) : (
                <span className="text-gray-400 dark:text-gray-500">
                  Build history for 2+ days
                </span>
              )}
            </div>
          </div>
        </MetricCard>
      </div>

      {/* Category trends pills */}
      {(categoryTrends.top || categoryTrends.bottom) && (
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Movers
          </span>
          {categoryTrends.top && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full tabular-nums ${
                categoryTrends.top.pctChange >= 0
                  ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                  : "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400"
              }`}
            >
              <span aria-hidden>{categoryTrends.top.icon}</span>
              {categoryTrends.top.category}{" "}
              {categoryTrends.top.pctChange >= 0 ? "+" : ""}
              {Math.round(categoryTrends.top.pctChange * 100)}%
            </span>
          )}
          {categoryTrends.bottom && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full tabular-nums ${
                categoryTrends.bottom.pctChange >= 0
                  ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                  : "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400"
              }`}
            >
              <span aria-hidden>{categoryTrends.bottom.icon}</span>
              {categoryTrends.bottom.category}{" "}
              {categoryTrends.bottom.pctChange >= 0 ? "+" : ""}
              {Math.round(categoryTrends.bottom.pctChange * 100)}%
            </span>
          )}
        </div>
      )}

      {/* Goals on track */}
      {activeGoals.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-800 p-5">
          <div className="flex items-center gap-1.5 mb-3">
            <Target size={12} className="text-gray-400 dark:text-gray-500" />
            <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Goals on track
            </span>
          </div>
          <div className="space-y-2.5">
            {activeGoals.map((g) => (
              <div key={g.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {g.name}
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 shrink-0 tabular-nums">
                      {etaLabel(g.etaMonths)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${g.progress}%`, background: g.color }}
                      />
                    </div>
                    <span
                      className="text-[11px] font-medium tabular-nums shrink-0"
                      style={{ color: g.color }}
                    >
                      {Math.round(g.progress)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
