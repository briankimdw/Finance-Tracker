"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getCategoryIcon } from "@/lib/tripIcons";
import type { TripItem, TripWithStats } from "@/lib/types";

interface TripCalendarProps {
  trip: TripWithStats;
  onSelectItem: (item: TripItem) => void;
}

// Returns a YYYY-MM-DD string for a JS Date, in local tz
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  return new Date(s + "T12:00:00");
}

export default function TripCalendar({ trip, onSelectItem }: TripCalendarProps) {
  // Determine month to show: if trip has a start_date use that month; else current month.
  const startHint = parseDate(trip.start_date) || new Date();
  const initialMonth = new Date(startHint.getFullYear(), startHint.getMonth(), 1);

  // Use a local derived month using state via refs — keep simple: recompute from trip and a stepper
  // We'll let the caller navigate by providing our own state hook.
  // Because this is a purely derived component, using useMemo for the month index is fine.
  // To allow navigation, we'd normally useState. Inline here for simplicity.
  const month = initialMonth;

  // Build 6-week grid from first Sunday on/before month start to last Saturday on/after month end
  const grid = useMemo(() => {
    const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const lastOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const start = new Date(firstOfMonth);
    start.setDate(start.getDate() - firstOfMonth.getDay()); // back up to Sunday
    const end = new Date(lastOfMonth);
    end.setDate(end.getDate() + (6 - lastOfMonth.getDay())); // forward to Saturday
    const days: Date[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [month]);

  // Bucket items by date (item_date for single-day, expand lodging across end_date range)
  const itemsByDate = useMemo(() => {
    const map = new Map<string, TripItem[]>();
    for (const it of trip.items) {
      if (!it.item_date) continue;
      const start = parseDate(it.item_date)!;
      const end = it.end_date ? parseDate(it.end_date) : null;
      if (end && end > start) {
        const cursor = new Date(start);
        while (cursor <= end) {
          const key = ymd(cursor);
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(it);
          cursor.setDate(cursor.getDate() + 1);
        }
      } else {
        const key = ymd(start);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(it);
      }
    }
    return map;
  }, [trip.items]);

  // Trip date range for highlight
  const tripStart = parseDate(trip.start_date);
  const tripEnd = parseDate(trip.end_date);

  const monthLabel = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const today = ymd(new Date());

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <ChevronLeft size={16} className="text-gray-300 dark:text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{monthLabel}</h3>
          <ChevronRight size={16} className="text-gray-300 dark:text-gray-600" />
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: trip.color }} /> trip dates</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" /> today</span>
        </div>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-1 text-center border-b border-gray-100 dark:border-gray-800">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {grid.map((d, i) => {
          const key = ymd(d);
          const inMonth = d.getMonth() === month.getMonth();
          const isToday = key === today;
          const inRange = tripStart && tripEnd && d >= tripStart && d <= tripEnd;
          const items = itemsByDate.get(key) || [];
          return (
            <div
              key={i}
              className={`min-h-[84px] p-1.5 border-b border-r border-gray-100 dark:border-gray-800 ${i % 7 === 6 ? "border-r-0" : ""} ${
                inMonth ? "" : "bg-gray-50/40"
              } ${inRange ? "relative" : ""}`}
            >
              {/* Trip-range highlight */}
              {inRange && (
                <div className="absolute inset-x-0 inset-y-0 opacity-[0.06] pointer-events-none" style={{ background: trip.color }} />
              )}
              <div className="flex items-center justify-between relative z-10">
                <span className={`text-[11px] font-medium ${
                  isToday ? "bg-gray-900 text-white rounded-full w-5 h-5 flex items-center justify-center" :
                  inMonth ? "text-gray-700 dark:text-gray-300" : "text-gray-300 dark:text-gray-600"
                }`}>
                  {d.getDate()}
                </span>
                {items.length > 2 && (
                  <span className="text-[9px] text-gray-400 dark:text-gray-500">{items.length}</span>
                )}
              </div>
              <div className="mt-1 space-y-0.5 relative z-10">
                {items.slice(0, 3).map((it) => {
                  const CatIcon = getCategoryIcon(it.category);
                  return (
                    <button
                      key={it.id + key}
                      onClick={() => onSelectItem(it)}
                      className="w-full text-left flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-medium truncate hover:ring-1 hover:ring-offset-1 transition"
                      style={{
                        background: `${trip.color}${it.status === "done" ? "33" : it.status === "skipped" ? "10" : "20"}`,
                        color: it.status === "skipped" ? "#9ca3af" : trip.color,
                        textDecoration: it.status === "skipped" ? "line-through" : "none",
                      }}
                      title={it.name}
                    >
                      <CatIcon size={9} className="shrink-0" />
                      <span className="truncate">{it.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
