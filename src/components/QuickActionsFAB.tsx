"use client";

import { useState } from "react";
import { Plus, Wallet, CreditCard, ArrowLeftRight, HandCoins, Target, Package, X, Coins } from "lucide-react";
import AddIncomeModal from "@/components/AddIncomeModal";
import AddExpenseModal from "@/components/AddExpenseModal";
import AddItemModal from "@/components/AddItemModal";
import AddHoldingModal from "@/components/AddHoldingModal";
import TransferModal from "@/components/TransferModal";
import { useSavedIncome } from "@/hooks/useIncome";
import { useMetalTransactions } from "@/hooks/useMetalTransactions";

type ActionKey = "income" | "expense" | "transfer" | "item" | "holding" | null;

const actions: { key: Exclude<ActionKey, null>; label: string; icon: typeof Plus; color: string; iconBg: string }[] = [
  { key: "income", label: "Add Income", icon: Wallet, color: "hover:bg-blue-50 hover:text-blue-700", iconBg: "bg-blue-100 text-blue-600" },
  { key: "expense", label: "Add Expense", icon: CreditCard, color: "hover:bg-red-50 hover:text-red-700", iconBg: "bg-red-100 text-red-600" },
  { key: "transfer", label: "Transfer Money", icon: ArrowLeftRight, color: "hover:bg-purple-50 hover:text-purple-700", iconBg: "bg-purple-100 text-purple-600" },
  { key: "item", label: "Add Inventory Item", icon: Package, color: "hover:bg-orange-50 hover:text-orange-700", iconBg: "bg-orange-100 text-orange-600" },
  { key: "holding", label: "Add Metal Holding", icon: Coins, color: "hover:bg-amber-50 hover:text-amber-700", iconBg: "bg-amber-100 text-amber-600" },
];

export default function QuickActionsFAB() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ActionKey>(null);
  const { savePinned } = useSavedIncome();
  const { createBuyTransaction } = useMetalTransactions();

  const close = () => setOpen(false);
  const openAction = (key: ActionKey) => { setActive(key); setOpen(false); };

  return (
    <>
      {/* Expanded menu */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]" onClick={close} />
          <div className="fixed bottom-20 right-4 sm:right-6 z-50 w-60 bg-white border border-gray-200 rounded-2xl shadow-2xl shadow-gray-900/20 overflow-hidden animate-in">
            <div className="p-2 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider pl-2">Quick Actions</span>
              <button onClick={close} className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"><X size={14} /></button>
            </div>
            <div className="p-1.5">
              {actions.map((a) => {
                const Icon = a.icon;
                return (
                  <button key={a.key} onClick={() => openAction(a.key)}
                    className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium text-gray-700 transition-colors ${a.color}`}>
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center ${a.iconBg}`}>
                      <Icon size={14} />
                    </div>
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all ${open ? "rotate-45" : "hover:scale-105"}`}
        aria-label="Quick actions"
      >
        <Plus size={24} />
      </button>

      {/* Action modals */}
      <AddIncomeModal isOpen={active === "income"} onClose={() => setActive(null)} onAdded={() => setActive(null)} onSavePin={savePinned} />
      <AddExpenseModal isOpen={active === "expense"} onClose={() => setActive(null)} onAdded={() => setActive(null)} />
      <TransferModal isOpen={active === "transfer"} onClose={() => setActive(null)} onTransferred={() => setActive(null)} />
      <AddItemModal isOpen={active === "item"} onClose={() => setActive(null)} onItemAdded={() => setActive(null)} />
      <AddHoldingModal isOpen={active === "holding"} onClose={() => setActive(null)} onAdded={(id) => { createBuyTransaction(id); setActive(null); }} />
    </>
  );
}
