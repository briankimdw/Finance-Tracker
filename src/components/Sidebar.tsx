"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useFriends } from "@/hooks/useFriends";
import { usePendingInvites } from "@/hooks/usePendingInvites";
import {
  LayoutDashboard, Package, History, CalendarDays, Wallet, CreditCard, Coins, WalletCards, Target, HandCoins, PieChart, Plane, Users,
  LogOut, LogIn, TrendingUp, User,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  divider?: boolean;
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/budget", label: "Budget", icon: PieChart },
  { href: "/expenses", label: "Expenses", icon: CreditCard },
  { href: "/cards", label: "Cards", icon: WalletCards },
  { href: "/income", label: "Income", icon: Wallet },
  { href: "/debts", label: "Debts", icon: HandCoins },
  { href: "/inventory", label: "Inventory", icon: Package, divider: true },
  { href: "/sales", label: "Sales History", icon: History },
  { href: "/metals", label: "Metals", icon: Coins },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/trips", label: "Trips", icon: Plane },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/friends", label: "Friends", icon: Users, divider: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { incoming } = useFriends();
  const { trips: tripInvites, goals: goalInvites } = usePendingInvites();
  const pendingCount = incoming.length + tripInvites.length + goalInvites.length;

  return (
    <>
      {/* Minimal mobile header (brand only — nav is at bottom) */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200/60 px-4 py-3 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
            <TrendingUp size={14} className="text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">NetWorth</span>
        </div>
      </div>

      <aside className="hidden lg:flex fixed top-0 left-0 z-40 h-full w-64 bg-gray-50/80 border-r border-gray-200/60 flex-col">
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
            const badge = item.href === "/friends" && pendingCount > 0 ? pendingCount : 0;
            return (
              <div key={item.href}>
                {item.divider && <div className="my-2 border-t border-gray-200/60" />}
                <Link href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                    isActive
                      ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/60"
                      : "text-gray-500 hover:text-gray-900 hover:bg-white/60"
                  }`}>
                  <Icon size={18} />
                  <span className="flex-1">{item.label}</span>
                  {badge > 0 && (
                    <span className="min-w-[18px] h-[18px] bg-blue-600 text-white text-[10px] font-bold rounded-full px-1.5 flex items-center justify-center">{badge}</span>
                  )}
                </Link>
              </div>
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
