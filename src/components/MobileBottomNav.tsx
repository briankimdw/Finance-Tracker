"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, CreditCard, WalletCards, Wallet, MoreHorizontal,
  Package, History, Coins, CalendarDays, Target, HandCoins, PieChart, Plane, Users, X,
  LogOut, LogIn, TrendingUp, UserCog, Cpu,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useFriends } from "@/hooks/useFriends";
import { usePendingInvites } from "@/hooks/usePendingInvites";
import { useProfile } from "@/hooks/useProfile";

const primaryTabs = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/budget", label: "Budget", icon: PieChart },
  { href: "/cards", label: "Cards", icon: WalletCards },
  { href: "/expenses", label: "Spend", icon: CreditCard },
];

const moreItems = [
  { href: "/income", label: "Income", icon: Wallet, color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40" },
  { href: "/debts", label: "Debts", icon: HandCoins, color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40" },
  { href: "/friends", label: "Friends", icon: Users, color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40" },
  { href: "/goals", label: "Goals", icon: Target, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40" },
  { href: "/trips", label: "Trips", icon: Plane, color: "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40" },
  { href: "/inventory", label: "Inventory", icon: Package, color: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40" },
  { href: "/sales", label: "Sales", icon: History, color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40" },
  { href: "/pc-deals", label: "PC Deals", icon: Cpu, color: "text-emerald-600 bg-emerald-50" },
  { href: "/metals", label: "Metals", icon: Coins, color: "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/40" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, color: "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40" },
  { href: "/profile", label: "Profile", icon: UserCog, color: "text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40" },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { incoming } = useFriends();
  const { trips: tripInvites, goals: goalInvites } = usePendingInvites();
  const { profile } = useProfile();
  const pendingCount = incoming.length + tripInvites.length + goalInvites.length;
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
              className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl max-h-[70vh] overflow-y-auto pb-safe"
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp size={20} className="text-blue-600 dark:text-blue-400" />
                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-lg">More</span>
                </div>
                <button onClick={() => setMoreOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 px-5 pb-5">
                {moreItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  const badge = item.href === "/friends" && pendingCount > 0 ? pendingCount : 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl transition-all ${
                        active ? "bg-blue-50 dark:bg-blue-950/40 ring-2 ring-blue-200 dark:ring-blue-800" : "bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:bg-gray-700"
                      }`}
                    >
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${item.color}`}>
                        <Icon size={20} />
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
                      {badge > 0 && (
                        <span className="absolute top-2 right-2 min-w-[18px] h-[18px] bg-blue-600 text-white text-[10px] font-bold rounded-full px-1 flex items-center justify-center">{badge}</span>
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Account section */}
              <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-4">
                {user ? (
                  <>
                    <Link href="/profile" onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-3 mb-3 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      {profile?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-800 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white font-semibold text-sm"
                          style={{ background: profile?.color || "#3b82f6" }}>
                          {(profile?.display_name || profile?.username || user.email || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{profile?.display_name || user.email?.split("@")[0]}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{profile?.username ? `@${profile.username}` : user.email}</p>
                      </div>
                      <UserCog size={14} className="text-gray-300 dark:text-gray-600 shrink-0" />
                    </Link>
                    <button
                      onClick={() => { signOut(); setMoreOpen(false); }}
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 dark:hover:bg-red-950/60 text-red-600 dark:text-red-400 font-medium text-sm transition-colors"
                    >
                      <LogOut size={16} /> Sign Out
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMoreOpen(false)}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 dark:hover:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-medium text-sm transition-colors"
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
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 pb-safe">
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
                    className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  />
                )}
                <Icon size={20} className={active ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"} />
                <span className={`text-[10px] font-medium ${active ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`}>{tab.label}</span>
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
                className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
              />
            )}
            <MoreHorizontal size={20} className={isInMore ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"} />
            <span className={`text-[10px] font-medium ${isInMore ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`}>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
