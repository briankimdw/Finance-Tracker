"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useFriends } from "@/hooks/useFriends";
import { usePendingInvites } from "@/hooks/usePendingInvites";
import { LogOut, LogIn, TrendingUp, Command } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useCommandPaletteContext } from "@/context/CommandPaletteContext";
import { NAV_ITEMS, filterNavItems } from "@/lib/navItems";

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { incoming } = useFriends();
  const { trips: tripInvites, goals: goalInvites } = usePendingInvites();
  const { profile } = useProfile();
  const palette = useCommandPaletteContext();
  const pendingCount = incoming.length + tripInvites.length + goalInvites.length;
  const avatarUrl = profile?.avatar_url || null;
  const avatarInitial = (profile?.display_name || profile?.username || user?.email || "?").charAt(0).toUpperCase();
  const avatarColor = profile?.color || "#3b82f6";
  const navItems = filterNavItems(NAV_ITEMS, profile?.nav_preferences ?? null);

  return (
    <>
      {/* Mobile header — brand centered, avatar button on the right → /profile */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200/60 dark:border-gray-800/60 px-4 py-2.5 flex items-center justify-between">
        <div className="w-10" />  {/* spacer to balance the avatar */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
            <TrendingUp size={14} className="text-white" />
          </div>
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">NetWorth</span>
        </div>
        {user ? (
          <Link href="/profile" className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 ring-2 ring-transparent hover:ring-blue-200 dark:hover:ring-blue-800 transition-all relative" title="Your profile">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-200 dark:border-gray-800" />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                style={{ background: avatarColor }}>{avatarInitial}</div>
            )}
            {!profile?.username && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full ring-2 ring-white dark:ring-gray-900" title="Set up your profile" />
            )}
          </Link>
        ) : (
          <Link href="/login" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2">Sign in</Link>
        )}
      </div>

      <aside className="hidden lg:flex fixed top-0 left-0 z-40 h-full w-64 bg-gray-50/80 dark:bg-gray-800/80 dark:bg-gray-900/80 border-r border-gray-200/60 dark:border-gray-800/60 flex-col">
        <div className="px-5 py-5 border-b border-gray-200/60 dark:border-gray-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <TrendingUp size={16} className="text-white" />
            </div>
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-lg">NetWorth</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            const badge = item.href === "/friends" && pendingCount > 0 ? pendingCount : 0;
            return (
              <div key={item.href}>
                {item.divider && <div className="my-2 border-t border-gray-200/60 dark:border-gray-800/60" />}
                <Link href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                    isActive
                      ? "bg-white dark:bg-gray-900 dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-gray-200/60 dark:ring-gray-700/60"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/60 dark:hover:bg-gray-800/60"
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

        <div className="p-3 border-t border-gray-200/60 dark:border-gray-800/60">
          {user ? (
            <>
              <Link href="/profile" className="group flex items-center gap-2.5 p-2 mb-1 rounded-lg bg-white dark:bg-gray-900 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm transition-all relative">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-200 dark:border-gray-800 dark:border-gray-700 shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white font-semibold text-xs"
                    style={{ background: avatarColor }}>{avatarInitial}</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{profile?.display_name || user.email?.split("@")[0]}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {profile?.username ? `@${profile.username} · Edit profile →` : "Tap to set up your profile →"}
                  </p>
                </div>
                {!profile?.username && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-400 rounded-full ring-2 ring-white dark:ring-gray-800" />
                )}
              </Link>
              {palette && (
                <button
                  type="button"
                  onClick={palette.open}
                  className="flex items-center gap-2 w-full px-2.5 py-1.5 mb-1 rounded-md text-[11px] font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-all"
                  title="Open command palette"
                >
                  <Command size={12} />
                  <span className="flex-1 text-left">Quick search</span>
                  <kbd className="flex items-center gap-0.5 px-1 py-0.5 rounded border border-gray-200 dark:border-gray-800 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[9px] font-semibold text-gray-500 dark:text-gray-400">
                    {"\u2318"}K
                  </kbd>
                </button>
              )}
              <button onClick={signOut}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 w-full transition-all">
                <LogOut size={18} /> Sign Out
              </button>
            </>
          ) : (
            <Link href="/login"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 w-full transition-all">
              <LogIn size={18} /> Sign In
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
