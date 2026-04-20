"use client";

import Sidebar from "@/components/Sidebar";
import QuickActionsFAB from "@/components/QuickActionsFAB";
import { useAuth } from "@/context/AuthContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen overflow-x-hidden">
        {!user && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-700">
            Demo mode — connect Supabase and sign in to save your data
          </div>
        )}
        <div className="p-4 lg:p-6 max-w-7xl">{children}</div>
      </main>
      <QuickActionsFAB />
    </div>
  );
}
