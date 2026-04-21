"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import type { MonthlyData, CategoryBreakdown } from "@/hooks/useChartData";

interface ChartsProps { monthlyData: MonthlyData[]; categoryData: CategoryBreakdown[]; }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-gray-500 dark:text-gray-400">{entry.name}:</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">${entry.value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { color: string } }> }) {
  if (!active || !payload || !payload[0]) return null;
  const d = payload[0];
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg p-3 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ background: d.payload.color }} />
        <span className="text-gray-500 dark:text-gray-400">{d.name}:</span>
        <span className="font-medium text-gray-900 dark:text-gray-100">${d.value.toFixed(2)}</span>
      </div>
    </div>
  );
}

export default function Charts({ monthlyData, categoryData }: ChartsProps) {
  const hasMonthly = monthlyData.some((d) => d.reselling || d.main || d.side);
  const hasCategory = categoryData.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm overflow-hidden min-w-0">
        <h3 className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Monthly Earnings</h3>
        {!hasMonthly ? (
          <div className="h-[250px] flex items-center justify-center text-gray-300 dark:text-gray-600 text-sm">No data for the last 6 months</div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="reselling" name="Reselling" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="main" name="Main Income" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="side" name="Side Income" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm overflow-hidden min-w-0">
        <h3 className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Income Sources</h3>
        {!hasCategory ? (
          <div className="h-[250px] flex items-center justify-center text-gray-300 dark:text-gray-600 text-sm">No income data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value">
                {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="white" strokeWidth={2} />)}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend formatter={(value) => <span className="text-xs text-gray-500 dark:text-gray-400">{value}</span>} iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
