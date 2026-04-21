"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Plane, Pencil, Trash2, Sparkles, Calendar, MapPin, TrendingDown, TrendingUp, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import AddTripModal from "@/components/AddTripModal";
import { useTrips } from "@/hooks/useTrips";
import { getTripIcon } from "@/lib/tripIcons";
import type { Trip } from "@/lib/types";

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  return fmt(start || end!);
}

export default function TripsPage() {
  const { trips, loading, createTrip, updateTrip, deleteTrip } = useTrips();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTrip, setEditTrip] = useState<Trip | null>(null);

  const activeTrips = trips.filter((t) => t.status !== "completed" && t.status !== "cancelled");
  const completedTrips = trips.filter((t) => t.status === "completed" || t.status === "cancelled");

  const totalBudget = activeTrips.reduce((s, t) => s + Number(t.total_budget), 0);
  const totalSpent = activeTrips.reduce((s, t) => s + t.totalActual, 0);

  const handleSave = async (data: Parameters<typeof createTrip>[0]) => {
    if (editTrip) {
      await updateTrip(editTrip.id, { ...data, start_date: data.start_date ?? null, end_date: data.end_date ?? null });
      setEditTrip(null);
    } else {
      await createTrip(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trips</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {activeTrips.length} active · ${totalSpent.toFixed(2)} spent of ${totalBudget.toFixed(2)}
          </p>
        </div>
        <button onClick={() => { setEditTrip(null); setShowAddModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-blue-600/20">
          <Plus size={16} /> New Trip
        </button>
      </div>

      {/* Overall bar */}
      {activeTrips.length > 0 && totalBudget > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Plane size={16} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Total spending</h2>
            </div>
            <span className="text-sm font-bold text-gray-900">{totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : 0}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all rounded-full" style={{ width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%` }} />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span>${totalSpent.toFixed(2)} spent</span>
            <span>${Math.max(0, totalBudget - totalSpent).toFixed(2)} left</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 shadow-sm">Loading...</div>
      ) : trips.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
              <Sparkles size={22} className="text-blue-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700">No trips yet</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs text-center">Plan a trip with an overall budget, then add items (hotels, food, activities) and track spending as you go.</p>
            <button onClick={() => setShowAddModal(true)} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1">
              <Plus size={14} /> Plan your first trip
            </button>
          </div>
        </div>
      ) : (
        <>
          {activeTrips.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeTrips.map((t, i) => {
                const Icon = getTripIcon(t.icon);
                const progress = t.progress;
                const warn = t.overBudget;
                return (
                  <motion.div key={t.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                    className="group relative overflow-hidden bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md rounded-2xl transition-all">
                    {/* Cover image or color band */}
                    {t.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.image_url} alt="" className="w-full h-28 object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                    ) : (
                      <div className="h-28 relative" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}aa)` }}>
                        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_30%,white,transparent_50%)]" />
                      </div>
                    )}

                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 -mt-8 shadow-sm border-2 border-white" style={{ background: `${t.color}`, color: "white" }}>
                          <Icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <Link href={`/trips/${t.id}`} className="block">
                                <h3 className="text-base font-semibold text-gray-900 truncate hover:text-blue-600 transition-colors">{t.name}</h3>
                              </Link>
                              {t.destination && (
                                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 truncate">
                                  <MapPin size={10} /> {t.destination}
                                </p>
                              )}
                              {(t.start_date || t.end_date) && (
                                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                  <Calendar size={10} /> {formatDateRange(t.start_date, t.end_date)}
                                </p>
                              )}
                            </div>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              t.status === "active" ? "bg-green-100 text-green-700" :
                              t.status === "planning" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                            }`}>
                              {t.status.toUpperCase()}
                            </span>
                          </div>

                          {/* Budget */}
                          <div className="mt-3 flex items-baseline justify-between mb-1">
                            <div>
                              <span className="text-lg font-bold text-gray-900 tabular-nums">${t.totalActual.toFixed(2)}</span>
                              <span className="text-xs text-gray-400 ml-1">/ ${Number(t.total_budget).toFixed(2)}</span>
                            </div>
                            <span className="text-xs font-bold tabular-nums" style={{ color: t.color }}>{progress.toFixed(0)}%</span>
                          </div>

                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                            <div className="h-full transition-all rounded-full" style={{ width: `${Math.min(100, progress)}%`, background: warn ? "#ef4444" : t.color }} />
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            {warn ? (
                              <span className="text-red-600 flex items-center gap-1"><TrendingUp size={11} /> Over budget if fully spent</span>
                            ) : t.skippedSavings > 0 ? (
                              <span className="text-green-600 flex items-center gap-1"><TrendingDown size={11} /> +${t.skippedSavings.toFixed(2)} saved by skipping</span>
                            ) : (
                              <span className="text-gray-500">${Math.max(0, t.remaining).toFixed(2)} headroom</span>
                            )}
                            <Link href={`/trips/${t.id}`} className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5">
                              {t.items.length} {t.items.length === 1 ? "item" : "items"} <ArrowRight size={11} />
                            </Link>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons on hover */}
                      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.preventDefault(); setEditTrip(t); setShowAddModal(true); }}
                          className="text-white/80 hover:text-white bg-black/20 hover:bg-black/40 p-1.5 rounded backdrop-blur-sm" title="Edit"><Pencil size={12} /></button>
                        <button onClick={(e) => { e.preventDefault(); if (confirm(`Delete "${t.name}"? All itinerary items will be deleted too.`)) deleteTrip(t.id); }}
                          className="text-white/80 hover:text-white bg-black/20 hover:bg-black/40 p-1.5 rounded backdrop-blur-sm" title="Delete"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {completedTrips.length > 0 && (
            <div className="space-y-2 pt-2">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Past & cancelled trips</h2>
              {completedTrips.map((t) => {
                const Icon = getTripIcon(t.icon);
                return (
                  <Link href={`/trips/${t.id}`} key={t.id}
                    className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3 opacity-80 hover:opacity-100 hover:shadow-md transition-all">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${t.color}15`, color: t.color }}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {t.destination ? `${t.destination} · ` : ""}
                        ${t.totalActual.toFixed(2)} spent{t.status === "cancelled" ? " · cancelled" : ""}
                      </p>
                    </div>
                    <button onClick={(e) => { e.preventDefault(); if (confirm(`Delete "${t.name}"?`)) deleteTrip(t.id); }}
                      className="text-gray-300 hover:text-red-500 p-1.5 rounded" title="Delete"><Trash2 size={13} /></button>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      <AddTripModal
        isOpen={showAddModal}
        trip={editTrip}
        onClose={() => { setShowAddModal(false); setEditTrip(null); }}
        onSave={handleSave}
      />
    </div>
  );
}
