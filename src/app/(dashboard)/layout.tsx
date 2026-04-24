"use client";

import { useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import MobileBottomNav from "@/components/MobileBottomNav";
import QuickActionsFAB from "@/components/QuickActionsFAB";
import { CommandPalette, useCommandPalette } from "@/components/ui/CommandPalette";
import { CommandPaletteContext } from "@/context/CommandPaletteContext";
import { useAuth } from "@/context/AuthContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const palette = useCommandPalette();

  // Cmd/Ctrl-K toggles the palette globally.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        palette.toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [palette]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 dark:text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <CommandPaletteContext.Provider value={palette}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Sidebar />
        <main className="lg:ml-64 pt-16 lg:pt-0 pb-24 lg:pb-0 min-h-screen overflow-x-hidden">
          {!user && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-center text-sm text-amber-700 dark:text-amber-400">
              Demo mode — connect Supabase and sign in to save your data
            </div>
          )}
          <div className="p-4 lg:p-6 max-w-7xl">{children}</div>
        </main>
        <MobileBottomNav />
        <QuickActionsFAB />
        <CommandPalette isOpen={palette.isOpen} onClose={palette.close} />
      </div>
    </CommandPaletteContext.Provider>
  );
}
