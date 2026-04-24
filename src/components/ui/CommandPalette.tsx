"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  PieChart,
  CreditCard,
  WalletCards,
  Wallet,
  HandCoins,
  Package,
  History,
  Coins,
  Target,
  Plane,
  CalendarDays,
  Users,
  UserCog,
  Plus,
  Search,
  ArrowRight,
} from "lucide-react";
import { useTrips } from "@/hooks/useTrips";
import { useGoals } from "@/hooks/useGoals";
import { useFriends } from "@/hooks/useFriends";

type IconType = ComponentType<{ size?: number | string; className?: string }>;

export interface CommandItem {
  id: string;
  label: string;
  subtitle?: string;
  icon: IconType;
  onSelect: () => void;
  keywords?: string;
}

interface CommandGroup {
  key: string;
  label: string;
  items: CommandItem[];
}

// -------- Public hook --------
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  return { isOpen, open, close, toggle };
}

interface NavRoute {
  href: string;
  label: string;
  icon: IconType;
  subtitle?: string;
}

const NAV_ROUTES: NavRoute[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, subtitle: "Overview of your net worth" },
  { href: "/budget", label: "Budget", icon: PieChart, subtitle: "Monthly budget & spending" },
  { href: "/expenses", label: "Expenses", icon: CreditCard, subtitle: "All expense entries" },
  { href: "/income", label: "Income", icon: Wallet, subtitle: "All income entries" },
  { href: "/cards", label: "Cards", icon: WalletCards, subtitle: "Credit cards & cash accounts" },
  { href: "/debts", label: "Debts", icon: HandCoins, subtitle: "Track loans & debts" },
  { href: "/inventory", label: "Inventory", icon: Package, subtitle: "Items for resale" },
  { href: "/sales", label: "Sales", icon: History, subtitle: "Sales history" },
  { href: "/metals", label: "Metals", icon: Coins, subtitle: "Precious metal holdings" },
  { href: "/goals", label: "Goals", icon: Target, subtitle: "Savings goals" },
  { href: "/trips", label: "Trips", icon: Plane, subtitle: "Trip planning & budgets" },
  { href: "/friends", label: "Friends", icon: Users, subtitle: "Manage your friends" },
  { href: "/profile", label: "Profile", icon: UserCog, subtitle: "Your profile settings" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, subtitle: "Upcoming events" },
];

function fuzzyMatch(haystack: string, needle: string): boolean {
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

// -------- Component --------
interface CommandPaletteProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function CommandPalette({ isOpen: isOpenProp, onClose }: CommandPaletteProps = {}) {
  const router = useRouter();
  const { trips } = useTrips();
  const { goals } = useGoals();
  const { friends } = useFriends();

  // Support both controlled (from layout) and uncontrolled (self-managed) usage.
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isOpenProp ?? internalOpen;
  const close = useCallback(() => {
    if (onClose) onClose();
    else setInternalOpen(false);
  }, [onClose]);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state on open/close.
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      // Auto-focus; small delay so it works across browsers after mount animation starts.
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const handleNavigate = useCallback(
    (href: string) => {
      router.push(href);
      close();
    },
    [router, close]
  );

  const handleNewTrip = useCallback(() => {
    // Navigate to trips and broadcast an event so the page can open its modal.
    router.push("/trips?new=1");
    window.dispatchEvent(new CustomEvent("open-new-trip"));
    close();
  }, [router, close]);

  const handleNewGoal = useCallback(() => {
    router.push("/goals?new=1");
    window.dispatchEvent(new CustomEvent("open-new-goal"));
    close();
  }, [router, close]);

  const handleLogPurchase = useCallback(() => {
    // Only makes sense on a trip detail page — dispatch event for page to catch.
    window.dispatchEvent(new CustomEvent("open-log-purchase"));
    close();
  }, [close]);

  // Build groups (unfiltered).
  const groups: CommandGroup[] = useMemo(() => {
    const navigateItems: CommandItem[] = NAV_ROUTES.map((r) => ({
      id: `nav-${r.href}`,
      label: r.label,
      subtitle: r.subtitle,
      icon: r.icon,
      onSelect: () => handleNavigate(r.href),
      keywords: r.subtitle,
    }));

    // Detect trip-detail route at click time (not at build time) — safe without SSR guard.
    const onTripRoute = typeof window !== "undefined" && /^\/trips\/[^/]+/.test(window.location.pathname);

    const createItems: CommandItem[] = [
      {
        id: "create-trip",
        label: "New Trip",
        subtitle: "Start a new travel budget",
        icon: Plane,
        onSelect: handleNewTrip,
      },
      {
        id: "create-goal",
        label: "New Goal",
        subtitle: "Add a savings goal",
        icon: Target,
        onSelect: handleNewGoal,
      },
    ];
    if (onTripRoute) {
      createItems.push({
        id: "create-purchase",
        label: "Log Purchase",
        subtitle: "Quick-log a trip purchase",
        icon: Plus,
        onSelect: handleLogPurchase,
      });
    }

    const tripItems: CommandItem[] = trips.map((t) => ({
      id: `trip-${t.id}`,
      label: t.name,
      subtitle: t.destination || "Trip",
      icon: Plane,
      onSelect: () => handleNavigate(`/trips/${t.id}`),
      keywords: t.destination || undefined,
    }));

    const goalItems: CommandItem[] = goals.map((g) => ({
      id: `goal-${g.id}`,
      label: g.name,
      subtitle: `$${Math.round(g.saved).toLocaleString()} / $${Math.round(Number(g.target_amount)).toLocaleString()}`,
      icon: Target,
      onSelect: () => handleNavigate(`/goals`),
    }));

    const friendItems: CommandItem[] = friends.map((f) => {
      const name = f.profile?.display_name || f.profile?.username || "Friend";
      const sub = f.profile?.username ? `@${f.profile.username}` : undefined;
      return {
        id: `friend-${f.userId}`,
        label: name,
        subtitle: sub,
        icon: Users,
        onSelect: () => handleNavigate(`/friends`),
        keywords: f.profile?.username || undefined,
      };
    });

    const groupsOut: CommandGroup[] = [
      { key: "navigate", label: "Navigate", items: navigateItems },
      { key: "create", label: "Create", items: createItems },
    ];
    if (tripItems.length > 0) groupsOut.push({ key: "trips", label: "Trips", items: tripItems });
    if (goalItems.length > 0) groupsOut.push({ key: "goals", label: "Goals", items: goalItems });
    if (friendItems.length > 0) groupsOut.push({ key: "friends", label: "Friends", items: friendItems });
    return groupsOut;
  }, [trips, goals, friends, handleNavigate, handleNewTrip, handleNewGoal, handleLogPurchase]);

  // Filtered view.
  const filteredGroups: CommandGroup[] = useMemo(() => {
    if (!query.trim()) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => {
          const hay = `${it.label} ${it.subtitle ?? ""} ${it.keywords ?? ""}`;
          return fuzzyMatch(hay, query);
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  // Flat list for keyboard nav (maps visual index → item).
  const flatItems: CommandItem[] = useMemo(
    () => filteredGroups.flatMap((g) => g.items),
    [filteredGroups]
  );

  // Clamp active index when list changes.
  useEffect(() => {
    if (activeIndex >= flatItems.length) setActiveIndex(0);
  }, [flatItems.length, activeIndex]);

  // Keyboard: arrows, enter, escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (flatItems.length === 0 ? 0 : (i + 1) % flatItems.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) =>
          flatItems.length === 0 ? 0 : (i - 1 + flatItems.length) % flatItems.length
        );
      } else if (e.key === "Enter") {
        if (flatItems[activeIndex]) {
          e.preventDefault();
          flatItems[activeIndex].onSelect();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, flatItems, activeIndex, close]);

  // Scroll active item into view.
  useEffect(() => {
    if (!isOpen) return;
    const container = listRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(`[data-cmd-index="${activeIndex}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  let runningIndex = -1;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[60]"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={close}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Dialog — full-screen on mobile, centered card on desktop */}
          <div className="absolute inset-0 flex items-start lg:items-start justify-center p-0 lg:pt-24 lg:px-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.12 } }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="pointer-events-auto relative w-full h-full lg:h-auto lg:max-w-xl lg:max-h-[70vh] bg-white dark:bg-gray-900 lg:rounded-2xl shadow-2xl shadow-gray-900/10 dark:shadow-black/40 border border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden"
            >
              {/* Header: search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
                <Search size={18} className="text-gray-400 dark:text-gray-500 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  placeholder="Type a command or search…"
                  className="flex-1 bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-[15px]"
                  autoComplete="off"
                  spellCheck={false}
                />
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[10px] font-semibold text-gray-500 dark:text-gray-400 shrink-0">
                  ESC
                </kbd>
              </div>

              {/* Body: groups */}
              <div ref={listRef} className="flex-1 overflow-y-auto">
                {filteredGroups.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                    No results for &ldquo;{query}&rdquo;
                  </div>
                ) : (
                  filteredGroups.map((g) => (
                    <div key={g.key} className="py-1">
                      <div className="px-4 pt-2 pb-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        {g.label}
                      </div>
                      <div>
                        {g.items.map((it) => {
                          runningIndex += 1;
                          const idx = runningIndex;
                          const isActive = idx === activeIndex;
                          const Icon = it.icon;
                          return (
                            <button
                              key={it.id}
                              type="button"
                              data-cmd-index={idx}
                              onMouseEnter={() => setActiveIndex(idx)}
                              onClick={it.onSelect}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                isActive ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                              }`}
                            >
                              <div
                                className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                                  isActive
                                    ? "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                }`}
                              >
                                <Icon size={15} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div
                                  className={`text-sm font-medium truncate ${
                                    isActive ? "text-blue-900 dark:text-blue-200" : "text-gray-900 dark:text-gray-100"
                                  }`}
                                >
                                  {it.label}
                                </div>
                                {it.subtitle && (
                                  <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                                    {it.subtitle}
                                  </div>
                                )}
                              </div>
                              {isActive && (
                                <ArrowRight size={14} className="text-blue-500 dark:text-blue-400 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 text-[11px] text-gray-500 dark:text-gray-400 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                      &#9166;
                    </kbd>
                    Select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                      &uarr;&darr;
                    </kbd>
                    Navigate
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                    ESC
                  </kbd>
                  Close
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default CommandPalette;
