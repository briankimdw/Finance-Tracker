"use client";

import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";
import { useNetWorthHistory } from "@/hooks/useNetWorthHistory";

type Range = "7d" | "30d" | "90d" | "1y" | "all";

const RANGES: { key: Range; label: string; days: number }[] = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "1M", days: 30 },
  { key: "90d", label: "3M", days: 90 },
  { key: "1y", label: "1Y", days: 365 },
  { key: "all", label: "All", days: 3650 },
];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: { date: string } }>; label?: string }) {
  if (!active || !payload || !payload[0]) return null;
  const value = payload[0].value;
  const dateStr = new Date((label || payload[0].payload.date) + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg p-3 text-sm">
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{dateStr}</p>
      <p className="font-bold text-gray-900 dark:text-gray-100 tabular-nums">${value.toFixed(2)}</p>
    </div>
  );
}

interface NetWorthChartProps {
  currentNetWorth: number;
}

export default function NetWorthChart({ currentNetWorth }: NetWorthChartProps) {
  const [range, setRange] = useState<Range>("30d");
  const rangeInfo = RANGES.find((r) => r.key === range) || RANGES[1];
  const { snapshots, loading } = useNetWorthHistory(rangeInfo.days);

  const chartData = useMemo(() => {
    return snapshots.map((s) => ({
      date: s.date,
      netWorth: Number(s.net_worth),
    }));
  }, [snapshots]);

  const { change, pct } = useMemo(() => {
    if (chartData.length < 2) return { change: 0, pct: 0 };
    const first = chartData[0].netWorth;
    const last = chartData[chartData.length - 1].netWorth;
    const change = last - first;
    const pct = first !== 0 ? (change / Math.abs(first)) * 100 : 0;
    return { change, pct };
  }, [chartData]);

  const isPositive = change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Net Worth Over Time</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">${currentNetWorth.toFixed(2)}</p>
          {chartData.length >= 2 && (
            <div className={`flex items-center gap-1.5 mt-1 text-sm font-medium ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span className="tabular-nums">{isPositive ? "+" : ""}${change.toFixed(2)} ({pct.toFixed(2)}%)</span>
              <span className="text-gray-400 dark:text-gray-500 font-normal">· {rangeInfo.label}</span>
            </div>
          )}
        </div>
        <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${range === r.key ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[240px] flex items-center justify-center text-gray-300 dark:text-gray-600 text-sm">Loading...</div>
      ) : chartData.length < 2 ? (
        <div className="h-[240px] flex items-center justify-center text-gray-300 dark:text-gray-600 text-sm flex-col gap-1">
          <p className="text-sm font-medium text-gray-400 dark:text-gray-500">Not enough data yet</p>
          <p className="text-xs text-gray-300 dark:text-gray-600">Snapshots are recorded as you use the app</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                <stop offset="100%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => new Date(v + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`)}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="netWorth"
              stroke={isPositive ? "#10b981" : "#ef4444"}
              strokeWidth={2.5}
              fill="url(#nwGradient)"
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}
