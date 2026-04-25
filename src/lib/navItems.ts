// Single source of truth for the app's nav routes.
// Sidebar, MobileBottomNav, and the profile sidebar-customization UI all
// import from here so toggles in one place stay in sync everywhere else.

import {
  LayoutDashboard, Package, History, CalendarDays, Wallet, CreditCard, Coins,
  WalletCards, Target, HandCoins, PieChart, Plane, Users, UserCog, Cpu,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  // Visual divider rendered ABOVE this item in the desktop sidebar
  divider?: boolean;
  // Tailwind color class pair used by MobileBottomNav's More sheet pills
  color?: string;
  // Routes flagged as "essential" can't be hidden from the toggle UI —
  // currently just /profile so users can always reach this page.
  essential?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40" },
  { href: "/budget", label: "Budget", icon: PieChart, color: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40" },
  { href: "/expenses", label: "Expenses", icon: CreditCard, color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40" },
  { href: "/cards", label: "Cards", icon: WalletCards, color: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40" },
  { href: "/income", label: "Income", icon: Wallet, color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40" },
  { href: "/debts", label: "Debts", icon: HandCoins, color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40" },
  { href: "/inventory", label: "Inventory", icon: Package, divider: true, color: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40" },
  { href: "/sales", label: "Sales History", icon: History, color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40" },
  { href: "/pc-deals", label: "PC Deals", icon: Cpu, color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40" },
  { href: "/metals", label: "Metals", icon: Coins, color: "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/40" },
  { href: "/goals", label: "Goals", icon: Target, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40" },
  { href: "/trips", label: "Trips", icon: Plane, color: "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, color: "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40" },
  { href: "/friends", label: "Friends", icon: Users, divider: true, color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40" },
  { href: "/profile", label: "Profile", icon: UserCog, essential: true, color: "text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40" },
];

/**
 * Filter nav items by a user's nav_preferences map.
 * Missing key = visible (so new routes appear by default).
 * `essential: true` items always pass through.
 */
export function filterNavItems(
  items: NavItem[],
  prefs: Record<string, boolean> | null | undefined
): NavItem[] {
  if (!prefs) return items;
  return items.filter((it) => it.essential || prefs[it.href] !== false);
}

export function isNavRouteVisible(
  href: string,
  prefs: Record<string, boolean> | null | undefined
): boolean {
  if (!prefs) return true;
  return prefs[href] !== false;
}
