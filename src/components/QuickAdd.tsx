"use client";

import { Plus, X, Briefcase, Zap } from "lucide-react";
import type { SavedIncome } from "@/lib/types";

interface QuickAddProps {
  savedIncomes: SavedIncome[];
  onQuickAdd: (saved: SavedIncome) => void;
  onDelete: (id: string) => void;
}

export default function QuickAdd({ savedIncomes, onQuickAdd, onDelete }: QuickAddProps) {
  if (savedIncomes.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Quick Add</h3>
      <div className="flex flex-wrap gap-2">
        {savedIncomes.map((saved) => (
          <div
            key={saved.id}
            className="group flex items-center gap-2 bg-white border border-gray-200 rounded-lg pl-3 pr-1 py-1.5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
          >
            <div className={`p-1 rounded ${saved.type === "main" ? "bg-blue-50" : "bg-purple-50"}`}>
              {saved.type === "main" ? (
                <Briefcase size={12} className="text-blue-600" />
              ) : (
                <Zap size={12} className="text-purple-600" />
              )}
            </div>
            <span className="text-sm font-medium text-gray-700">{saved.source}</span>
            <span className="text-sm text-gray-400">${Number(saved.amount).toFixed(2)}</span>
            <button
              onClick={() => onQuickAdd(saved)}
              className="p-1 rounded-md bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
              title="Add with today's date"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={() => onDelete(saved.id)}
              className="p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
              title="Remove quick-add"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
