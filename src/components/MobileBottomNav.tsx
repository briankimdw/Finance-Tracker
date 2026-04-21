"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, CreditCard, WalletCards, Wallet, MoreHorizontal,
  Package, History, Coins, CalendarDays, Target, HandCoins, PieChart, Plane, X,
  LogOut, LogIn, User, TrendingUp,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const primaryTabs = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/budget", label: "Budget", icon: PieChart },
  { href: "/cards", label: "Cards", icon: WalletCards },
  { href: "/expenses", label: "Spend", icon: CreditCard },
];

const moreItems = [
  { href: "/income", label: "Income", icon: Wallet, color: "text-green-600 bg-green-50" },
  { href: "/debts", label: "Debts", icon: HandCoins, color: "text-amber-600 bg-amber-50" },
  { href: "/goals", label: "Goals", icon: Target, color: "text-blue-600 bg-blue-50" },
  { href: "/trips", label: "Trips", icon: Plane, color: "text-sky-600 bg-sky-50" },
  { href: "/inventory", label: "Inventory", icon: Package, color: "text-orange-600 bg-orange-50" },
  { href: "/sales", label: "Sales", icon: History, color: "text-purple-600 bg-purple-50" },
  { href: "/metals", label: "Metals", icon: Coins, color: "text-yellow-600 bg-yellow-50" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, color: "text-cyan-600 bg-cyan-50" },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => pathname === href;
  const isInMore = moreItems.some((m) => m.href === pathname);

  return (
    <>
      {/* More sheet overlay */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[70vh] overflow-y-auto pb-safe"
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp size={20} className="text-blue-600" />
                  <span className="font-semibold text-gray-900 text-lg">More</span>
                </div>
                <button onClick={() => setMoreOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 px-5 pb-5">
                {moreItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all ${
                        active ? "bg-blue-50 ring-2 ring-blue-200" : "bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${item.color}`}>
                        <Icon size={20} />
                      </div>
                      <span className="text-xs font-medium text-gray-700">{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Account section */}
              <div className="border-t border-gray-100 px-5 py-4">
                {user ? (
                  <>
                    <div className="flex items-center gap-3 mb-3 px-2">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <User size={18} className="text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Signed in as</p>
                        <p className="text-sm text-gray-900 truncate">{user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { signOut(); setMoreOpen(false); }}
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-medium text-sm transition-colors"
                    >
                      <LogOut size={16} /> Sign Out
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMoreOpen(false)}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium text-sm transition-colors"
                  >
                    <LogIn size={16} /> Sign In
                  </Link>
                )}
              </div>
              {/* Bottom safe area spacer */}
              <div className="h-2" />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-gray-200 pb-safe">
        <div className="grid grid-cols-5 h-16">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="relative flex flex-col items-center justify-center gap-0.5 transition-colors"
              >
                {active && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-blue-600 rounded-full"
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  />
                )}
                <Icon size={20} className={active ? "text-blue-600" : "text-gray-400"} />
                <span className={`text-[10px] font-medium ${active ? "text-blue-600" : "text-gray-400"}`}>{tab.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className="relative flex flex-col items-center justify-center gap-0.5 transition-colors"
          >
            {isInMore && !moreOpen && (
              <motion.div
                layoutId="activeTab"
                className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-blue-600 rounded-full"
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
              />
            )}
            <MoreHorizontal size={20} className={isInMore ? "text-blue-600" : "text-gray-400"} />
            <span className={`text-[10px] font-medium ${isInMore ? "text-blue-600" : "text-gray-400"}`}>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
