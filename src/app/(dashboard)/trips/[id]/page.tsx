"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, MapPin, Calendar, Check, X, Pencil, Trash2, ExternalLink,
  TrendingUp, TrendingDown, Wallet, PiggyBank, Circle, GripVertical,
} from "lucide-react";
import { useTrips } from "@/hooks/useTrips";
import { getTripIcon, getCategoryIcon } from "@/lib/tripIcons";
import AddTripItemModal from "@/components/AddTripItemModal";
import type { TripItem, TripItemStatus } from "@/lib/types";

function fmtDate(d: string | null): string {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";
  const { trips, loading, addItem, updateItem, deleteItem, markItemDone, markItemSkipped, markItemPlanned, deleteTrip, updateTrip } = useTrips();
  const trip = trips.find((t) => t.id === id);

  const [showItemModal, setShowItemModal] = useState(false);
  const [editItem, setEditItem] = useState<TripItem | null>(null);
  const [filter, setFilter] = useState<"all" | TripItemStatus>("all");

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
  const items = filter === "all" ? trip.items : trip.items.filter((i) => i.status === filter);

  // Budget math
  const budget = Number(trip.total_budget);
  const { totalActual, plannedUpcoming, skippedSavings, overBudget } = trip;
  const projected = totalActual + plannedUpcoming;
  const available = budget - totalActual;
  const unallocated = available - plannedUpcoming; // what's still free to plan

  const counts = {
    all: trip.items.length,
    planned: trip.items.filter((i) => i.status === "planned").length,
    done: trip.items.filter((i) => i.status === "done").length,
    skipped: trip.items.filter((i) => i.status === "skipped").length,
  };

  const handleAddOrSave = async (data: Parameters<typeof addItem>[1]) => {
    if (editItem) {
      await updateItem(editItem.id, {
        name: data.name,
        category: data.category,
        planned_amount: data.planned_amount,
        actual_amount: data.actual_amount ?? 0,
        item_date: data.item_date ?? null,
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
      {/* Back link */}
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
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {trip.status !== "completed" && (
                <button onClick={() => updateTrip(trip.id, { status: "completed" })}
                  className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-2.5 py-1.5 rounded-md font-medium">Mark done</button>
              )}
              <button onClick={() => { if (confirm(`Delete "${trip.name}"?`)) { deleteTrip(trip.id); router.push("/trips"); } }}
                className="text-gray-300 hover:text-red-500 p-1.5 rounded" title="Delete trip"><Trash2 size={14} /></button>
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
          {/* Actual spent */}
          <div className="h-full absolute top-0 left-0 rounded-full transition-all" style={{ width: `${budget > 0 ? Math.min(100, (totalActual / budget) * 100) : 0}%`, background: trip.color }} />
          {/* Planned upcoming ghost */}
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

      {/* Itinerary header + filter tabs */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Itinerary</h2>
          <p className="text-xs text-gray-400">Plan items, check them off as you go. Skipped items free up their budget.</p>
        </div>
        <button onClick={() => { setEditItem(null); setShowItemModal(true); }} className="text-white text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all hover:shadow-lg"
          style={{ background: trip.color, boxShadow: `0 4px 12px ${trip.color}33` }}>
          <Plus size={14} /> Add item
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 text-xs">
        {(["all", "planned", "done", "skipped"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-full font-medium transition-colors ${filter === f ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}>
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-1 text-[10px] opacity-70">{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Items list */}
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
          <p className="text-xs text-gray-400">No {filter} items.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => {
            const CatIcon = getCategoryIcon(item.category);
            const planned = Number(item.planned_amount);
            const actual = Number(item.actual_amount);
            const diff = actual - planned;
            return (
              <motion.div key={item.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.02 }}
                className={`group bg-white border rounded-xl p-3 hover:shadow-sm transition-all ${
                  item.status === "done" ? "border-green-200" :
                  item.status === "skipped" ? "border-gray-200 opacity-60" :
                  "border-gray-200"
                }`}>
                <div className="flex items-center gap-3">
                  <GripVertical size={12} className="text-gray-200 hidden sm:block" />

                  {/* Category icon */}
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${trip.color}15`, color: trip.color }}>
                    <CatIcon size={16} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-semibold ${item.status === "skipped" ? "line-through text-gray-400" : "text-gray-900"}`}>{item.name}</p>
                      {item.status === "done" && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">DONE</span>}
                      {item.status === "skipped" && <span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">SKIPPED</span>}
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-blue-600" title="Open link"><ExternalLink size={12} /></a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400 flex-wrap">
                      <span className="capitalize">{item.category}</span>
                      {item.item_date && <><span>·</span><span className="flex items-center gap-0.5"><Calendar size={10} /> {fmtDate(item.item_date)}</span></>}
                      {item.notes && <><span>·</span><span className="truncate max-w-[200px]">{item.notes}</span></>}
                    </div>
                  </div>

                  {/* Amount */}
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

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.status !== "done" && (
                      <button onClick={() => markItemDone(item)} className="text-gray-400 hover:text-green-600 p-1 rounded hover:bg-green-50" title="Mark done"><Check size={14} /></button>
                    )}
                    {item.status !== "skipped" && (
                      <button onClick={() => markItemSkipped(item.id)} className="text-gray-400 hover:text-amber-600 p-1 rounded hover:bg-amber-50" title="Skip"><X size={14} /></button>
                    )}
                    {item.status !== "planned" && (
                      <button onClick={() => markItemPlanned(item.id)} className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50" title="Reset to planned"><Circle size={14} /></button>
                    )}
                    <button onClick={() => { setEditItem(item); setShowItemModal(true); }} className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50" title="Edit"><Pencil size={13} /></button>
                    <button onClick={() => { if (confirm(`Delete "${item.name}"?`)) deleteItem(item.id); }} className="text-gray-300 hover:text-red-500 p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={13} /></button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AddTripItemModal
        isOpen={showItemModal}
        tripId={trip.id}
        tripColor={trip.color}
        item={editItem}
        remainingBudget={unallocated}
        onClose={() => { setShowItemModal(false); setEditItem(null); }}
        onSave={handleAddOrSave}
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
