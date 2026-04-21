"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Plus, DollarSign, TrendingUp, Package, Percent,
  Briefcase, Zap, BarChart3, Wallet, ArrowUpRight, CreditCard, Scale, Coins,
  Calendar, PiggyBank, Banknote, Target, ArrowLeftRight, Plane, MapPin, ArrowRight,
  X, PieChart,
} from "lucide-react";
import AddItemModal from "@/components/AddItemModal";
import AddIncomeModal from "@/components/AddIncomeModal";
import MarkSoldModal from "@/components/MarkSoldModal";
import AddExpenseModal from "@/components/AddExpenseModal";
import TransferModal from "@/components/TransferModal";
import AddContributionModal from "@/components/AddContributionModal";
import QuickAdd from "@/components/QuickAdd";
import Charts from "@/components/Charts";
import NetWorthChart from "@/components/NetWorthChart";
import FinancialTrajectory from "@/components/FinancialTrajectory";
import AnimatedNumber from "@/components/animated/AnimatedNumber";
import { Stagger, StaggerItem } from "@/components/animated/FadeInUp";
import { saveNetWorthSnapshot } from "@/hooks/useNetWorthHistory";
import { useItems, useStats } from "@/hooks/useItems";
import { useIncome, useIncomeStats, useSavedIncome, useMonthlyIncomeStats } from "@/hooks/useIncome";
import { useExpenseStats, useMonthlyExpenseStats } from "@/hooks/useExpenses";
import { usePortfolioStats, useRealizedMetalProfit } from "@/hooks/useHoldings";
import { useCashAccounts } from "@/hooks/useCashAccounts";
import { useCreditCards } from "@/hooks/useCreditCards";
import { useDebts } from "@/hooks/useDebts";
import { useGoals } from "@/hooks/useGoals";
import { getGoalIcon } from "@/lib/goalIcons";
import { useTrips } from "@/hooks/useTrips";
import { getTripIcon } from "@/lib/tripIcons";
import { useChartData } from "@/hooks/useChartData";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import type { Item, Income, CashAccountType, CreditCardWithStats } from "@/lib/types";
import { Crown } from "lucide-react";

const ACCOUNT_ICONS: Record<CashAccountType, typeof Wallet> = {
  checking: Wallet,
  savings: PiggyBank,
  cash: Banknote,
  other: Coins,
};

function formatDueDate(isoDate: string | null, daysUntil: number | null): string {
  if (!isoDate) return "";
  const date = new Date(isoDate + "T12:00:00");
  const monthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (daysUntil === 0) return `Due today`;
  if (daysUntil === 1) return `Due tomorrow`;
  if (daysUntil !== null && daysUntil <= 7) return `Due in ${daysUntil}d (${monthDay})`;
  return `Due ${monthDay}`;
}

function getDueColor(daysUntil: number | null): string {
  if (daysUntil === null) return "text-gray-500 dark:text-gray-400";
  if (daysUntil <= 3) return "text-red-600 dark:text-red-400";
  if (daysUntil <= 7) return "text-amber-600 dark:text-amber-400";
  return "text-gray-500 dark:text-gray-400";
}

function MiniHeatMap({ data }: { data: Map<string, number> }) {
  const days: string[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); days.push(d.toISOString().split("T")[0]); }
  let maxVal = 0;
  data.forEach((v) => { if (Math.abs(v) > maxVal) maxVal = Math.abs(v); });

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm overflow-hidden min-w-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Last 30 Days</h3>
        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span>Less</span>
          <div className="flex gap-0.5">
            {["bg-gray-100 dark:bg-gray-800", "bg-emerald-100", "bg-emerald-200", "bg-emerald-300", "bg-emerald-400"].map((c, i) => (
              <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>
      <div className="flex gap-[3px] overflow-hidden">
        {days.map((date) => {
          const val = data.get(date) || 0;
          let bg = "bg-gray-100 dark:bg-gray-800";
          if (val > 0) { const i = Math.min(val / Math.max(maxVal, 1), 1); bg = i > 0.75 ? "bg-emerald-400" : i > 0.5 ? "bg-emerald-300" : i > 0.25 ? "bg-emerald-200" : "bg-emerald-100"; }
          else if (val < 0) bg = "bg-red-200";
          return <div key={date} className={`flex-1 aspect-square rounded-sm ${bg}`} title={`${date}: $${val.toFixed(2)}`} />;
        })}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
        <Icon size={20} className="text-gray-300 dark:text-gray-600" />
      </div>
      <p className="text-sm font-medium text-gray-400 dark:text-gray-500">{title}</p>
      <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">{subtitle}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { stats, refetch: refetchStats } = useStats();
  const { items: recentItems, refetch: refetchItems } = useItems();
  const { mainTotal, sideTotal, count: incomeCount, refetch: refetchIncome } = useIncomeStats();
  const { incomes: recentIncomes, refetch: refetchIncomeList } = useIncome();
  const { savedIncomes, savePinned, deleteSaved, quickAdd } = useSavedIncome();
  const { total: totalExpenses, refetch: refetchExpenses } = useExpenseStats();
  const { total: monthlyExpenses, refetch: refetchMonthlyExpenses } = useMonthlyExpenseStats();
  const { mainTotal: monthlyMain, sideTotal: monthlySide, refetch: refetchMonthlyIncome } = useMonthlyIncomeStats();
  const { stats: metalStats, refetch: refetchMetals } = usePortfolioStats();
  const { monthlyProfit: monthlyMetalProfit, refetch: refetchMetalProfit } = useRealizedMetalProfit();
  const { accounts: cashAccounts, totalBalance: totalCash, refetch: refetchCash } = useCashAccounts();
  const { cards: creditCards, refetch: refetchCards } = useCreditCards();
  const { totalIOwe, totalTheyOwe, refetch: refetchDebts } = useDebts();
  const { goals, addContribution, refetch: refetchGoals } = useGoals();
  const { trips, refetch: refetchTrips } = useTrips();
  const { monthlyData, categoryData, refetch: refetchCharts } = useChartData();

  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [soldItem, setSoldItem] = useState<Item | null>(null);
  const [heatMapData, setHeatMapData] = useState<Map<string, number>>(new Map());
  const [onboardingDismissed, setOnboardingDismissed] = useState(true);
  const supabase = createClient();

  // Read onboarding dismissed flag from localStorage on mount (client-only to avoid SSR mismatch)
  useEffect(() => {
    try {
      setOnboardingDismissed(
        typeof window !== "undefined" &&
          window.localStorage.getItem("networth_onboarding_dismissed") === "true"
      );
    } catch {
      setOnboardingDismissed(false);
    }
  }, []);

  const dismissOnboarding = () => {
    setOnboardingDismissed(true);
    try {
      window.localStorage.setItem("networth_onboarding_dismissed", "true");
    } catch { /* ignore */ }
  };

  const showOnboarding =
    !!user &&
    !onboardingDismissed &&
    trips.length === 0 &&
    goals.length === 0 &&
    cashAccounts.length === 0;

  const fetchHeatMap = useCallback(async () => {
    const today = new Date(); const thirtyAgo = new Date(today); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    const startDate = thirtyAgo.toISOString().split("T")[0];
    try {
      let itemsQ = supabase.from("items").select("sale_date, sale_price, purchase_price, fees, shipping_costs").eq("status", "sold").gte("sale_date", startDate);
      let incomeQ = supabase.from("income").select("date, amount").gte("date", startDate);
      if (user) { itemsQ = itemsQ.eq("user_id", user.id); incomeQ = incomeQ.eq("user_id", user.id); }
      else { itemsQ = itemsQ.is("user_id", null); incomeQ = incomeQ.is("user_id", null); }
      const [itemsRes, incomeRes] = await Promise.all([itemsQ, incomeQ]);
      const map = new Map<string, number>();
      for (const item of (itemsRes.data || []) as Item[]) { const d = item.sale_date!; map.set(d, (map.get(d) || 0) + Number(item.sale_price) - Number(item.purchase_price) - Number(item.fees || 0) - Number(item.shipping_costs || 0)); }
      for (const inc of (incomeRes.data || []) as Income[]) { map.set(inc.date, (map.get(inc.date) || 0) + Number(inc.amount)); }
      setHeatMapData(map);
    } catch { /* ignore */ }
  }, [user, supabase]);

  useEffect(() => { fetchHeatMap(); }, [fetchHeatMap]);

  const [payCard, setPayCard] = useState<CreditCardWithStats | null>(null);
  const [showTransfer, setShowTransfer] = useState<string | null>(null); // account id as default from
  const [contribGoalId, setContribGoalId] = useState<string | null>(null);

  const handleRefresh = () => { refetchStats(); refetchItems(); refetchIncome(); refetchIncomeList(); refetchExpenses(); refetchMonthlyExpenses(); refetchMonthlyIncome(); refetchMetals(); refetchMetalProfit(); refetchCash(); refetchCards(); refetchDebts(); refetchGoals(); refetchTrips(); fetchHeatMap(); refetchCharts(); };
  const handleQuickAdd = async (saved: Parameters<typeof quickAdd>[0]) => { await quickAdd(saved); handleRefresh(); };

  const monthlyIncome = monthlyMain + monthlySide;
  // Monthly net includes realized metal profit this month
  const monthlyNet = monthlyIncome + monthlyMetalProfit - monthlyExpenses;
  const monthName = new Date().toLocaleDateString("en-US", { month: "long" });

  const totalCardDebt = creditCards.reduce((sum, c) => sum + Math.max(0, c.balance), 0);
  const upcomingPayments = creditCards
    .filter((c) => c.balance > 0 && c.daysUntilDue !== null && c.daysUntilDue <= 30)
    .sort((a, b) => (a.daysUntilDue || 0) - (b.daysUntilDue || 0));

  // NET WORTH = Cash + Metals + Inventory + Money owed to me - Card debt - Debts I owe
  const netWorth = totalCash + metalStats.totalValue + stats.inventoryValue + totalTheyOwe - totalCardDebt - totalIOwe;

  // Save daily net worth snapshot (debounced — only when data is loaded and stabilized)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveNetWorthSnapshot(user?.id ?? null, {
        cash: totalCash,
        metals: metalStats.totalValue,
        inventory: stats.inventoryValue,
        owed_to_me: totalTheyOwe,
        card_debt: totalCardDebt,
        i_owe: totalIOwe,
        net_worth: netWorth,
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [user, totalCash, metalStats.totalValue, stats.inventoryValue, totalTheyOwe, totalCardDebt, totalIOwe, netWorth]);

  const topCards = [
    { label: `${monthName} Net`, value: monthlyNet, icon: Scale, iconBg: monthlyNet >= 0 ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40" : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40", valueColor: monthlyNet >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400" },
    { label: "Cash & Checking", value: totalCash, icon: Wallet, iconBg: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40", valueColor: "text-green-600 dark:text-green-400", href: "/cards" as string | undefined },
    { label: "Card Debt", value: totalCardDebt, icon: CreditCard, iconBg: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40", valueColor: "text-red-600 dark:text-red-400", negative: true, href: "/cards" as string | undefined },
    { label: "Metals Portfolio", value: metalStats.totalValue, icon: Coins, iconBg: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40", valueColor: "text-amber-600 dark:text-amber-400", href: "/metals" as string | undefined },
  ];

  const bottomCards = [
    { label: `${monthName} Income`, display: `$${monthlyIncome.toFixed(2)}`, icon: DollarSign, iconBg: "text-emerald-600 bg-emerald-50", valueColor: "text-emerald-600" },
    { label: `${monthName} Expenses`, display: `-$${monthlyExpenses.toFixed(2)}`, icon: CreditCard, iconBg: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40", valueColor: "text-red-600 dark:text-red-400" },
    { label: "Owed to Me", display: `$${totalTheyOwe.toFixed(2)}`, icon: ArrowUpRight, iconBg: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40", valueColor: "text-green-600 dark:text-green-400", href: "/debts" as string | undefined },
    { label: "I Owe", display: `-$${totalIOwe.toFixed(2)}`, icon: Scale, iconBg: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40", valueColor: "text-red-600 dark:text-red-400", href: "/debts" as string | undefined },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5">Your complete financial overview</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddIncome(true)} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 font-medium py-2 px-4 rounded-lg flex items-center gap-2">
            <Plus size={16} /><span className="hidden sm:inline">Add Income</span>
          </button>
          <button onClick={() => setShowAddItem(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 hover:shadow-lg hover:shadow-blue-600/20">
            <Plus size={16} /><span className="hidden sm:inline">Add Item</span>
          </button>
        </div>
      </div>

      {showOnboarding && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="relative overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm"
        >
          {/* Gradient accent stripe */}
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
          {/* Soft background wash */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-blue-50/70 via-indigo-50/40 to-transparent"
          />

          <button
            onClick={dismissOnboarding}
            aria-label="Dismiss welcome"
            className="absolute top-3 right-3 z-10 p-1.5 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={16} />
          </button>

          <div className="relative p-6 sm:p-7">
            <h2 className="text-2xl sm:text-[26px] font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Welcome to NetWorth{user?.email ? `, ${user.email.split("@")[0]}` : ""}!
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Pick where to start — you can always change things later.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
              {[
                {
                  href: "/budget",
                  icon: PieChart,
                  title: "Set a budget",
                  subline: "Budget your monthly spending",
                  tint: { bg: "bg-blue-50 dark:bg-blue-950/40", ring: "ring-blue-100", text: "text-blue-600 dark:text-blue-400" },
                },
                {
                  href: "/trips",
                  icon: Plane,
                  title: "Plan a trip",
                  subline: "Track trips with budgets & splits",
                  tint: { bg: "bg-indigo-50 dark:bg-indigo-950/40", ring: "ring-indigo-100", text: "text-indigo-600 dark:text-indigo-400" },
                },
                {
                  href: "/goals",
                  icon: Target,
                  title: "Set a goal",
                  subline: "Save for something big",
                  tint: { bg: "bg-purple-50 dark:bg-purple-950/40", ring: "ring-purple-100", text: "text-purple-600 dark:text-purple-400" },
                },
              ].map((opt) => {
                const Icon = opt.icon;
                return (
                  <Link
                    key={opt.href}
                    href={opt.href}
                    className="group relative flex flex-col gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    <div className={`w-10 h-10 rounded-lg ${opt.tint.bg} ${opt.tint.text} ring-1 ${opt.tint.ring} flex items-center justify-center`}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{opt.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.subline}</p>
                    </div>
                    <ArrowRight
                      size={14}
                      className="absolute top-4 right-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all"
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      <QuickAdd savedIncomes={savedIncomes} onQuickAdd={handleQuickAdd} onDelete={deleteSaved} />

      {/* Net Worth chart */}
      <NetWorthChart currentNetWorth={netWorth} />

      {/* Smart insights: savings rate, runway, goal ETAs */}
      <FinancialTrajectory />

      {/* Net worth breakdown */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"><Crown size={16} /></div>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Breakdown</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Cash & Banks</p>
            <AnimatedNumber value={totalCash} prefix="$" className="text-sm font-semibold text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Metals</p>
            <AnimatedNumber value={metalStats.totalValue} prefix="$" className="text-sm font-semibold text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Inventory</p>
            <AnimatedNumber value={stats.inventoryValue} prefix="$" className="text-sm font-semibold text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Owed to Me</p>
            <AnimatedNumber value={totalTheyOwe} prefix="$" className="text-sm font-semibold text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Total Debt</p>
            <AnimatedNumber value={totalCardDebt + totalIOwe} prefix={(totalCardDebt + totalIOwe) > 0.005 ? "-$" : "$"} className="text-sm font-semibold text-red-600 dark:text-red-400" />
          </div>
        </div>
      </div>

      <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {topCards.map((card) => {
          const Icon = card.icon;
          const v = card.value;
          const neg = (card as typeof card & { negative?: boolean }).negative;
          const href = (card as typeof card & { href?: string }).href;
          // Don't show negative sign for zero (avoids "-$0.00")
          const displayValue = neg && Math.abs(v) > 0.005 ? -Math.abs(v) : Math.abs(v) < 0.005 ? 0 : v;
          const content = (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">{card.label}</span>
                <div className={`p-2 rounded-lg ${card.iconBg}`}><Icon size={18} /></div>
              </div>
              <AnimatedNumber value={displayValue} prefix="$" className={`text-[28px] font-semibold tracking-tight ${card.valueColor}`} />
            </>
          );
          const baseClass = "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 hover:-translate-y-0.5";
          return (
            <StaggerItem key={card.label}>
              {href ? (
                <Link href={href} className={`${baseClass} block h-full`}>{content}</Link>
              ) : (
                <div className={`${baseClass} h-full`}>{content}</div>
              )}
            </StaggerItem>
          );
        })}
      </Stagger>

      {/* All accounts */}
      {cashAccounts.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-gray-400 dark:text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Your Accounts</h2>
            </div>
            <Link href="/cards" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">Manage →</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {cashAccounts.map((acc) => {
              const Icon = ACCOUNT_ICONS[acc.type];
              return (
                <div key={acc.id} className="group relative rounded-xl p-3.5 border border-gray-100 dark:border-gray-800 hover:border-gray-200 transition-all" style={{ background: `${acc.color}08` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${acc.color}20`, color: acc.color }}>
                      <Icon size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate block">{acc.name}</span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">{acc.type}</span>
                    </div>
                    {cashAccounts.length >= 2 && (
                      <button
                        onClick={() => setShowTransfer(acc.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-white/60 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
                        title="Transfer"
                      >
                        <ArrowLeftRight size={13} />
                      </button>
                    )}
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">${Number(acc.balance).toFixed(2)}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Total Cash</span>
            <span className="text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">${totalCash.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Upcoming card payments */}
      {upcomingPayments.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-400 dark:text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Upcoming Card Payments</h2>
            </div>
            <Link href="/cards" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">View all →</Link>
          </div>
          <div className="space-y-2">
            {upcomingPayments.slice(0, 4).map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100/80 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 rounded-sm" style={{ background: c.color }} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.name}{c.last_four ? ` ••${c.last_four}` : ""}</p>
                    <p className={`text-xs font-medium ${getDueColor(c.daysUntilDue)}`}>{formatDueDate(c.nextDueDate, c.daysUntilDue)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold text-red-600 dark:text-red-400 tabular-nums">${c.balance.toFixed(2)}</span>
                  <button onClick={() => setPayCard(c)} className="text-xs bg-green-600 hover:bg-green-700 text-white font-medium px-3 py-1.5 rounded-md transition-colors">Pay</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goals progress */}
      {goals.filter((g) => !g.completed).length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-gray-400 dark:text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Goals Progress</h2>
            </div>
            <Link href="/goals" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">View all →</Link>
          </div>
          <div className="space-y-3">
            {goals.filter((g) => !g.completed).slice(0, 4).map((g) => {
              const Icon = getGoalIcon(g.icon);
              return (
                <div key={g.id} className="group flex items-center gap-3">
                  <Link href="/goals" className="shrink-0 transition-transform hover:scale-105">
                    {g.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.image_url} alt="" className="w-9 h-9 rounded-xl object-cover border border-gray-100 dark:border-gray-800" onError={(e) => { const i = e.target as HTMLImageElement; i.style.display = "none"; i.nextElementSibling?.classList.remove("hidden"); }} />
                    ) : null}
                    <div className={`${g.image_url ? "hidden" : ""} w-9 h-9 rounded-xl flex items-center justify-center`} style={{ background: `${g.color}15`, color: g.color }}>
                      <Icon size={16} />
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-1">
                      <Link href="/goals" className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{g.name}</Link>
                      <span className="text-xs font-medium tabular-nums shrink-0 ml-2" style={{ color: g.color }}>{g.progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full transition-all rounded-full" style={{ width: `${Math.min(100, g.progress)}%`, background: g.color }} />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 tabular-nums">${g.saved.toFixed(2)} of ${Number(g.target_amount).toFixed(2)}</p>
                  </div>
                  <button onClick={() => setContribGoalId(g.id)}
                    className="shrink-0 text-xs font-medium text-white px-2.5 py-1.5 rounded-md transition-all hover:shadow-md opacity-0 group-hover:opacity-100"
                    style={{ background: g.color }}
                    title="Add money">
                    <Plus size={12} className="inline -ml-0.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming trips */}
      {trips.filter((t) => t.status !== "completed" && t.status !== "cancelled").length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Plane size={16} className="text-gray-400 dark:text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Upcoming Trips</h2>
            </div>
            <Link href="/trips" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">View all →</Link>
          </div>
          <div className="space-y-3">
            {trips.filter((t) => t.status !== "completed" && t.status !== "cancelled").slice(0, 3).map((t) => {
              const Icon = getTripIcon(t.icon);
              const progress = t.progress;
              return (
                <Link href={`/trips/${t.id}`} key={t.id} className="group flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105" style={{ background: `${t.color}15`, color: t.color }}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-1">
                      <div className="min-w-0 flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 transition-colors">{t.name}</p>
                        {t.destination && <span className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5 shrink-0"><MapPin size={9} /> {t.destination}</span>}
                      </div>
                      <span className="text-xs font-medium tabular-nums shrink-0 ml-2" style={{ color: t.color }}>{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full transition-all rounded-full" style={{ width: `${Math.min(100, progress)}%`, background: t.overBudget ? "#ef4444" : t.color }} />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 tabular-nums">
                      ${t.totalActual.toFixed(2)} spent of ${Number(t.total_budget).toFixed(2)}
                      {t.plannedUpcoming > 0 && <span> · ${t.plannedUpcoming.toFixed(2)} planned</span>}
                    </p>
                  </div>
                  <ArrowRight size={14} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500 shrink-0 transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {bottomCards.map((card) => {
          const Icon = card.icon;
          const href = (card as typeof card & { href?: string }).href;
          const inner = (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">{card.label}</span>
                <div className={`p-1.5 rounded-md ${card.iconBg}`}><Icon size={14} /></div>
              </div>
              <p className={`text-xl font-bold ${card.valueColor}`}>{card.display}</p>
            </>
          );
          const cls = "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm transition-all hover:border-gray-300 dark:hover:border-gray-700";
          return href ? (
            <Link key={card.label} href={href} className={`${cls} block`}>{inner}</Link>
          ) : (
            <div key={card.label} className={cls}>{inner}</div>
          );
        })}
      </div>

      <MiniHeatMap data={heatMapData} />
      <Charts monthlyData={monthlyData} categoryData={categoryData} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm min-w-0">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Recent Reselling</h2>
          </div>
          <div className="p-3 space-y-1.5">
            {recentItems.length === 0 ? (
              <EmptyState icon={Package} title="No items yet" subtitle="Items you add will appear here" />
            ) : (
              recentItems.slice(0, 5).map((item) => {
                const profit = item.status === "sold" ? Number(item.sale_price) - Number(item.purchase_price) - Number(item.fees || 0) - Number(item.shipping_costs || 0) : null;
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className={`p-2 rounded-lg ${item.status === "sold" ? "bg-green-50 dark:bg-green-950/40" : "bg-blue-50 dark:bg-blue-950/40"}`}>
                      {item.status === "sold" ? <ArrowUpRight size={16} className="text-green-600 dark:text-green-400" /> : <Package size={16} className="text-blue-600 dark:text-blue-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-gray-100 font-medium truncate">{item.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{item.status === "active" ? "In Stock" : "Sold"} &middot; {item.category}</p>
                    </div>
                    <div className="text-right">
                      {profit !== null ? (
                        <span className={`text-sm font-semibold ${profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{profit >= 0 ? "+" : ""}${profit.toFixed(2)}</span>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">${Number(item.purchase_price).toFixed(2)}</span>
                      )}
                    </div>
                    {item.status === "active" && (
                      <button onClick={() => setSoldItem(item)} className="text-xs font-medium bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 hover:bg-green-100 border border-green-200 dark:border-green-800 px-2.5 py-1 rounded-md shrink-0">Sell</button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm min-w-0">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Recent Income</h2>
          </div>
          <div className="p-3 space-y-1.5">
            {recentIncomes.length === 0 ? (
              <EmptyState icon={Wallet} title="No income entries yet" subtitle="Income you log will appear here" />
            ) : (
              recentIncomes.slice(0, 5).map((inc) => (
                <div key={inc.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className={`p-2 rounded-lg ${inc.type === "main" ? "bg-blue-50 dark:bg-blue-950/40" : "bg-purple-50 dark:bg-purple-950/40"}`}>
                    {inc.type === "main" ? <Briefcase size={16} className="text-blue-600 dark:text-blue-400" /> : <Zap size={16} className="text-purple-600 dark:text-purple-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-medium truncate">{inc.source}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{inc.type === "main" ? "Main" : "Side"} &middot; {inc.category}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">+${Number(inc.amount).toFixed(2)}</span>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(inc.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <AddItemModal isOpen={showAddItem} onClose={() => setShowAddItem(false)} onItemAdded={handleRefresh} />
      <AddIncomeModal isOpen={showAddIncome} onClose={() => setShowAddIncome(false)} onAdded={handleRefresh} onSavePin={savePinned} />
      <MarkSoldModal isOpen={!!soldItem} item={soldItem} onClose={() => setSoldItem(null)} onSold={handleRefresh} />
      <AddExpenseModal isOpen={!!payCard} onClose={() => setPayCard(null)} onAdded={handleRefresh} defaultCardId={payCard?.id} defaultIsCardPayment={true} />
      <TransferModal isOpen={!!showTransfer} onClose={() => setShowTransfer(null)} onTransferred={handleRefresh} defaultFromId={showTransfer || undefined} />
      <AddContributionModal
        isOpen={!!contribGoalId}
        goal={goals.find((g) => g.id === contribGoalId) || null}
        onClose={() => setContribGoalId(null)}
        onSave={addContribution}
      />
    </div>
  );
}
