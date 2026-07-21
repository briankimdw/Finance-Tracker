"use client";

import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import {
  TrendingUp, TrendingDown, RefreshCw, Plus, Landmark, Wallet, Dices,
  LineChart as LineChartIcon, Sparkles, Info,
} from "lucide-react";
import AddInvestmentAccountModal from "@/components/AddInvestmentAccountModal";
import AddPositionModal from "@/components/AddPositionModal";
import AnimatedNumber from "@/components/animated/AnimatedNumber";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/context/AuthContext";
import { useInvestments, useInvestmentHistory, saveInvestmentSnapshot } from "@/hooks/useInvestments";
import type { InvestmentAccount, InvestmentPosition } from "@/lib/types";

type Range = "7d" | "30d" | "90d" | "1y" | "all";
const RANGES: { key: Range; label: string; days: number }[] = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "1M", days: 30 },
  { key: "90d", label: "3M", days: 90 },
  { key: "1y", label: "1Y", days: 365 },
  { key: "all", label: "All", days: 3650 },
];

const DONUT_COLORS = ["#14b8a6", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", "#22c55e", "#06b6d4", "#ef4444", "#84cc16", "#6366f1"];

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  individual: "Individual",
  roth_ira: "Roth IRA",
  traditional_ira: "Traditional IRA",
  other: "Other",
};

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload || !payload[0]) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg p-3 text-sm">
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">
        {new Date((label || "") + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </p>
      <p className="font-bold text-gray-900 dark:text-gray-100 tabular-nums">${payload[0].value.toFixed(2)}</p>
    </div>
  );
}

export default function InvestmentsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const {
    accounts, positions, totals, lastSyncedAt, loading,
    createAccount, updateAccount, deleteAccount, savePosition, deletePosition, refreshPrices,
  } = useInvestments();

  const [range, setRange] = useState<Range>("30d");
  const rangeInfo = RANGES.find((r) => r.key === range) || RANGES[1];
  const { snapshots } = useInvestmentHistory(rangeInfo.days);

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editAccount, setEditAccount] = useState<InvestmentAccount | null>(null);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [editPosition, setEditPosition] = useState<InvestmentPosition | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Daily snapshot (same debounced pattern the dashboard uses for net worth)
  useEffect(() => {
    if (loading || accounts.length === 0) return;
    const timer = setTimeout(() => {
      saveInvestmentSnapshot(user?.id ?? null, totals);
    }, 2000);
    return () => clearTimeout(timer);
  }, [user, loading, accounts.length, totals]);

  const chartData = useMemo(
    () => snapshots.map((s) => ({ date: s.date, value: Number(s.total_value) })),
    [snapshots]
  );
  const chartChange = useMemo(() => {
    if (chartData.length < 2) return { change: 0, pct: 0 };
    const first = chartData[0].value;
    const last = chartData[chartData.length - 1].value;
    return { change: last - first, pct: first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0 };
  }, [chartData]);
  const chartUp = chartChange.change >= 0;

  const unrealized = useMemo(() => positions.reduce((s, p) => s + p.pnl, 0), [positions]);
  const costBasis = useMemo(() => positions.reduce((s, p) => s + p.costBasis, 0), [positions]);

  const donutData = useMemo(
    () => positions.filter((p) => p.marketValue > 0).map((p) => ({ name: p.symbol, value: Math.round(p.marketValue * 100) / 100 })),
    [positions]
  );

  const priceAsOf = useMemo(() => {
    const times = positions.map((p) => p.price_updated_at).filter(Boolean) as string[];
    return times.length ? new Date(times.sort()[times.length - 1]) : null;
  }, [positions]);

  const handleRefreshPrices = async () => {
    setRefreshing(true);
    try {
      const updated = await refreshPrices();
      if (updated > 0) toast.success(`Updated ${updated} price${updated === 1 ? "" : "s"}`);
      else toast.info("No fresh prices available — showing last stored prices");
    } catch {
      toast.error("Price service unavailable — using stored prices");
    }
    setRefreshing(false);
  };

  const accountLabel = (a: InvestmentAccount) => a.nickname || ACCOUNT_TYPE_LABEL[a.account_type] || a.account_type;

  const tiles = [
    { label: "Total Value", value: totals.total, icon: LineChartIcon, color: "text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40", valueColor: "text-gray-900 dark:text-gray-100" },
    { label: "Stocks & ETFs", value: totals.equities, icon: TrendingUp, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40", valueColor: "text-blue-600 dark:text-blue-400", sub: costBasis > 0 ? `${unrealized >= 0 ? "+" : ""}$${unrealized.toFixed(2)} unrealized` : undefined, subColor: unrealized >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400" },
    { label: "Predictions & Options", value: totals.eventContracts + totals.options, icon: Dices, color: "text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-950/40", valueColor: "text-fuchsia-600 dark:text-fuchsia-400" },
    { label: "Brokerage Cash", value: totals.cash, icon: Wallet, color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40", valueColor: "text-green-600 dark:text-green-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Investments</h1>
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800">Robinhood</span>
          </div>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5">
            {lastSyncedAt
              ? `Last synced ${new Date(lastSyncedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${new Date(lastSyncedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
              : "Your brokerage accounts & positions"}
          </p>
        </div>
        <div className="flex gap-2 shrink-0 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleRefreshPrices}
            disabled={refreshing || positions.length === 0}
            className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 font-medium py-2 px-4 rounded-lg flex items-center gap-2"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            <span>Refresh Prices</span>
          </button>
          <button onClick={() => { setEditPosition(null); setShowPositionModal(true); }} disabled={accounts.length === 0}
            className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 font-medium py-2 px-4 rounded-lg flex items-center gap-2">
            <Plus size={16} /><span>Position</span>
          </button>
          <button onClick={() => { setEditAccount(null); setShowAccountModal(true); }}
            className="bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 hover:shadow-lg hover:shadow-teal-600/20">
            <Plus size={16} /><span>Account</span>
          </button>
        </div>
      </div>

      {accounts.length === 0 && !loading ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <EmptyState
            icon={Landmark}
            title="No investment accounts yet"
            description="Add your Robinhood accounts manually, or ask Claude to sync them for you — balances, positions and live prices come along automatically."
            action={{ label: "Add your first account", onClick: () => { setEditAccount(null); setShowAccountModal(true); } }}
          />
        </div>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {tiles.map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t.label}</span>
                    <div className={`p-1.5 rounded-md ${t.color}`}><Icon size={14} /></div>
                  </div>
                  <AnimatedNumber value={t.value} prefix="$" className={`text-xl font-bold tabular-nums ${t.valueColor}`} />
                  {t.sub && <p className={`text-xs font-medium mt-0.5 tabular-nums ${t.subColor}`}>{t.sub}</p>}
                </div>
              );
            })}
          </div>

          {/* Value over time */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Portfolio Value Over Time</span>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums mt-1">${totals.total.toFixed(2)}</p>
                {chartData.length >= 2 && (
                  <div className={`flex items-center gap-1.5 mt-1 text-sm font-medium ${chartUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {chartUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    <span className="tabular-nums">{chartUp ? "+" : ""}${chartChange.change.toFixed(2)} ({chartChange.pct.toFixed(2)}%)</span>
                    <span className="text-gray-400 dark:text-gray-500 font-normal">· {rangeInfo.label}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                {RANGES.map((r) => (
                  <button key={r.key} onClick={() => setRange(r.key)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${range === r.key ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            {chartData.length < 2 ? (
              <div className="h-[200px] flex items-center justify-center text-gray-300 dark:text-gray-600 text-sm flex-col gap-1">
                <p className="text-sm font-medium text-gray-400 dark:text-gray-500">Not enough history yet</p>
                <p className="text-xs text-gray-300 dark:text-gray-600">A snapshot is stored each day you open this page</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="invGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartUp ? "#14b8a6" : "#ef4444"} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={chartUp ? "#14b8a6" : "#ef4444"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => new Date(v + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} minTickGap={40} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`)} width={55} domain={["auto", "auto"]} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="value" stroke={chartUp ? "#14b8a6" : "#ef4444"} strokeWidth={2.5} fill="url(#invGradient)" animationDuration={800} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Accounts */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Landmark size={16} className="text-gray-400 dark:text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Accounts</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {accounts.map((a) => {
                const breakdown = [
                  { label: "Stocks", v: Number(a.equity_value) },
                  { label: "Options", v: Number(a.options_value) },
                  { label: "Predictions", v: Number(a.event_contracts_value) },
                  { label: "Crypto", v: Number(a.crypto_value) },
                  { label: "Cash", v: Number(a.cash) },
                ].filter((b) => b.v > 0.004);
                return (
                  <div
                    key={a.id}
                    onClick={() => { setEditAccount(a); setShowAccountModal(true); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditAccount(a); setShowAccountModal(true); } }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Edit ${accountLabel(a)}`}
                    className="rounded-xl p-4 border border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm transition-all cursor-pointer bg-gradient-to-br from-teal-50/40 dark:from-teal-950/20 to-transparent"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{accountLabel(a)}</p>
                      {a.mask && <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">••{a.mask}</span>}
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                      {ACCOUNT_TYPE_LABEL[a.account_type] || a.account_type}{a.trading_type ? ` · ${a.trading_type}` : ""}
                    </p>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">${Number(a.total_value).toFixed(2)}</p>
                    {breakdown.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {breakdown.map((b) => (
                          <div key={b.label} className="flex items-center justify-between text-[11px] tabular-nums">
                            <span className="text-gray-400 dark:text-gray-500">{b.label}</span>
                            <span className="text-gray-600 dark:text-gray-300 font-medium">${b.v.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Positions + allocation */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm min-w-0">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Positions</h2>
                {priceAsOf && (
                  <span className="text-[11px] text-gray-400 dark:text-gray-500">
                    Prices as of {priceAsOf.toLocaleDateString("en-US", { month: "short", day: "numeric" })} {priceAsOf.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </span>
                )}
              </div>
              {positions.length === 0 ? (
                <EmptyState icon={Sparkles} title="No positions yet" description="Add your stock & ETF positions to see values and P&L" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
                        <th className="px-4 py-2.5 font-medium">Symbol</th>
                        <th className="px-4 py-2.5 font-medium text-right">Shares</th>
                        <th className="px-4 py-2.5 font-medium text-right">Avg Cost</th>
                        <th className="px-4 py-2.5 font-medium text-right">Price</th>
                        <th className="px-4 py-2.5 font-medium text-right">Value</th>
                        <th className="px-4 py-2.5 font-medium text-right">Return</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((p) => (
                        <tr
                          key={p.id}
                          onClick={() => { setEditPosition(p); setShowPositionModal(true); }}
                          className="border-b border-gray-50 dark:border-gray-800/60 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3">
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{p.symbol}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 text-right tabular-nums">{Number(p.quantity).toFixed(Number.isInteger(Number(p.quantity)) ? 0 : 4)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 text-right tabular-nums">${Number(p.avg_cost).toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 text-right tabular-nums">{p.last_price !== null ? `$${Number(p.last_price).toFixed(2)}` : "—"}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 text-right tabular-nums">${p.marketValue.toFixed(2)}</td>
                          <td className={`px-4 py-3 text-sm font-semibold text-right tabular-nums ${p.pnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {p.pnl >= 0 ? "+" : ""}${p.pnl.toFixed(2)}
                            <span className="block text-[11px] font-medium opacity-70">{p.pnl >= 0 ? "+" : ""}{p.pnlPercent.toFixed(1)}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm min-w-0">
              <h2 className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Allocation</h2>
              {donutData.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-sm text-gray-300 dark:text-gray-600">No positions</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={190}>
                    <PieChart>
                      <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} strokeWidth={0}>
                        {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `$${Number(v ?? 0).toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 space-y-1 max-h-44 overflow-y-auto">
                    {donutData.map((d, i) => {
                      const pct = totals.equities > 0 ? (d.value / totals.equities) * 100 : 0;
                      return (
                        <div key={d.name} className="flex items-center gap-2 text-xs">
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                          <span className="font-medium text-gray-700 dark:text-gray-300 flex-1">{d.name}</span>
                          <span className="text-gray-400 dark:text-gray-500 tabular-nums">{pct.toFixed(1)}%</span>
                          <span className="text-gray-600 dark:text-gray-300 font-medium tabular-nums w-20 text-right">${d.value.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* How sync works */}
          <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-xl p-4 flex items-start gap-3">
            <Info size={16} className="text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
              <span className="font-semibold">Syncing:</span> this page reflects your Robinhood accounts via Claude&apos;s Robinhood connection —
              just ask Claude to <span className="font-medium">&quot;sync my Robinhood&quot;</span> and balances, positions and prices update here.
              Everything is also editable by hand (tap an account or position), and <span className="font-medium">Refresh Prices</span> pulls free
              live quotes anytime.
            </p>
          </div>
        </>
      )}

      <AddInvestmentAccountModal
        isOpen={showAccountModal}
        account={editAccount}
        onClose={() => { setShowAccountModal(false); setEditAccount(null); }}
        onSave={async (data) => {
          if (editAccount) await updateAccount(editAccount.id, data);
          else await createAccount(data);
        }}
        onDelete={async (id) => {
          const ok = await confirm({
            title: "Delete this account?",
            message: "Its positions are removed too. This can't be undone.",
            confirmLabel: "Delete",
            destructive: true,
          });
          if (ok) await deleteAccount(id);
        }}
      />

      <AddPositionModal
        isOpen={showPositionModal}
        position={editPosition}
        accounts={accounts}
        onClose={() => { setShowPositionModal(false); setEditPosition(null); }}
        onSave={savePosition}
        onDelete={async (id) => {
          const ok = await confirm({
            title: "Delete this position?",
            message: "The account's stock value is recalculated without it.",
            confirmLabel: "Delete",
            destructive: true,
          });
          if (ok) await deletePosition(id);
        }}
      />
    </div>
  );
}
