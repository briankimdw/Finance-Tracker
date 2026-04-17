"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Package, History, CalendarDays, Wallet, CreditCard, Coins, WalletCards, Target, HandCoins,
  LogOut, LogIn, TrendingUp, Menu, X, User,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/sales", label: "Sales History", icon: History },
  { href: "/metals", label: "Metals", icon: Coins },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/income", label: "Income", icon: Wallet },
  { href: "/expenses", label: "Expenses", icon: CreditCard },
  { href: "/cards", label: "Cards", icon: WalletCards },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/debts", label: "Debts", icon: HandCoins },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/60 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={20} className="text-blue-600" />
          <span className="font-semibold text-gray-900">NetWorth</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-gray-500 hover:text-gray-900 p-1">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && <div className="lg:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />}

      <aside className={`fixed top-0 left-0 z-40 h-full w-64 bg-gray-50/80 border-r border-gray-200/60 flex flex-col transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="px-5 py-5 border-b border-gray-200/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <TrendingUp size={16} className="text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-lg">NetWorth</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                  isActive
                    ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/60"
                    : "text-gray-500 hover:text-gray-900 hover:bg-white/60"
                }`}>
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-200/60">
          {user ? (
            <>
              <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <User size={14} className="text-blue-600" />
                </div>
                <span className="text-xs text-gray-500 truncate">{user.email}</span>
              </div>
              <button onClick={signOut}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-400 hover:text-red-600 hover:bg-red-50 w-full transition-all">
                <LogOut size={18} /> Sign Out
              </button>
            </>
          ) : (
            <Link href="/login"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-blue-600 hover:bg-blue-50 w-full transition-all">
              <LogIn size={18} /> Sign In
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
