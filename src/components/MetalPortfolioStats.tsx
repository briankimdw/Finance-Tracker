"use client";

import { DollarSign, TrendingUp, Percent, Wallet } from "lucide-react";
import type { PortfolioStats } from "@/lib/types";

interface MetalPortfolioStatsProps {
  stats: PortfolioStats;
}

export default function MetalPortfolioStats({ stats }: MetalPortfolioStatsProps) {
  const cards = [
    {
      label: "Portfolio Value",
      display: `$${stats.totalValue.toFixed(2)}`,
      icon: DollarSign,
      iconBg: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40",
      valueColor: "text-gray-900 dark:text-gray-100",
    },
    {
      label: "Total Cost",
      display: `$${stats.totalCost.toFixed(2)}`,
      icon: Wallet,
      iconBg: "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800",
      valueColor: "text-gray-900 dark:text-gray-100",
    },
    {
      label: "Unrealized P/L",
      display: `${stats.totalPnl >= 0 ? "+" : ""}$${stats.totalPnl.toFixed(2)}`,
      icon: TrendingUp,
      iconBg: stats.totalPnl >= 0 ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40" : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40",
      valueColor: stats.totalPnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
    },
    {
      label: "P/L %",
      display: `${stats.pnlPercent >= 0 ? "+" : ""}${stats.pnlPercent.toFixed(2)}%`,
      icon: Percent,
      iconBg: stats.pnlPercent >= 0 ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40" : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40",
      valueColor: stats.pnlPercent >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">{card.label}</span>
              <div className={`p-2 rounded-lg ${card.iconBg}`}><Icon size={18} /></div>
            </div>
            <p className={`text-[22px] font-semibold tracking-tight ${card.valueColor}`}>{card.display}</p>
          </div>
        );
      })}
    </div>
  );
}
