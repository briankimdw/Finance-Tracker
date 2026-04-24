"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Plane, Pencil, Trash2, Sparkles, Calendar, MapPin, TrendingDown, TrendingUp, Users, UserPlus, LogOut, Target } from "lucide-react";
import { motion } from "framer-motion";
import AddTripModal from "@/components/AddTripModal";
import InviteTripMembersModal from "@/components/InviteTripMembersModal";
import { useTrips } from "@/hooks/useTrips";
import { useGoals } from "@/hooks/useGoals";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getTripIcon } from "@/lib/tripIcons";
import type { Trip, TripWithStats } from "@/lib/types";

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  return fmt(start || end!);
}

export default function TripsPage() {
  const { trips, loading, createTrip, updateTrip, deleteTrip, inviteToTrip, removeTripMember, leaveTrip } = useTrips();
  const { goals } = useGoals();
  const { success, error: toastError, info } = useToast();
  const confirm = useConfirm();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTrip, setEditTrip] = useState<Trip | null>(null);
  const [inviteTrip, setInviteTrip] = useState<TripWithStats | null>(null);

  const activeTrips = trips.filter((t) => t.status !== "completed" && t.status !== "cancelled");
  const completedTrips = trips.filter((t) => t.status === "completed" || t.status === "cancelled");

  const totalBudget = activeTrips.reduce((s, t) => s + Number(t.total_budget), 0);
  const totalSpent = activeTrips.reduce((s, t) => s + t.totalActual, 0);

  const handleSave = async (data: Parameters<typeof createTrip>[0]) => {
    try {
      if (editTrip) {
        await updateTrip(editTrip.id, { ...data, start_date: data.start_date ?? null, end_date: data.end_date ?? null, goal_id: data.goal_id ?? null });
        setEditTrip(null);
        success("Trip updated");
      } else {
        await createTrip(data);
        success("Trip created");
      }
    } catch {
      toastError(editTrip ? "Couldn't update trip" : "Couldn't create trip");
    }
  };

  const handleDeleteTrip = async (trip: Trip) => {
    const ok = await confirm({
      title: `Delete "${trip.name}"?`,
      message: "All itinerary items will be deleted too.",
      destructive: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await deleteTrip(trip.id);
      success("Trip deleted");
    } catch {
      toastError("Couldn't delete trip");
    }
  };

  const handleLeaveTrip = async (trip: Trip) => {
    const ok = await confirm({
      title: `Leave "${trip.name}"?`,
      message: "You won't be able to see or contribute to it anymore.",
      destructive: true,
      confirmLabel: "Leave",
    });
    if (!ok) return;
    try {
      await leaveTrip(trip.id);
      info("Left the trip");
    } catch {
      toastError("Couldn't leave trip");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Trips</h1>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5 break-words">
            {activeTrips.length} active · ${totalSpent.toFixed(2)} spent of ${totalBudget.toFixed(2)}
          </p>
        </div>
        <button onClick={() => { setEditTrip(null); setShowAddModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-blue-600/20 shrink-0 self-start sm:self-auto">
          <Plus size={16} /> <span>New Trip</span>
        </button>
      </div>

      {activeTrips.length > 0 && totalBudget > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Plane size={16} className="text-gray-400 dark:text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Total spending</h2>
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : 0}%</span>
          </div>
          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all rounded-full" style={{ width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%` }} />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>${totalSpent.toFixed(2)} spent</span>
            <span>${Math.max(0, totalBudget - totalSpent).toFixed(2)} left</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard className="hidden md:block" />
          <SkeletonCard className="hidden md:block" />
        </div>
      ) : trips.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No trips yet"
          description="Plan a trip with an overall budget, then add items (hotels, food, activities) and track spending as you go."
          action={{ label: "Plan your first trip", onClick: () => setShowAddModal(true) }}
        />
      ) : (
        <>
          {activeTrips.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeTrips.map((t, i) => {
                const Icon = getTripIcon(t.icon);
                const progress = t.progress;
                const warn = t.overBudget;
                const linkedGoal = t.goal_id ? goals.find((g) => g.id === t.goal_id) : null;
                return (
                  <motion.div key={t.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                    className="group relative">
                    <Link href={`/trips/${t.id}`} className="relative overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md rounded-2xl transition-all block cursor-pointer">
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
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 -mt-8 shadow-sm border-2 border-white" style={{ background: t.color, color: "white" }}>
                            <Icon size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 transition-colors">{t.name}</h3>
                                  {t.is_shared && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                                      <Users size={10} /> {t.members.length}
                                    </span>
                                  )}
                                  {linkedGoal && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" title={`Linked to goal: ${linkedGoal.name}`}>
                                      <Target size={10} /> GOAL
                                    </span>
                                  )}
                                </div>
                                {t.destination && (
                                  <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                                    <MapPin size={10} /> {t.destination}
                                  </p>
                                )}
                                {(t.start_date || t.end_date) && (
                                  <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                                    <Calendar size={10} /> {formatDateRange(t.start_date, t.end_date)}
                                  </p>
                                )}
                              </div>
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold shrink-0 ${
                                t.status === "active" ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300" :
                                t.status === "planning" ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                              }`}>
                                {t.status.toUpperCase()}
                              </span>
                            </div>

                            {/* Member avatar stack */}
                            {t.is_shared && t.members.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-2">
                                <div className="flex -space-x-1.5">
                                  {t.members.slice(0, 4).map((m, mi) => {
                                    const initial = m.user_id.charAt(0).toUpperCase();
                                    return (
                                      <div key={m.id}
                                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white ring-2 ring-white"
                                        style={{ background: `hsl(${(mi * 73) % 360}, 55%, 55%)` }}
                                        title={m.role === "owner" ? "Owner" : "Member"}
                                      >
                                        {initial}
                                      </div>
                                    );
                                  })}
                                  {t.members.length > 4 && (
                                    <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[9px] font-semibold text-gray-500 dark:text-gray-400 ring-2 ring-white">
                                      +{t.members.length - 4}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Budget */}
                            <div className="mt-3 flex items-baseline justify-between mb-1">
                              <div>
                                <span className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">${t.totalActual.toFixed(2)}</span>
                                <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">/ ${Number(t.total_budget).toFixed(2)}</span>
                              </div>
                              <span className="text-xs font-bold tabular-nums" style={{ color: t.color }}>{progress.toFixed(0)}%</span>
                            </div>

                            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-2">
                              <div className="h-full transition-all rounded-full" style={{ width: `${Math.min(100, progress)}%`, background: warn ? "#ef4444" : t.color }} />
                            </div>

                            <div className="flex items-center justify-between text-xs">
                              {warn ? (
                                <span className="text-red-600 dark:text-red-400 flex items-center gap-1"><TrendingUp size={11} /> Over budget if fully spent</span>
                              ) : t.skippedSavings > 0 ? (
                                <span className="text-green-600 dark:text-green-400 flex items-center gap-1"><TrendingDown size={11} /> +${t.skippedSavings.toFixed(2)} saved by skipping</span>
                              ) : (
                                <span className="text-gray-500 dark:text-gray-400">${Math.max(0, t.remaining).toFixed(2)} headroom</span>
                              )}
                              <span className="text-gray-400 dark:text-gray-500">{t.items.length} {t.items.length === 1 ? "item" : "items"}</span>
                            </div>
                          </div>
                        </div>

                      </div>
                    </Link>

                    {/* Action buttons overlay — sibling of Link, not inside it.
                        Pointer-events let through card clicks when row is hidden. */}
                    <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none group-hover:pointer-events-auto">
                      {t.is_shared && t.isOwner && (
                        <button type="button" onClick={() => setInviteTrip(t)}
                          className="text-white/90 hover:text-white bg-black/30 hover:bg-black/50 p-1.5 rounded backdrop-blur-sm" title="Invite members"><UserPlus size={12} /></button>
                      )}
                      {t.isOwner && (
                        <button type="button" onClick={() => { setEditTrip(t); setShowAddModal(true); }}
                          className="text-white/90 hover:text-white bg-black/30 hover:bg-black/50 p-1.5 rounded backdrop-blur-sm" title="Edit"><Pencil size={12} /></button>
                      )}
                      {t.isOwner ? (
                        <button type="button" onClick={() => handleDeleteTrip(t)}
                          className="text-white/90 hover:text-white bg-black/30 hover:bg-black/50 p-1.5 rounded backdrop-blur-sm" title="Delete"><Trash2 size={12} /></button>
                      ) : (
                        <button type="button" onClick={() => handleLeaveTrip(t)}
                          className="text-white/90 hover:text-white bg-black/30 hover:bg-black/50 p-1.5 rounded backdrop-blur-sm" title="Leave trip"><LogOut size={12} /></button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {completedTrips.length > 0 && (
            <div className="space-y-2 pt-2">
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Past & cancelled trips</h2>
              {completedTrips.map((t) => {
                const Icon = getTripIcon(t.icon);
                return (
                  <Link href={`/trips/${t.id}`} key={t.id}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 flex items-center gap-3 opacity-80 hover:opacity-100 hover:shadow-md transition-all">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${t.color}15`, color: t.color }}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{t.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        {t.destination ? `${t.destination} · ` : ""}
                        ${t.totalActual.toFixed(2)} spent{t.status === "cancelled" ? " · cancelled" : ""}
                      </p>
                    </div>
                    {t.isOwner && (
                      <button onClick={(e) => { e.preventDefault(); handleDeleteTrip(t); }}
                        className="text-gray-300 dark:text-gray-600 hover:text-red-500 p-1.5 rounded" title="Delete"><Trash2 size={13} /></button>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      <AddTripModal isOpen={showAddModal} trip={editTrip} onClose={() => { setShowAddModal(false); setEditTrip(null); }} onSave={handleSave} />
      <InviteTripMembersModal isOpen={!!inviteTrip} trip={inviteTrip} onClose={() => setInviteTrip(null)} onInvite={inviteToTrip} onRemoveMember={removeTripMember} />
    </div>
  );
}
