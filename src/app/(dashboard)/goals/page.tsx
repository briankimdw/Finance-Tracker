"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  Plus, Pencil, Trash2, GripVertical, Check, Calendar,
  Target, Sparkles, Trophy, ChevronDown, ChevronUp, Trash, ArrowUp, ArrowDown,
  ExternalLink, Users, UserPlus, LogOut, Plane,
} from "lucide-react";
import AddGoalModal from "@/components/AddGoalModal";
import AddContributionModal from "@/components/AddContributionModal";
import AddTripModal from "@/components/AddTripModal";
import InviteGoalMembersModal from "@/components/InviteGoalMembersModal";
import { useGoals } from "@/hooks/useGoals";
import { useTrips } from "@/hooks/useTrips";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getGoalIcon } from "@/lib/goalIcons";
import type { Goal, GoalWithStats } from "@/lib/types";

function formatTargetDate(targetDate: string | null, days: number | null): string {
  if (!targetDate) return "";
  const date = new Date(targetDate + "T12:00:00");
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (days === null) return dateStr;
  if (days < 0) return `Past due (${dateStr})`;
  if (days === 0) return `Due today`;
  if (days === 1) return `Tomorrow`;
  if (days <= 30) return `In ${days} days`;
  if (days <= 365) return `In ${Math.round(days / 30)} months`;
  return dateStr;
}

export default function GoalsPage() {
  const { goals, loading, createGoal, updateGoal, deleteGoal, reorderGoals, addContribution, deleteContribution, inviteToGoal, inviteFriendToGoal, removeMember, leaveGoal } = useGoals();
  const { trips, createTrip } = useTrips();
  const { success, error: toastError, info } = useToast();
  const confirm = useConfirm();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [contribGoal, setContribGoal] = useState<GoalWithStats | null>(null);
  const [inviteGoal, setInviteGoal] = useState<GoalWithStats | null>(null);
  const [tripFromGoalId, setTripFromGoalId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const handleSave = async (data: Parameters<typeof createGoal>[0]) => {
    try {
      if (editGoal) {
        await updateGoal(editGoal.id, { ...data, target_date: data.target_date ?? null });
        setEditGoal(null);
        success("Goal updated");
      } else {
        await createGoal(data);
        success("Goal created");
      }
    } catch {
      toastError(editGoal ? "Couldn't update goal" : "Couldn't create goal");
    }
  };

  const handleDeleteGoal = async (goal: GoalWithStats, withContributions: boolean) => {
    const ok = await confirm({
      title: `Delete "${goal.name}"?`,
      message: withContributions ? "All contributions will be deleted too." : undefined,
      destructive: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await deleteGoal(goal.id);
      success("Goal deleted");
    } catch {
      toastError("Couldn't delete goal");
    }
  };

  const handleLeaveGoal = async (goal: GoalWithStats) => {
    const ok = await confirm({
      title: `Leave "${goal.name}"?`,
      message: "You won't be able to see or contribute to it anymore.",
      destructive: true,
      confirmLabel: "Leave",
    });
    if (!ok) return;
    try {
      await leaveGoal(goal.id);
      info("Left the goal");
    } catch {
      toastError("Couldn't leave goal");
    }
  };

  const handleAddContribution = async (...args: Parameters<typeof addContribution>) => {
    try {
      const amount = Number(args[1]) || 0;
      await addContribution(...args);
      if (amount < 0) {
        info(`$${Math.abs(amount).toFixed(2)} withdrawn`);
      } else {
        success(`$${amount.toFixed(2)} contributed`);
      }
    } catch {
      toastError("Couldn't save contribution");
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const onDragStart = (i: number) => { dragIdx.current = i; };
  const onDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOver(i); };
  const onDragEnd = () => { setDragOver(null); dragIdx.current = null; };
  const onDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === i) { onDragEnd(); return; }
    const next = [...goals];
    const [moved] = next.splice(from, 1);
    next.splice(i, 0, moved);
    reorderGoals(next);
    onDragEnd();
  };

  const activeGoals = goals.filter((g) => !g.completed);
  const completedGoals = goals.filter((g) => g.completed);
  const totalSaved = activeGoals.reduce((sum, g) => sum + g.saved, 0);
  const totalTarget = activeGoals.reduce((sum, g) => sum + Number(g.target_amount), 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Goals & Wishlist</h1>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5">{activeGoals.length} active &middot; ${totalSaved.toFixed(2)} saved of ${totalTarget.toFixed(2)}</p>
        </div>
        <button onClick={() => { setEditGoal(null); setShowAddModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-blue-600/20">
          <Plus size={16} /> New Goal
        </button>
      </div>

      {/* Overall progress */}
      {activeGoals.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-gray-400 dark:text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Overall Progress</h2>
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{overallProgress.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all rounded-full" style={{ width: `${Math.min(100, overallProgress)}%` }} />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>${totalSaved.toFixed(2)} saved</span>
            <span>${(totalTarget - totalSaved).toFixed(2)} to go</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : goals.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mb-3">
              <Sparkles size={22} className="text-blue-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No goals yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs text-center">Set savings goals or wishlist items and track your progress</p>
            <button onClick={() => setShowAddModal(true)} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1">
              <Plus size={14} /> Create your first goal
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Active goals */}
          {activeGoals.length > 0 && (
            <div className="space-y-3">
              {activeGoals.map((g, i) => {
                const Icon = getGoalIcon(g.icon);
                const isExpanded = expanded.has(g.id);
                const isOver = dragOver === i;
                // Linked-trip sync — treat trip spending as progress toward
                // the goal. Combined "saved" = direct contributions + money
                // already spent on the linked trip. This keeps the goal in
                // sync with trip activity without separate entries.
                const linkedTripForSync = trips.find((t) => t.goal_id === g.id);
                const tripSpent = linkedTripForSync ? linkedTripForSync.totalActual : 0;
                const directSaved = g.saved;
                const combinedSaved = directSaved + tripSpent;
                const target = Number(g.target_amount);
                const combinedProgress = target > 0 ? Math.min(100, (combinedSaved / target) * 100) : 0;
                const combinedRemaining = Math.max(0, target - combinedSaved);
                const isComplete = combinedProgress >= 100;

                return (
                  <div key={g.id}
                    draggable
                    onDragStart={() => onDragStart(i)}
                    onDragOver={(e) => onDragOver(e, i)}
                    onDragEnd={onDragEnd}
                    onDrop={(e) => onDrop(e, i)}
                    className={`group bg-white dark:bg-gray-900 border rounded-xl shadow-sm overflow-hidden transition-all ${isOver ? "border-blue-400 ring-2 ring-blue-200 -translate-y-0.5" : "border-gray-200 dark:border-gray-800 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700"}`}>

                    {/* Main card content — entire row is clickable to open Add Money */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`Add money to ${g.name}`}
                      onClick={() => setContribGoal(g)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setContribGoal(g);
                        }
                      }}
                      className="p-5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-inset"
                    >
                      <div className="flex items-start gap-4">
                        <GripVertical size={14} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400 mt-2 shrink-0 cursor-move" />

                        {/* Icon or image */}
                        {g.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={g.image_url}
                            alt={g.name}
                            className="w-14 h-14 rounded-2xl object-cover shrink-0 shadow-sm border border-gray-100 dark:border-gray-800"
                            onError={(e) => {
                              const img = e.target as HTMLImageElement;
                              img.style.display = "none";
                              img.nextElementSibling?.classList.remove("hidden");
                            }}
                          />
                        ) : null}
                        <div
                          className={`${g.image_url ? "hidden" : ""} w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm`}
                          style={{ background: `${g.color}15`, color: g.color }}
                        >
                          <Icon size={26} />
                        </div>

                        {/* Main info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{g.name}</h3>
                                {g.url && (
                                  <a
                                    href={g.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-gray-300 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-400 shrink-0 transition-colors"
                                    title="Open link"
                                  >
                                    <ExternalLink size={13} />
                                  </a>
                                )}
                                {g.is_shared && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                                    <Users size={10} /> SHARED · {g.members.length}
                                  </span>
                                )}
                                {(() => {
                                  const relatedTrip = trips.find((t) => t.goal_id === g.id);
                                  return relatedTrip ? (
                                    <Link href={`/trips/${relatedTrip.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 hover:bg-sky-200" title={relatedTrip.name}>
                                      <Plane size={10} /> TRIP · ${relatedTrip.totalActual.toFixed(0)}/${Number(relatedTrip.total_budget).toFixed(0)}
                                    </Link>
                                  ) : null;
                                })()}
                                {isComplete && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                                    <Trophy size={10} /> COMPLETE
                                  </span>
                                )}
                              </div>
                              {g.target_date && (
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                                  <Calendar size={11} /> {formatTargetDate(g.target_date, g.daysUntilTarget)}
                                </p>
                              )}
                              {/* Member avatar stack (only on shared goals with 2+ members) */}
                              {g.is_shared && g.members.length > 0 && (
                                <div className="flex items-center gap-1.5 mt-2">
                                  <div className="flex -space-x-1.5">
                                    {g.members.slice(0, 4).map((m, mi) => {
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
                                    {g.members.length > 4 && (
                                      <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[9px] font-semibold text-gray-500 dark:text-gray-400 ring-2 ring-white">
                                        +{g.members.length - 4}
                                      </div>
                                    )}
                                  </div>
                                  {g.isOwner && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setInviteGoal(g); }}
                                      className="text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-0.5 ml-1"
                                    >
                                      <UserPlus size={10} /> Invite
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              {isComplete && (
                                <button onClick={(e) => { e.stopPropagation(); updateGoal(g.id, { completed: true }); }} className="text-xs text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 p-1.5 rounded" title="Mark complete">
                                  <Check size={14} />
                                </button>
                              )}
                              {g.is_shared && g.isOwner && (
                                <button onClick={(e) => { e.stopPropagation(); setInviteGoal(g); }} className="text-gray-400 dark:text-gray-500 hover:text-purple-600 p-1.5 rounded" title="Invite members"><UserPlus size={14} /></button>
                              )}
                              {(() => {
                                const relatedTrip = trips.find((t) => t.goal_id === g.id);
                                if (relatedTrip) {
                                  return (
                                    <Link href={`/trips/${relatedTrip.id}`} onClick={(e) => e.stopPropagation()} className="text-gray-400 dark:text-gray-500 hover:text-sky-600 p-1.5 rounded" title={`Open linked trip: ${relatedTrip.name}`}>
                                      <Plane size={14} />
                                    </Link>
                                  );
                                }
                                if (g.category === "travel" && g.isOwner) {
                                  return (
                                    <button onClick={(e) => { e.stopPropagation(); setTripFromGoalId(g.id); }} className="text-gray-400 dark:text-gray-500 hover:text-sky-600 p-1.5 rounded" title="Plan a trip from this goal">
                                      <Plane size={14} />
                                    </button>
                                  );
                                }
                                return null;
                              })()}
                              {g.isOwner && (
                                <button onClick={(e) => { e.stopPropagation(); setEditGoal(g); setShowAddModal(true); }} className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 p-1.5 rounded" title="Edit"><Pencil size={14} /></button>
                              )}
                              {g.isOwner ? (
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteGoal(g, true); }} className="text-gray-300 dark:text-gray-600 hover:text-red-500 p-1.5 rounded" title="Delete"><Trash2 size={14} /></button>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); handleLeaveGoal(g); }} className="text-gray-300 dark:text-gray-600 hover:text-red-500 p-1.5 rounded" title="Leave goal"><LogOut size={14} /></button>
                              )}
                            </div>
                          </div>

                          {/* Progress numbers (combined: contributions + linked-trip spending) */}
                          <div className="flex items-baseline justify-between mt-3 mb-1.5">
                            <div>
                              <span className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">${combinedSaved.toFixed(2)}</span>
                              <span className="text-sm text-gray-400 dark:text-gray-500 ml-1">/ ${target.toFixed(2)}</span>
                            </div>
                            <span className="text-sm font-bold tabular-nums" style={{ color: g.color }}>{combinedProgress.toFixed(1)}%</span>
                          </div>

                          {/* Progress bar — two-tone when trip spending contributes */}
                          <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden relative flex">
                            {/* Direct contributions (solid goal color) */}
                            {directSaved > 0 && target > 0 && (
                              <div className="h-full transition-all relative overflow-hidden"
                                style={{ width: `${Math.min(100, (directSaved / target) * 100)}%`, background: `linear-gradient(90deg, ${g.color}, ${g.color}dd)` }}>
                                {isComplete && (
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                                )}
                              </div>
                            )}
                            {/* Linked-trip spending (lighter / striped) */}
                            {linkedTripForSync && tripSpent > 0 && target > 0 && (
                              <div className="h-full transition-all relative"
                                title={`$${tripSpent.toFixed(2)} spent on the linked trip`}
                                style={{
                                  width: `${Math.min(100, (tripSpent / target) * 100)}%`,
                                  background: `repeating-linear-gradient(135deg, ${g.color}aa 0 5px, ${g.color}66 5px 10px)`,
                                }} />
                            )}
                          </div>

                          {/* Breakdown line — contributions + trip spent */}
                          <div className="mt-1.5 flex items-center gap-3 flex-wrap text-[11px] text-gray-500 dark:text-gray-400">
                            {directSaved > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <span className="w-2 h-2 rounded-sm" style={{ background: g.color }} />
                                ${directSaved.toFixed(2)} contributed
                              </span>
                            )}
                            {linkedTripForSync && tripSpent > 0 && (
                              <Link href={`/trips/${linkedTripForSync.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 hover:text-sky-700 dark:hover:text-sky-300 transition-colors">
                                <span className="w-2 h-2 rounded-sm" style={{
                                  background: `repeating-linear-gradient(135deg, ${g.color}aa 0 3px, ${g.color}66 3px 6px)`,
                                }} />
                                <Plane size={10} /> ${tripSpent.toFixed(2)} spent on trip
                              </Link>
                            )}
                          </div>

                          {/* Bottom row: remaining + actions */}
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {isComplete ? "🎉 Goal reached!" : `$${combinedRemaining.toFixed(2)} to go`}
                            </span>
                            <div className="flex items-center gap-2">
                              <button onClick={(e) => { e.stopPropagation(); setContribGoal(g); }} className="text-xs font-medium text-white px-3 py-1.5 rounded-md transition-all hover:shadow-md" style={{ background: g.color }}>
                                <Plus size={12} className="inline -ml-0.5" /> Add Money
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); toggleExpand(g.id); }} className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-800" title={isExpanded ? "Collapse history" : "Show history"}>
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded contributions */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 p-4">
                        <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Contribution History</h4>
                        {g.contributions.length === 0 ? (
                          <p className="text-xs text-gray-400 dark:text-gray-500 py-3 text-center">No contributions yet</p>
                        ) : (
                          <div className="space-y-1">
                            {g.contributions.map((c) => {
                              const isWithdrawal = Number(c.amount) < 0;
                              return (
                                <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:border-gray-200 transition-colors">
                                  <div className={`w-7 h-7 rounded-md flex items-center justify-center ${isWithdrawal ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400" : "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400"}`}>
                                    {isWithdrawal ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                      {isWithdrawal ? "Withdrew" : "Deposited"} ${Math.abs(Number(c.amount)).toFixed(2)}
                                    </p>
                                    {c.notes && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{c.notes}</p>}
                                  </div>
                                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{new Date(c.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                  <button onClick={() => deleteContribution(c.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 p-1 transition-colors" title="Delete">
                                    <Trash size={12} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed goals */}
          {completedGoals.length > 0 && (
            <div className="space-y-2 pt-4">
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Completed Goals</h2>
              {completedGoals.map((g) => {
                const Icon = getGoalIcon(g.icon);
                return (
                  <div key={g.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm flex items-center gap-3 opacity-75 hover:opacity-100 transition-opacity">
                    {g.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.image_url} alt={g.name} className="w-10 h-10 rounded-xl object-cover border border-gray-100 dark:border-gray-800 shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${g.color}15`, color: g.color }}>
                        <Icon size={18} />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{g.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">${g.saved.toFixed(2)} saved · Reached</p>
                    </div>
                    <Trophy size={16} className="text-amber-500" />
                    <button onClick={() => updateGoal(g.id, { completed: false })} className="text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-2 py-1 rounded-md font-medium">Reactivate</button>
                    <button onClick={() => handleDeleteGoal(g, false)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 p-1.5 rounded" title="Delete"><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <AddGoalModal isOpen={showAddModal} goal={editGoal} onClose={() => { setShowAddModal(false); setEditGoal(null); }} onSave={handleSave} />
      <AddContributionModal isOpen={!!contribGoal} goal={contribGoal} onClose={() => setContribGoal(null)} onSave={handleAddContribution} />
      <InviteGoalMembersModal isOpen={!!inviteGoal} goal={inviteGoal} onClose={() => setInviteGoal(null)} onInvite={inviteToGoal} onInviteFriend={inviteFriendToGoal} onRemoveMember={removeMember} />
      <AddTripModal
        isOpen={!!tripFromGoalId}
        defaultGoalId={tripFromGoalId}
        onClose={() => setTripFromGoalId(null)}
        onSave={async (data) => {
          try {
            await createTrip(data);
            success("Trip created");
          } catch {
            toastError("Couldn't create trip");
          }
        }}
      />
    </div>
  );
}
