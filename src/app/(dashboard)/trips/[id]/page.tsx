"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, MapPin, Calendar, Check, X, Pencil, Trash2, ExternalLink,
  TrendingUp, TrendingDown, Wallet, PiggyBank, Circle, List, CalendarDays,
  Users, UserPlus, LogOut, Target, Clock, Hash, Bed, Plane, Zap,
  Utensils, ShoppingBag, Package,
} from "lucide-react";
import { useTrips } from "@/hooks/useTrips";
import { useGoals } from "@/hooks/useGoals";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { getTripIcon, getCategoryIcon } from "@/lib/tripIcons";
import AddTripItemModal from "@/components/AddTripItemModal";
import InviteTripMembersModal from "@/components/InviteTripMembersModal";
import TripCalendar from "@/components/TripCalendar";
import TripSettlement from "@/components/TripSettlement";
import QuickLogPurchaseModal from "@/components/QuickLogPurchaseModal";
import type { TripItem, TripItemCategory, TripItemStatus, Profile } from "@/lib/types";

function fmtDate(d: string | null): string {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtTime(t: string | null): string {
  if (!t) return "";
  // t is 'HH:MM[:SS]' → show as 'h:mm AM/PM'
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  if (isNaN(h)) return t;
  const period = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m || 0).padStart(2, "0")} ${period}`;
}

const CATEGORY_CHOICES: { value: TripItemCategory | "all"; label: string; Icon: typeof Bed }[] = [
  { value: "all", label: "All", Icon: Package },
  { value: "lodging", label: "Lodging", Icon: Bed },
  { value: "transport", label: "Transport", Icon: Plane },
  { value: "food", label: "Food", Icon: Utensils },
  { value: "activity", label: "Activity", Icon: MapPin },
  { value: "shopping", label: "Shopping", Icon: ShoppingBag },
  { value: "other", label: "Other", Icon: Package },
];

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";
  const {
    trips, loading, addItem, updateItem, deleteItem,
    markItemDone, markItemSkipped, markItemPlanned,
    deleteTrip, updateTrip, inviteToTrip, inviteFriendToTrip, removeTripMember, leaveTrip, quickLogPurchase,
  } = useTrips();
  const { goals } = useGoals();
  const { user } = useAuth();
  const supabase = createClient();
  const trip = trips.find((t) => t.id === id);

  const [showItemModal, setShowItemModal] = useState(false);
  const [editItem, setEditItem] = useState<TripItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | TripItemStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | TripItemCategory>("all");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, Profile>>({});

  // Fetch member profiles for paid-by display
  useEffect(() => {
    if (!trip || trip.members.length === 0) return;
    (async () => {
      const ids = trip.members.map((m) => m.user_id);
      const { data } = await supabase.from("profiles").select("*").in("id", ids);
      const map: Record<string, Profile> = {};
      for (const p of (data as Profile[]) || []) map[p.id] = p;
      setMemberProfiles(map);
    })();
  }, [trip, supabase]);

  if (loading && !trip) {
    return <div className="text-center text-gray-400 py-20">Loading trip...</div>;
  }

  if (!trip) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Trip not found.</p>
        <Link href="/trips" className="text-blue-600 hover:text-blue-700 font-medium text-sm mt-3 inline-block">← Back to trips</Link>
      </div>
    );
  }

  const Icon = getTripIcon(trip.icon);
  const linkedGoal = trip.goal_id ? goals.find((g) => g.id === trip.goal_id) : null;

  let items = trip.items;
  if (statusFilter !== "all") items = items.filter((i) => i.status === statusFilter);
  if (categoryFilter !== "all") items = items.filter((i) => i.category === categoryFilter);

  const budget = Number(trip.total_budget);
  const { totalActual, plannedUpcoming, skippedSavings, overBudget } = trip;
  const projected = totalActual + plannedUpcoming;
  const unallocated = budget - totalActual - plannedUpcoming;

  const statusCounts = {
    all: trip.items.length,
    planned: trip.items.filter((i) => i.status === "planned").length,
    done: trip.items.filter((i) => i.status === "done").length,
    skipped: trip.items.filter((i) => i.status === "skipped").length,
  };

  // Per-category totals for filter chip badges
  const categoryCounts: Record<string, number> = { all: trip.items.length };
  for (const i of trip.items) categoryCounts[i.category] = (categoryCounts[i.category] || 0) + 1;

  const handleAddOrSave = async (data: Parameters<typeof addItem>[1]) => {
    if (editItem) {
      await updateItem(editItem.id, {
        name: data.name,
        category: data.category,
        planned_amount: data.planned_amount,
        actual_amount: data.actual_amount ?? 0,
        item_date: data.item_date ?? null,
        end_date: data.end_date ?? null,
        start_time: data.start_time ?? null,
        end_time: data.end_time ?? null,
        location: data.location ?? null,
        confirmation_code: data.confirmation_code ?? null,
        status: data.status,
        notes: data.notes ?? null,
        url: data.url ?? null,
      });
      setEditItem(null);
    } else {
      await addItem(trip.id, data);
    }
  };

  return (
    <div className="space-y-5">
      <Link href="/trips" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 w-fit">
        <ArrowLeft size={12} /> All trips
      </Link>

      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
        {trip.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={trip.image_url} alt="" className="w-full h-40 object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
        ) : (
          <div className="h-40" style={{ background: `linear-gradient(135deg, ${trip.color}, ${trip.color}aa)` }}>
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_30%,white,transparent_60%)]" />
          </div>
        )}
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 -mt-10 shadow-lg border-4 border-white" style={{ background: trip.color, color: "white" }}>
              <Icon size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 truncate">{trip.name}</h1>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  trip.status === "active" ? "bg-green-100 text-green-700" :
                  trip.status === "planning" ? "bg-blue-100 text-blue-700" :
                  trip.status === "cancelled" ? "bg-gray-200 text-gray-600" : "bg-amber-100 text-amber-700"
                }`}>{trip.status.toUpperCase()}</span>
                {trip.is_shared && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                    <Users size={10} /> SHARED · {trip.members.length}
                  </span>
                )}
                {linkedGoal && (
                  <Link href="/goals" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 hover:bg-blue-200" title={`Linked to goal: ${linkedGoal.name}`}>
                    <Target size={10} /> {linkedGoal.name}
                  </Link>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500">
                {trip.destination && <span className="flex items-center gap-1"><MapPin size={11} /> {trip.destination}</span>}
                {(trip.start_date || trip.end_date) && (
                  <span className="flex items-center gap-1">
                    <Calendar size={11} />
                    {trip.start_date && fmtDate(trip.start_date)}
                    {trip.start_date && trip.end_date && " → "}
                    {trip.end_date && fmtDate(trip.end_date)}
                  </span>
                )}
              </div>
              {trip.notes && <p className="text-xs text-gray-500 mt-2 whitespace-pre-line">{trip.notes}</p>}

              {/* Member avatars */}
              {trip.is_shared && trip.members.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="flex -space-x-1.5">
                    {trip.members.slice(0, 6).map((m, mi) => {
                      const initial = m.user_id.charAt(0).toUpperCase();
                      return (
                        <div key={m.id} className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white ring-2 ring-white"
                          style={{ background: `hsl(${(mi * 73) % 360}, 55%, 55%)` }}
                          title={m.role === "owner" ? "Owner" : "Member"}>
                          {initial}
                        </div>
                      );
                    })}
                    {trip.members.length > 6 && (
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-semibold text-gray-500 ring-2 ring-white">+{trip.members.length - 6}</div>
                    )}
                  </div>
                  {trip.isOwner && (
                    <button onClick={() => setShowInviteModal(true)} className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-0.5 ml-1">
                      <UserPlus size={11} /> Invite
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {trip.isOwner && !trip.is_shared && (
                <button onClick={() => { updateTrip(trip.id, { is_shared: true }); setShowInviteModal(true); }}
                  className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 px-2.5 py-1.5 rounded-md font-medium flex items-center gap-1"><UserPlus size={12} /> Invite</button>
              )}
              {trip.isOwner && trip.is_shared && (
                <button onClick={() => setShowInviteModal(true)}
                  className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 px-2.5 py-1.5 rounded-md font-medium flex items-center gap-1"><UserPlus size={12} /> Invite</button>
              )}
              {trip.isOwner && trip.status !== "completed" && (
                <button onClick={() => updateTrip(trip.id, { status: "completed" })}
                  className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-2.5 py-1.5 rounded-md font-medium">Mark done</button>
              )}
              {trip.isOwner ? (
                <button onClick={() => { if (confirm(`Delete "${trip.name}"?`)) { deleteTrip(trip.id); router.push("/trips"); } }}
                  className="text-gray-300 hover:text-red-500 p-1.5 rounded" title="Delete trip"><Trash2 size={14} /></button>
              ) : (
                <button onClick={() => { if (confirm(`Leave "${trip.name}"? You won't be able to see or contribute to it anymore.`)) { leaveTrip(trip.id); router.push("/trips"); } }}
                  className="text-gray-300 hover:text-red-500 p-1.5 rounded" title="Leave trip"><LogOut size={14} /></button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Budget summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BudgetCard label="Budget" value={budget} color="#3b82f6" />
        <BudgetCard label="Spent" value={totalActual} color="#10b981" Icon={Wallet} />
        <BudgetCard label="Still to spend" value={plannedUpcoming} color="#f59e0b" Icon={Circle} subtitle="planned items" />
        <BudgetCard
          label={unallocated >= 0 ? "Unallocated" : "Over budget"}
          value={Math.abs(unallocated)}
          color={unallocated >= 0 ? "#8b5cf6" : "#ef4444"}
          Icon={unallocated >= 0 ? PiggyBank : TrendingUp}
          subtitle={unallocated >= 0 ? "free to add" : "needs trimming"}
        />
      </div>

      {/* Main progress bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-gray-500">Progress through budget</span>
          <span className="text-gray-900 font-bold tabular-nums">${totalActual.toFixed(2)} / ${budget.toFixed(2)}</span>
        </div>
        <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full absolute top-0 left-0 rounded-full transition-all" style={{ width: `${budget > 0 ? Math.min(100, (totalActual / budget) * 100) : 0}%`, background: trip.color }} />
          {plannedUpcoming > 0 && (
            <div className="h-full absolute top-0 rounded-r-full transition-all opacity-40"
              style={{
                left: `${budget > 0 ? Math.min(100, (totalActual / budget) * 100) : 0}%`,
                width: `${budget > 0 ? Math.min(100 - (totalActual / budget) * 100, (plannedUpcoming / budget) * 100) : 0}%`,
                background: overBudget ? "#ef4444" : trip.color,
              }}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs">
          <LegendDot color={trip.color} label={`$${totalActual.toFixed(2)} spent`} />
          <LegendDot color={overBudget ? "#ef4444" : trip.color} opacity={0.4} label={`$${plannedUpcoming.toFixed(2)} still planned`} />
          {skippedSavings > 0 && (
            <span className="text-green-600 flex items-center gap-1.5 ml-auto">
              <TrendingDown size={12} /> +${skippedSavings.toFixed(2)} saved by skipping
            </span>
          )}
          {overBudget && (
            <span className="text-red-600 flex items-center gap-1.5 ml-auto">
              <TrendingUp size={12} /> ${(projected - budget).toFixed(2)} over if all planned items happen
            </span>
          )}
        </div>
      </div>

      {/* Settlement / who-paid-what (shared trips only) */}
      {trip.members.length >= 2 && (
        <TripSettlement trip={trip} currentUserId={user?.id ?? null} />
      )}

      {/* Itinerary header + view toggle */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Itinerary</h2>
          <p className="text-xs text-gray-400">Plan items, check them off as you go. Skipped items free their budget.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="inline-flex items-center border border-gray-200 rounded-lg bg-white p-0.5">
            <button onClick={() => setView("list")} className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md ${view === "list" ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"}`}>
              <List size={13} /> List
            </button>
            <button onClick={() => setView("calendar")} className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md ${view === "calendar" ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"}`}>
              <CalendarDays size={13} /> Calendar
            </button>
          </div>
          <button onClick={() => setShowQuickLog(true)}
            className="bg-white border border-amber-200 hover:border-amber-300 hover:bg-amber-50 text-amber-700 text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all"
            title="Quick-log a purchase you just made (adds as 'done' immediately)">
            <Zap size={14} /> Log purchase
          </button>
          <button onClick={() => { setEditItem(null); setShowItemModal(true); }} className="text-white text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all hover:shadow-lg"
            style={{ background: trip.color, boxShadow: `0 4px 12px ${trip.color}33` }}>
            <Plus size={14} /> Add item
          </button>
        </div>
      </div>

      {/* Category filter chips (shown in both views) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {CATEGORY_CHOICES.map(({ value, label, Icon: CIcon }) => (
          <button key={value} onClick={() => setCategoryFilter(value)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              categoryFilter === value ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
            }`}>
            <CIcon size={11} /> {label}
            <span className={`text-[10px] ${categoryFilter === value ? "opacity-70" : "opacity-60"}`}>{categoryCounts[value] || 0}</span>
          </button>
        ))}
      </div>

      {/* Calendar view */}
      {view === "calendar" && (
        <TripCalendar trip={trip} onSelectItem={(it) => { setEditItem(it); setShowItemModal(true); }} />
      )}

      {/* List view */}
      {view === "list" && (
        <>
          {/* Status filter pills */}
          <div className="flex items-center gap-2 text-xs">
            {(["all", "planned", "done", "skipped"] as const).map((f) => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`px-2.5 py-1 rounded-full font-medium transition-colors ${statusFilter === f ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                <span className="ml-1 text-[10px] opacity-70">{statusCounts[f]}</span>
              </button>
            ))}
          </div>

          {trip.items.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
              <p className="text-sm font-semibold text-gray-700">No items yet</p>
              <p className="text-xs text-gray-400 mt-1">Add hotels, flights, dinners, activities — anything you want to track spending on.</p>
              <button onClick={() => setShowItemModal(true)} className="mt-3 text-sm font-medium text-white px-3 py-1.5 rounded-lg" style={{ background: trip.color }}>
                <Plus size={12} className="inline -ml-0.5 mr-0.5" /> Add your first item
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-xs text-gray-400">No items match these filters.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, i) => (
                <TripItemCard key={item.id} item={item} trip={trip}
                  memberProfiles={memberProfiles}
                  currentUserId={user?.id ?? null}
                  isShared={trip.members.length >= 2}
                  onEdit={() => { setEditItem(item); setShowItemModal(true); }}
                  onDone={() => markItemDone(item)} onSkip={() => markItemSkipped(item.id)} onReset={() => markItemPlanned(item.id)}
                  onDelete={() => { if (confirm(`Delete "${item.name}"?`)) deleteItem(item.id); }} delay={i * 0.02} />
              ))}
            </div>
          )}
        </>
      )}

      <AddTripItemModal
        isOpen={showItemModal}
        tripId={trip.id}
        tripColor={trip.color}
        item={editItem}
        remainingBudget={unallocated}
        members={trip.members}
        currentUserId={user?.id ?? null}
        onClose={() => { setShowItemModal(false); setEditItem(null); }}
        onSave={handleAddOrSave}
      />
      <InviteTripMembersModal
        isOpen={showInviteModal}
        trip={trip}
        onClose={() => setShowInviteModal(false)}
        onInvite={inviteToTrip}
        onInviteFriend={inviteFriendToTrip}
        onRemoveMember={removeTripMember}
      />
      <QuickLogPurchaseModal
        isOpen={showQuickLog}
        tripColor={trip.color}
        tripName={trip.name}
        members={trip.members}
        currentUserId={user?.id ?? null}
        onClose={() => setShowQuickLog(false)}
        onSave={async (data) => { await quickLogPurchase(trip.id, data); }}
      />
    </div>
  );
}

function BudgetCard({ label, value, color, Icon, subtitle }: { label: string; value: number; color: string; Icon?: typeof Wallet; subtitle?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        {Icon && <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `${color}15`, color }}><Icon size={11} /></div>}
      </div>
      <p className="text-lg font-bold text-gray-900 tabular-nums mt-0.5">${value.toFixed(2)}</p>
      {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function LegendDot({ color, label, opacity = 1 }: { color: string; label: string; opacity?: number }) {
  return (
    <span className="flex items-center gap-1.5 text-gray-500">
      <span className="w-2 h-2 rounded-full" style={{ background: color, opacity }} />
      {label}
    </span>
  );
}

function TripItemCard({
  item, trip, onEdit, onDone, onSkip, onReset, onDelete, delay,
  memberProfiles, currentUserId, isShared,
}: {
  item: TripItem;
  trip: { color: string };
  onEdit: () => void;
  onDone: () => void;
  onSkip: () => void;
  onReset: () => void;
  onDelete: () => void;
  delay?: number;
  memberProfiles?: Record<string, Profile>;
  currentUserId?: string | null;
  isShared?: boolean;
}) {
  const CatIcon = getCategoryIcon(item.category);
  const planned = Number(item.planned_amount);
  const actual = Number(item.actual_amount);
  const diff = actual - planned;

  const isLodging = item.category === "lodging";
  const isTransport = item.category === "transport";
  const payerId = item.paid_by || item.user_id;
  const payerProfile = payerId ? memberProfiles?.[payerId] : undefined;
  const payerName = !payerId ? null : payerId === currentUserId ? "You" : (payerProfile?.display_name || payerProfile?.username || payerId.slice(0, 8));
  const showPayer = isShared && item.status === "done" && !!payerId;
  const hasBookingInfo = !!(item.location || item.confirmation_code || item.start_time || item.end_time || item.end_date) || showPayer;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className={`group bg-white border rounded-xl hover:shadow-sm transition-all overflow-hidden ${
        item.status === "done" ? "border-green-200" :
        item.status === "skipped" ? "border-gray-200 opacity-60" :
        "border-gray-200"
      }`}>
      <div className="p-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${trip.color}15`, color: trip.color }}>
            <CatIcon size={16} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-semibold ${item.status === "skipped" ? "line-through text-gray-400" : "text-gray-900"}`}>{item.name}</p>
              {item.status === "done" && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">DONE</span>}
              {item.status === "skipped" && <span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">SKIPPED</span>}
              {item.url && (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-blue-600" title="Open link" onClick={(e) => e.stopPropagation()}><ExternalLink size={12} /></a>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400 flex-wrap">
              <span className="capitalize">{item.category}</span>
              {item.item_date && (
                <><span>·</span><span className="flex items-center gap-0.5">
                  <Calendar size={10} /> {fmtDate(item.item_date)}
                  {item.end_date && ` → ${fmtDate(item.end_date)}`}
                </span></>
              )}
              {(item.start_time || item.end_time) && (
                <><span>·</span><span className="flex items-center gap-0.5">
                  <Clock size={10} /> {fmtTime(item.start_time)}{item.end_time ? ` – ${fmtTime(item.end_time)}` : ""}
                </span></>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            {item.status === "done" ? (
              <>
                <p className="text-sm font-bold text-gray-900 tabular-nums">${actual.toFixed(2)}</p>
                {diff !== 0 && (
                  <p className={`text-[10px] tabular-nums ${diff > 0 ? "text-red-600" : "text-green-600"}`}>
                    {diff > 0 ? `+$${diff.toFixed(2)} over` : `−$${Math.abs(diff).toFixed(2)} saved`}
                  </p>
                )}
              </>
            ) : (
              <p className={`text-sm font-semibold tabular-nums ${item.status === "skipped" ? "text-gray-400 line-through" : "text-gray-700"}`}>
                ${planned.toFixed(2)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {item.status !== "done" && (
              <button onClick={onDone} className="text-gray-400 hover:text-green-600 p-1 rounded hover:bg-green-50" title="Mark done"><Check size={14} /></button>
            )}
            {item.status !== "skipped" && (
              <button onClick={onSkip} className="text-gray-400 hover:text-amber-600 p-1 rounded hover:bg-amber-50" title="Skip"><X size={14} /></button>
            )}
            {item.status !== "planned" && (
              <button onClick={onReset} className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50" title="Reset to planned"><Circle size={14} /></button>
            )}
            <button onClick={onEdit} className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50" title="Edit"><Pencil size={13} /></button>
            <button onClick={onDelete} className="text-gray-300 hover:text-red-500 p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={13} /></button>
          </div>
        </div>

        {/* Booking info block — shown for lodging/transport, when any booking field set, or when shared+done */}
        {hasBookingInfo && (isLodging || isTransport || item.location || item.confirmation_code || showPayer) && (
          <div className="mt-2.5 pl-12 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            {showPayer && (
              <div className="flex items-center gap-1.5 text-gray-500">
                <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                  style={{ background: `hsl(${((payerId?.charCodeAt(0) || 0) * 31) % 360}, 55%, 55%)` }}>
                  {(payerName || "?").charAt(0).toUpperCase()}
                </div>
                <span>Paid by <span className="font-medium text-gray-700">{payerName}</span></span>
              </div>
            )}
            {item.location && (
              <div className="flex items-center gap-1.5 text-gray-500">
                <MapPin size={11} className="text-gray-400 shrink-0" />
                <span className="truncate" title={item.location}>{item.location}</span>
              </div>
            )}
            {item.confirmation_code && (
              <div className="flex items-center gap-1.5 text-gray-500">
                <Hash size={11} className="text-gray-400 shrink-0" />
                <span className="font-mono text-gray-700 truncate">{item.confirmation_code}</span>
              </div>
            )}
            {item.notes && (
              <div className="flex items-center gap-1.5 text-gray-500 sm:col-span-2">
                <span className="text-gray-400 shrink-0">✎</span>
                <span className="truncate" title={item.notes}>{item.notes}</span>
              </div>
            )}
          </div>
        )}
        {!hasBookingInfo && item.notes && (
          <p className="mt-2 pl-12 text-[11px] text-gray-500 truncate" title={item.notes}>✎ {item.notes}</p>
        )}
      </div>
    </motion.div>
  );
}
