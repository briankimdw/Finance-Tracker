"use client";

import { useState, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, TrendingUp, Briefcase, Zap,
  X, CalendarDays, DollarSign, CreditCard, ArrowDownRight,
} from "lucide-react";
import { useCalendar, getCalendarDays } from "@/hooks/useCalendar";
import type { DayData } from "@/hooks/useCalendar";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

type ViewFilter = "all" | "income" | "expenses";

function getFilteredTotal(data: DayData, filter: ViewFilter): number {
  if (filter === "income") return data.earned;
  if (filter === "expenses") return -data.spent;
  return data.total;
}

function getDayBg(total: number, maxVal: number): string {
  if (total === 0) return "";
  if (total < 0) {
    const r = Math.min(Math.abs(total) / Math.max(maxVal, 1), 1);
    return r > 0.5 ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800" : "bg-red-50/50 border-red-100 dark:border-red-800";
  }
  const r = Math.min(total / Math.max(maxVal, 1), 1);
  if (r > 0.7) return "bg-emerald-100 border-emerald-300";
  if (r > 0.4) return "bg-emerald-50 border-emerald-200";
  return "bg-green-50/70 border-green-200 dark:border-green-800";
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<{ date: string; data: DayData } | null>(null);
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");

  const { dayMap, monthTotal, monthEarned, monthSpent, loading } = useCalendar(year, month);
  const calendarDays = getCalendarDays(year, month);
  const today = now.toISOString().split("T")[0];

  const displayTotal = viewFilter === "income" ? monthEarned : viewFilter === "expenses" ? -monthSpent : monthTotal;

  const maxVal = useMemo(() => {
    let m = 0;
    dayMap.forEach((d) => {
      const v = Math.abs(getFilteredTotal(d, viewFilter));
      if (v > m) m = v;
    });
    return m;
  }, [dayMap, viewFilter]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1); setSelectedDay(null); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1); setSelectedDay(null); };
  const goToToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); setSelectedDay(null); };

  const handleDayClick = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const data = dayMap.get(dateStr);
    setSelectedDay({ date: dateStr, data: data || { items: [], incomes: [], expenses: [], total: 0, earned: 0, spent: 0 } });
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Calendar</h1>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5">Track your daily cash flow</p>
        </div>
        <div className="flex items-center gap-2">
          {!isCurrentMonth && (
            <button onClick={goToToday} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors">Today</button>
          )}
        </div>
      </div>

      {/* View filter toggle */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {([
            { key: "all" as const, label: "All", color: "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm" },
            { key: "income" as const, label: "Income Only", color: "bg-green-600 text-white shadow-sm" },
            { key: "expenses" as const, label: "Expenses Only", color: "bg-red-600 text-white shadow-sm" },
          ]).map((tab) => (
            <button key={tab.key} onClick={() => setViewFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewFilter === tab.key ? tab.color : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <DollarSign size={14} className="text-gray-400 dark:text-gray-500" />
            <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Net Total</span>
          </div>
          <p className={`text-xl font-bold ${monthTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {monthTotal >= 0 ? "+" : ""}${monthTotal.toFixed(2)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp size={14} className="text-gray-400 dark:text-gray-500" />
            <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Earned</span>
          </div>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">+${monthEarned.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <CreditCard size={14} className="text-gray-400 dark:text-gray-500" />
            <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Spent</span>
          </div>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">-${monthSpent.toFixed(2)}</p>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"><ChevronLeft size={20} /></button>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{MONTH_NAMES[month - 1]} {year}</h2>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"><ChevronRight size={20} /></button>
        </div>

        {loading ? (
          <div className="p-16 text-center text-gray-400 dark:text-gray-500">Loading...</div>
        ) : (
          <div className="p-5">
            <div className="grid grid-cols-7 gap-2 mb-2">
              {DAY_NAMES.map((d) => <div key={d} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} className="min-h-[72px]" />;
                const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const data = dayMap.get(dateStr);
                const isToday = dateStr === today;
                const isSelected = selectedDay?.date === dateStr;

                // Apply filter to what we show
                const hasIncome = data && (data.items.length > 0 || data.incomes.length > 0);
                const hasExpenses = data && data.expenses.length > 0;
                const hasData = viewFilter === "income" ? hasIncome : viewFilter === "expenses" ? hasExpenses : (hasIncome || hasExpenses);
                const total = data ? getFilteredTotal(data, viewFilter) : 0;
                const colorClass = hasData && total !== 0 ? getDayBg(total, maxVal) : "";

                return (
                  <button key={day} onClick={() => handleDayClick(day)}
                    className={`min-h-[72px] rounded-xl border p-2 flex flex-col items-start transition-all text-left
                      ${isSelected ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50 dark:bg-blue-950/40"
                        : isToday ? "border-blue-400 bg-blue-50/40 shadow-sm"
                        : hasData && total !== 0 ? colorClass
                        : "border-gray-100 dark:border-gray-800 hover:border-gray-200 hover:bg-gray-50/50"}`}>
                    <span className={`text-xs font-semibold leading-none ${isToday ? "bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center" : isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`}>{day}</span>
                    {hasData && total !== 0 && (
                      <div className="mt-auto w-full">
                        <p className={`text-xs font-bold ${total >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {total >= 0 ? "+" : ""}${Math.abs(total) >= 1000 ? `${(total / 1000).toFixed(1)}k` : total.toFixed(0)}
                        </p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Day detail panel */}
      {selectedDay && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm animate-in">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {new Date(selectedDay.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </h3>
              {selectedDay.data.earned > 0 && <span className="text-sm font-semibold text-green-600 dark:text-green-400 mr-3">+${selectedDay.data.earned.toFixed(2)}</span>}
              {selectedDay.data.spent > 0 && <span className="text-sm font-semibold text-red-600 dark:text-red-400">-${selectedDay.data.spent.toFixed(2)}</span>}
            </div>
            <button onClick={() => setSelectedDay(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><X size={18} /></button>
          </div>

          <div className="p-4 space-y-2">
            {selectedDay.data.items.length === 0 && selectedDay.data.incomes.length === 0 && selectedDay.data.expenses.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3"><CalendarDays size={20} className="text-gray-300 dark:text-gray-600" /></div>
                <p className="text-sm font-medium text-gray-400 dark:text-gray-500">No activity</p>
                <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Nothing recorded on this day</p>
              </div>
            )}

            {/* Reselling items */}
            {(viewFilter === "all" || viewFilter === "income") && selectedDay.data.items.map((item) => {
              const profit = Number(item.sale_price) - Number(item.purchase_price) - Number(item.fees || 0) - Number(item.shipping_costs || 0);
              return (
                <div key={item.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100/80 transition-colors">
                  <div className="p-2 rounded-lg bg-emerald-50"><TrendingUp size={16} className="text-emerald-600" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-medium truncate">{item.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Sold on {item.platform_sold} &middot; {Number(item.purchase_price) === 0 ? "Free item" : `Cost $${Number(item.purchase_price).toFixed(2)}`} → ${Number(item.sale_price).toFixed(2)}</p>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{profit >= 0 ? "+" : ""}${profit.toFixed(2)}</span>
                </div>
              );
            })}

            {/* Income */}
            {(viewFilter === "all" || viewFilter === "income") && selectedDay.data.incomes.map((inc) => (
              <div key={inc.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100/80 transition-colors">
                <div className={`p-2 rounded-lg ${inc.type === "main" ? "bg-blue-50 dark:bg-blue-950/40" : "bg-purple-50 dark:bg-purple-950/40"}`}>
                  {inc.type === "main" ? <Briefcase size={16} className="text-blue-600 dark:text-blue-400" /> : <Zap size={16} className="text-purple-600 dark:text-purple-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-gray-100 font-medium truncate">{inc.source}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{inc.type === "main" ? "Main Income" : "Side Income"} &middot; {inc.category}</p>
                </div>
                <span className="text-sm font-bold tabular-nums text-green-600 dark:text-green-400">+${Number(inc.amount).toFixed(2)}</span>
              </div>
            ))}

            {/* Expenses */}
            {(viewFilter === "all" || viewFilter === "expenses") && selectedDay.data.expenses.map((exp) => (
              <div key={exp.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50/50 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
                <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40"><ArrowDownRight size={16} className="text-red-500" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-gray-100 font-medium truncate">{exp.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{exp.category}{exp.recurring ? ` &middot; ${exp.frequency}` : ""}</p>
                </div>
                <span className="text-sm font-bold tabular-nums text-red-600 dark:text-red-400">-${Number(exp.amount).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
