import type { MetalType } from "./types";

export const METALS: Record<
  MetalType,
  { name: string; symbol: string; color: string; bgClass: string; textClass: string; iconBg: string; defaultPrice: number }
> = {
  gold: {
    name: "Gold",
    symbol: "Au",
    color: "#F59E0B",
    bgClass: "bg-amber-50",
    textClass: "text-amber-600",
    iconBg: "bg-amber-100 text-amber-700",
    defaultPrice: 2935.0,
  },
  silver: {
    name: "Silver",
    symbol: "Ag",
    color: "#94A3B8",
    bgClass: "bg-slate-50",
    textClass: "text-slate-600",
    iconBg: "bg-slate-100 text-slate-700",
    defaultPrice: 32.8,
  },
  platinum: {
    name: "Platinum",
    symbol: "Pt",
    color: "#71717A",
    bgClass: "bg-zinc-50",
    textClass: "text-zinc-600",
    iconBg: "bg-zinc-100 text-zinc-700",
    defaultPrice: 985.0,
  },
  palladium: {
    name: "Palladium",
    symbol: "Pd",
    color: "#78716C",
    bgClass: "bg-stone-50",
    textClass: "text-stone-600",
    iconBg: "bg-stone-100 text-stone-700",
    defaultPrice: 955.0,
  },
};

export const METAL_KEYS: MetalType[] = ["gold", "silver", "platinum", "palladium"];

export const FORM_TYPES = [
  { value: "coin", label: "Coin" },
  { value: "bar", label: "Bar" },
  { value: "round", label: "Round" },
  { value: "other", label: "Other" },
] as const;

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
