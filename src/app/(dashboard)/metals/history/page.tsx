"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ArrowDownRight, History as HistoryIcon } from "lucide-react";
import { useMetalTransactions } from "@/hooks/useMetalTransactions";
import { METALS } from "@/lib/metals";

export default function MetalHistoryPage() {
  const { transactions, loading } = useMetalTransactions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/metals" className="text-gray-400 hover:text-gray-900 transition-colors">
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Metal Transaction History</h1>
          </div>
          <p className="text-gray-400 text-sm mt-0.5">All buy and sell transactions</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <HistoryIcon size={20} className="text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-400">No transactions yet</p>
            <p className="text-xs text-gray-300 mt-1">Buy or sell holdings to see them here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {transactions.map((tx) => {
              const isBuy = tx.type === "buy";
              const firstHolding = tx.items?.[0]?.holding;
              const meta = firstHolding ? METALS[firstHolding.metal] : null;
              const qty = firstHolding ? Number(firstHolding.quantity) : 0;

              return (
                <div key={tx.id} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50/60 transition-colors">
                  <div className={`p-2 rounded-lg ${isBuy ? "bg-blue-50" : "bg-green-50"}`}>
                    {isBuy
                      ? <ArrowDownRight size={16} className="text-blue-600" />
                      : <ArrowUpRight size={16} className="text-green-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-semibold ${isBuy ? "text-blue-600" : "text-green-600"} capitalize`}>
                        {tx.type}
                      </span>
                      {meta && (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${meta.iconBg}`}>
                          {meta.name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 font-medium truncate">
                      {firstHolding?.description || (firstHolding ? `${qty} oz ${meta?.name || firstHolding.metal}` : "Unknown holding")}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(tx.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      {tx.notes && ` · ${tx.notes}`}
                    </p>
                  </div>
                  <div className="text-right">
                    {Number(tx.cash_amount) > 0 && (
                      <span className={`text-sm font-bold tabular-nums ${isBuy ? "text-gray-700" : "text-green-600"}`}>
                        {isBuy ? "-" : "+"}${Number(tx.cash_amount).toFixed(2)}
                      </span>
                    )}
                    {firstHolding && (
                      <p className="text-xs text-gray-400 mt-0.5 tabular-nums">
                        {qty.toFixed(4)} oz
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
