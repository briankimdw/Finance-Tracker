"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { applyDueRecurringRules } from "@/lib/recurring";

/**
 * Invisible worker mounted once in the dashboard layout. When the app opens
 * it applies any recurring rules that have come due (rent, subscriptions,
 * paychecks...), logging the rows and adjusting account balances, then
 * surfaces a toast so the change isn't silent.
 */
export default function RecurringAutopilot() {
  const { user, loading } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const ranForRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;
    const key = user?.id ?? "anon";
    if (ranForRef.current === key) return;
    ranForRef.current = key;

    applyDueRecurringRules(user?.id ?? null)
      .then((applied) => {
        if (applied.length === 0) return;
        const expenseTotal = applied
          .filter((a) => a.rule.kind === "expense")
          .reduce((s, a) => s + Number(a.rule.amount), 0);
        const incomeTotal = applied
          .filter((a) => a.rule.kind === "income")
          .reduce((s, a) => s + Number(a.rule.amount), 0);
        const parts: string[] = [];
        if (expenseTotal > 0) parts.push(`-$${expenseTotal.toFixed(2)} bills`);
        if (incomeTotal > 0) parts.push(`+$${incomeTotal.toFixed(2)} income`);
        toast.info(
          `${applied.length} recurring ${applied.length === 1 ? "item" : "items"} applied (${parts.join(", ")})`,
          { action: { label: "View", onClick: () => router.push("/recurring") }, duration: 8000 }
        );
      })
      .catch(() => { /* non-fatal — rules stay due and retry next load */ });
  }, [user, loading, toast, router]);

  return null;
}
