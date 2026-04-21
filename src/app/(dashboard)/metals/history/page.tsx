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
            <Link href="/metals" className="text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Metal Transaction History</h1>
          </div>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5">All buy and sell transactions</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-400 dark:text-gray-500">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              <HistoryIcon size={20} className="text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-sm font-medium text-gray-400 dark:text-gray-500">No transactions yet</p>
            <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Buy or sell holdings to see them here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {transactions.map((tx) => {
              const isBuy = tx.type === "buy";
              const firstHolding = tx.items?.[0]?.holding;
              const meta = firstHolding ? METALS[firstHolding.metal] : null;
              const qty = firstHolding ? Number(firstHolding.quantity) : 0;

              const rowInner = (
                <>
                  <div className={`p-2 rounded-lg ${isBuy ? "bg-blue-50 dark:bg-blue-950/40" : "bg-green-50 dark:bg-green-950/40"}`}>
                    {isBuy
                      ? <ArrowDownRight size={16} className="text-blue-600 dark:text-blue-400" />
                      : <ArrowUpRight size={16} className="text-green-600 dark:text-green-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-semibold ${isBuy ? "text-blue-600 dark:text-blue-400" : "text-green-600 dark:text-green-400"} capitalize`}>
                        {tx.type}
                      </span>
                      {meta && (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${meta.iconBg}`}>
                          {meta.name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-medium truncate">
                      {firstHolding?.description || (firstHolding ? `${qty} oz ${meta?.name || firstHolding.metal}` : "Unknown holding")}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {new Date(tx.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      {tx.notes && ` · ${tx.notes}`}
                    </p>
                  </div>
                  <div className="text-right">
                    {Number(tx.cash_amount) > 0 && (
                      <span className={`text-sm font-bold tabular-nums ${isBuy ? "text-gray-700 dark:text-gray-300" : "text-green-600 dark:text-green-400"}`}>
                        {isBuy ? "-" : "+"}${Number(tx.cash_amount).toFixed(2)}
                      </span>
                    )}
                    {firstHolding && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 tabular-nums">
                        {qty.toFixed(4)} oz
                      </p>
                    )}
                  </div>
                </>
              );

              // Link buy transactions to portfolio, sell transactions to portfolio too
              // (there's no per-transaction detail view).
              return (
                <Link
                  key={tx.id}
                  href="/metals"
                  className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  aria-label={`View ${tx.type} transaction on metals portfolio`}
                >
                  {rowInner}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
