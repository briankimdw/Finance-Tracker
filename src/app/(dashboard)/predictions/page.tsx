"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  Dices, Upload, Trash2, Search, Trophy, Skull, ChevronDown, ChevronRight,
  TrendingUp, Percent, Activity, DollarSign, Info, X,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { usePredictionActivities } from "@/hooks/usePredictions";
import { useInvestments } from "@/hooks/useInvestments";
import { parseRobinhoodCsv, groupIntoMarkets, computeOverallStats, type ParsedActivityRow } from "@/lib/predictions";
import { formatESTDate } from "@/lib/dates";

interface PendingImport {
  fileNames: string[];
  allRows: ParsedActivityRow[];
  eventRows: ParsedActivityRow[];
  invalidRows: number;
}

type StatusFilter = "all" | "settled" | "open";

function pnlColor(v: number): string {
  return v >= 0.005 ? "text-green-600 dark:text-green-400" : v <= -0.005 ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400";
}

function money(v: number, signed = false): string {
  const sign = signed && v > 0 ? "+" : "";
  return `${sign}${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(2)}`;
}

function CumulativeTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload || !payload[0]) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg p-3 text-sm">
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">
        {new Date((label || "") + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </p>
      <p className={`font-bold tabular-nums ${pnlColor(payload[0].value)}`}>{money(payload[0].value, true)}</p>
    </div>
  );
}

export default function PredictionsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { activities, loading, importRows, clearAll } = usePredictionActivities();
  const { totals: invTotals } = useInvestments();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState<PendingImport | null>(null);
  const [onlyEventRows, setOnlyEventRows] = useState(true);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const markets = useMemo(() => groupIntoMarkets(activities), [activities]);
  const stats = useMemo(() => computeOverallStats(markets), [markets]);

  const filteredMarkets = useMemo(() => {
    return markets.filter((m) => {
      if (statusFilter === "settled" && !m.settled) return false;
      if (statusFilter === "open" && m.settled) return false;
      if (search && !m.market.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [markets, search, statusFilter]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const merged: PendingImport = { fileNames: [], allRows: [], eventRows: [], invalidRows: 0 };
    let anyHeader = false;
    for (const file of Array.from(files)) {
      const text = await file.text();
      const result = parseRobinhoodCsv(text);
      if (!result.headerFound) continue;
      anyHeader = true;
      merged.fileNames.push(file.name);
      merged.allRows.push(...result.rows);
      merged.eventRows.push(...result.eventRows);
      merged.invalidRows += result.invalidRows;
    }
    if (!anyHeader) {
      toast.error("Couldn't find a Robinhood activity header in that file — export the activity CSV and try again");
      return;
    }
    setPending(merged);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async () => {
    if (!pending) return;
    const rows = onlyEventRows ? pending.eventRows : pending.allRows;
    if (rows.length === 0) {
      toast.error("Nothing to import with the current filter");
      return;
    }
    setImporting(true);
    try {
      const summary = await importRows(rows, pending.fileNames.join(", "));
      toast.success(
        summary.duplicates > 0
          ? `Imported ${summary.imported} rows (${summary.duplicates} duplicates skipped)`
          : `Imported ${summary.imported} rows`
      );
      setPending(null);
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
    setImporting(false);
  };

  const tiles = [
    {
      label: "Realized P&L", icon: TrendingUp, value: money(stats.totalPnl, true), valueColor: pnlColor(stats.totalPnl),
      sub: `${stats.settledCount} settled market${stats.settledCount === 1 ? "" : "s"}`,
    },
    {
      label: "Win Rate", icon: Percent, value: `${stats.winRate.toFixed(1)}%`, valueColor: "text-gray-900 dark:text-gray-100",
      sub: `${stats.winCount}W · ${stats.lossCount}L${stats.pushCount ? ` · ${stats.pushCount} push` : ""}`,
    },
    {
      label: "Profit Factor", icon: Activity,
      value: stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2), valueColor: "text-gray-900 dark:text-gray-100",
      sub: `avg win $${stats.avgWin.toFixed(2)} · avg loss $${stats.avgLoss.toFixed(2)}`,
    },
    {
      label: "Volume Traded", icon: DollarSign, value: money(stats.totalVolume), valueColor: "text-gray-900 dark:text-gray-100",
      sub: `${stats.totalFills} fills · ${stats.totalMarkets} markets`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Predictions</h1>
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-400 border border-fuchsia-200 dark:border-fuchsia-800">Robinhood Event Contracts</span>
          </div>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5">Upload your Robinhood CSV to analyze every market you&apos;ve traded</p>
        </div>
        <div className="flex gap-2 shrink-0 self-start sm:self-auto">
          {activities.length > 0 && (
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: "Clear all prediction data?",
                  message: `Removes all ${activities.length} imported rows. Re-upload your CSV anytime to restore them.`,
                  confirmLabel: "Clear all",
                  destructive: true,
                });
                if (ok) { await clearAll(); toast.success("Prediction data cleared"); }
              }}
              className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-red-600 dark:text-red-400 border border-gray-300 dark:border-gray-700 font-medium py-2 px-4 rounded-lg flex items-center gap-2"
            >
              <Trash2 size={16} /><span>Clear</span>
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 hover:shadow-lg hover:shadow-fuchsia-600/20"
          >
            <Upload size={16} /><span>Upload CSV</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </div>
      </div>

      {/* Pending import banner */}
      {pending && (
        <div className="bg-fuchsia-50/70 dark:bg-fuchsia-950/20 border border-fuchsia-200 dark:border-fuchsia-900 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Ready to import from {pending.fileNames.join(", ")}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {pending.eventRows.length} prediction rows detected · {pending.allRows.length - pending.eventRows.length} other rows
                {pending.invalidRows > 0 ? ` · ${pending.invalidRows} unreadable` : ""}
              </p>
              <label className="flex items-center gap-2 mt-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                <input type="checkbox" checked={onlyEventRows} onChange={(e) => setOnlyEventRows(e.target.checked)} className="rounded border-gray-300" />
                Only import prediction/event-contract rows (recommended)
              </label>
            </div>
            <button onClick={() => setPending(null)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-800"><X size={16} /></button>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleImport}
              disabled={importing}
              className="bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white text-sm font-medium py-2 px-4 rounded-lg"
            >
              {importing ? "Importing..." : `Import ${(onlyEventRows ? pending.eventRows : pending.allRows).length} rows`}
            </button>
            <button onClick={() => setPending(null)} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-medium py-2 px-4 rounded-lg text-gray-600 dark:text-gray-300">Cancel</button>
          </div>
        </div>
      )}

      {activities.length === 0 && !loading ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <EmptyState
            icon={Dices}
            title="No prediction trades imported yet"
            description="In the Robinhood app: Account → Reports and statements → generate an activity report for your event contracts, download the CSV, then upload it here. Stats, win rate and P&L charts appear instantly."
            action={{ label: "Upload your CSV", onClick: () => fileInputRef.current?.click() }}
          />
        </div>
      ) : activities.length > 0 && (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {tiles.map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t.label}</span>
                    <div className="p-1.5 rounded-md bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-600 dark:text-fuchsia-400"><Icon size={14} /></div>
                  </div>
                  <p className={`text-xl font-bold tabular-nums ${t.valueColor}`}>{t.value}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 tabular-nums">{t.sub}</p>
                </div>
              );
            })}
          </div>

          {/* Open positions strip */}
          {(stats.openCount > 0 || invTotals.eventContracts > 0) && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Open right now</span>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-bold tabular-nums">{stats.openCount}</span> open market{stats.openCount === 1 ? "" : "s"}
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                net cash in open positions: <span className={`font-bold tabular-nums ${pnlColor(stats.openNet)}`}>{money(stats.openNet, true)}</span>
              </span>
              {invTotals.eventContracts > 0 && (
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  live value on Robinhood: <span className="font-bold tabular-nums text-fuchsia-600 dark:text-fuchsia-400">${invTotals.eventContracts.toFixed(2)}</span>
                </span>
              )}
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm min-w-0">
              <h2 className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Cumulative Realized P&L</h2>
              {stats.cumulative.length < 2 ? (
                <div className="h-[220px] flex items-center justify-center text-sm text-gray-300 dark:text-gray-600">Need a few settled markets</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={stats.cumulative} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="predGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={stats.totalPnl >= 0 ? "#c026d3" : "#ef4444"} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={stats.totalPnl >= 0 ? "#c026d3" : "#ef4444"} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => new Date(v + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} minTickGap={40} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `$${v.toFixed(0)}`} width={55} />
                    <Tooltip content={<CumulativeTooltip />} />
                    <Area type="monotone" dataKey="pnl" stroke={stats.totalPnl >= 0 ? "#c026d3" : "#ef4444"} strokeWidth={2.5} fill="url(#predGradient)" animationDuration={800} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm min-w-0">
              <h2 className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Monthly P&L</h2>
              {stats.monthly.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-sm text-gray-300 dark:text-gray-600">No settled months yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.monthly} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toFixed(0)}`} width={55} />
                    <Tooltip formatter={(v) => [money(Number(v ?? 0), true), "P&L"]} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                    <Bar dataKey="pnl" radius={[5, 5, 0, 0]}>
                      {stats.monthly.map((m) => (
                        <Cell key={m.month} fill={m.pnl >= 0 ? "#22c55e" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Best / worst */}
          {(stats.best || stats.worst) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stats.best && (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 shrink-0"><Trophy size={18} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Best market</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={stats.best.market}>{stats.best.market}</p>
                  </div>
                  <span className="text-base font-bold tabular-nums text-green-600 dark:text-green-400 shrink-0">{money(stats.best.netPnl, true)}</span>
                </div>
              )}
              {stats.worst && (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 shrink-0"><Skull size={18} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Worst market</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={stats.worst.market}>{stats.worst.market}</p>
                  </div>
                  <span className="text-base font-bold tabular-nums text-red-600 dark:text-red-400 shrink-0">{money(stats.worst.netPnl, true)}</span>
                </div>
              )}
            </div>
          )}

          {/* Markets table */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center gap-3">
              <h2 className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider flex-1">Markets ({filteredMarkets.length})</h2>
              <div className="flex gap-2 items-center">
                <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                  {(["all", "settled", "open"] as StatusFilter[]).map((s) => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-all ${statusFilter === s ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400"}`}>
                      {s}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search markets..."
                    className="w-44 sm:w-56 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-400"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="text-left text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
                    <th className="px-4 py-2.5 font-medium">Market</th>
                    <th className="px-3 py-2.5 font-medium">Side</th>
                    <th className="px-3 py-2.5 font-medium text-right">Fills</th>
                    <th className="px-3 py-2.5 font-medium text-right">In</th>
                    <th className="px-3 py-2.5 font-medium text-right">Out</th>
                    <th className="px-3 py-2.5 font-medium text-right">P&L</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Last</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMarkets.slice(0, 300).map((m) => {
                    const expanded = expandedKey === m.key;
                    return (
                      <Fragment key={m.key}>
                        <tr
                          onClick={() => setExpandedKey(expanded ? null : m.key)}
                          className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {expanded ? <ChevronDown size={13} className="text-gray-400 shrink-0" /> : <ChevronRight size={13} className="text-gray-400 shrink-0" />}
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[260px]" title={m.market}>{m.market}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {m.side ? (
                              <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${m.side === "Yes" ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"}`}>{m.side}</span>
                            ) : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 text-right tabular-nums">{m.rows.length}</td>
                          <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300 text-right tabular-nums">${m.amountIn.toFixed(2)}</td>
                          <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300 text-right tabular-nums">${m.amountOut.toFixed(2)}</td>
                          <td className={`px-3 py-3 text-sm font-semibold text-right tabular-nums ${pnlColor(m.netPnl)}`}>{money(m.netPnl, true)}</td>
                          <td className="px-3 py-3">
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${m.settled ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"}`}>
                              {m.settled ? "Settled" : "Open"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 text-right tabular-nums">{formatESTDate(m.lastDate, { month: "short", day: "numeric" })}</td>
                        </tr>
                        {expanded && (
                          <tr className="bg-gray-50/60 dark:bg-gray-800/40">
                            <td colSpan={8} className="px-6 py-3">
                              <div className="space-y-1">
                                {m.rows.map((r) => (
                                  <div key={r.id} className="flex items-center gap-3 text-xs tabular-nums">
                                    <span className="text-gray-400 dark:text-gray-500 w-20 shrink-0">{formatESTDate(r.activity_date, { month: "short", day: "numeric" })}</span>
                                    <span className="font-medium text-gray-600 dark:text-gray-300 w-14 shrink-0">{r.trans_code}</span>
                                    <span className="text-gray-500 dark:text-gray-400 flex-1 truncate" title={r.description}>
                                      {r.quantity !== null ? `${Number(r.quantity)} @ ${r.price !== null ? `$${Number(r.price).toFixed(2)}` : "—"}` : r.description}
                                    </span>
                                    <span className={`font-semibold ${pnlColor(Number(r.amount))}`}>{money(Number(r.amount), true)}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              {filteredMarkets.length === 0 && (
                <div className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">No markets match your filters</div>
              )}
            </div>
          </div>

          <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-xl p-4 flex items-start gap-3">
            <Info size={16} className="text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
              <span className="font-semibold">Re-uploading is safe:</span> rows are de-duplicated automatically, so upload a fresh CSV
              whenever you want to pull in your latest trades. &quot;Open&quot; markets are positions the CSV hasn&apos;t shown settling yet —
              their P&L becomes final once a settlement row arrives.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
