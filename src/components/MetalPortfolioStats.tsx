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
      iconBg: "text-amber-600 bg-amber-50",
      valueColor: "text-gray-900",
    },
    {
      label: "Total Cost",
      display: `$${stats.totalCost.toFixed(2)}`,
      icon: Wallet,
      iconBg: "text-gray-600 bg-gray-100",
      valueColor: "text-gray-900",
    },
    {
      label: "Unrealized P/L",
      display: `${stats.totalPnl >= 0 ? "+" : ""}$${stats.totalPnl.toFixed(2)}`,
      icon: TrendingUp,
      iconBg: stats.totalPnl >= 0 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50",
      valueColor: stats.totalPnl >= 0 ? "text-green-600" : "text-red-600",
    },
    {
      label: "P/L %",
      display: `${stats.pnlPercent >= 0 ? "+" : ""}${stats.pnlPercent.toFixed(2)}%`,
      icon: Percent,
      iconBg: stats.pnlPercent >= 0 ? "text-blue-600 bg-blue-50" : "text-red-600 bg-red-50",
      valueColor: stats.pnlPercent >= 0 ? "text-blue-600" : "text-red-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm transition-all hover:shadow-md hover:border-gray-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{card.label}</span>
              <div className={`p-2 rounded-lg ${card.iconBg}`}><Icon size={18} /></div>
            </div>
            <p className={`text-[22px] font-semibold tracking-tight ${card.valueColor}`}>{card.display}</p>
          </div>
        );
      })}
    </div>
  );
}
