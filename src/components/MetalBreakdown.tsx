"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { METALS, METAL_KEYS } from "@/lib/metals";
import type { PortfolioStats } from "@/lib/types";

interface MetalBreakdownProps {
  stats: PortfolioStats;
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { color: string; pct: number } }> }) {
  if (!active || !payload || !payload[0]) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ background: d.payload.color }} />
        <span className="text-gray-500">{d.name}:</span>
        <span className="font-medium text-gray-900">${d.value.toFixed(2)}</span>
        <span className="text-gray-400 text-xs">({d.payload.pct.toFixed(1)}%)</span>
      </div>
    </div>
  );
}

export default function MetalBreakdown({ stats }: MetalBreakdownProps) {
  const chartData = METAL_KEYS
    .filter((m) => stats.metalBreakdown[m].currentValue > 0)
    .map((m) => ({
      name: METALS[m].name,
      value: stats.metalBreakdown[m].currentValue,
      color: METALS[m].color,
      pct: stats.totalValue > 0 ? (stats.metalBreakdown[m].currentValue / stats.totalValue) * 100 : 0,
    }));

  const hasData = chartData.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Pie chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm overflow-hidden min-w-0">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Allocation</h3>
        {!hasData ? (
          <div className="h-[220px] flex items-center justify-center text-gray-300 text-sm">No holdings</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                {chartData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="white" strokeWidth={2} />)}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Per-metal cards */}
      <div className="lg:col-span-2 grid grid-cols-2 gap-4">
        {METAL_KEYS.map((m) => {
          const data = stats.metalBreakdown[m];
          const meta = METALS[m];
          return (
            <div key={m} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-7 h-7 rounded-full ${meta.iconBg} flex items-center justify-center`}>
                  <span className="text-[10px] font-bold">{meta.symbol}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{meta.name}</span>
              </div>
              {data.count === 0 ? (
                <p className="text-xs text-gray-400">No holdings</p>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-gray-500">Quantity</span>
                    <span className="text-sm font-medium text-gray-900 tabular-nums">{data.totalOz.toFixed(4)} oz</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-gray-500">Value</span>
                    <span className="text-sm font-medium text-gray-900 tabular-nums">${data.currentValue.toFixed(2)}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-gray-500">P/L</span>
                    <span className={`text-sm font-semibold tabular-nums ${data.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {data.pnl >= 0 ? "+" : ""}${data.pnl.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
