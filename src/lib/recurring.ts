import { createClient } from "@/lib/supabase/client";
import { adjustAccountBalance } from "@/lib/updateBalance";
import { todayEST } from "@/lib/dates";
import type { RecurringFrequency, RecurringRule } from "@/lib/types";

// Rule frequencies map onto the labels expense/income rows already use.
export const RULE_FREQ_LABEL: Record<RecurringFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Next occurrence after `isoDate`. day_of_month (1-28) keeps monthly/yearly rules stable across short months. */
export function advanceDueDate(isoDate: string, frequency: RecurringFrequency, dayOfMonth: number | null): string {
  const d = new Date(isoDate + "T12:00:00");
  if (frequency === "weekly") {
    d.setDate(d.getDate() + 7);
  } else if (frequency === "biweekly") {
    d.setDate(d.getDate() + 14);
  } else if (frequency === "monthly") {
    const day = dayOfMonth ?? Math.min(d.getDate(), 28);
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    d.setDate(day);
  } else {
    const day = dayOfMonth ?? Math.min(d.getDate(), 28);
    d.setDate(1);
    d.setFullYear(d.getFullYear() + 1);
    d.setDate(day);
  }
  return fmt(d);
}

/** Rolls a (possibly past) start date forward to the first occurrence on/after today. */
export function firstDueOnOrAfterToday(startDate: string, frequency: RecurringFrequency, dayOfMonth: number | null): string {
  const today = todayEST();
  let due = startDate;
  let guard = 0;
  while (due < today && guard < 400) {
    due = advanceDueDate(due, frequency, dayOfMonth);
    guard++;
  }
  return due;
}

/** Amount normalized to a monthly figure (weekly*52/12, biweekly*26/12, yearly/12). */
export function monthlyEquivalent(amount: number, frequency: RecurringFrequency): number {
  switch (frequency) {
    case "weekly": return (amount * 52) / 12;
    case "biweekly": return (amount * 26) / 12;
    case "monthly": return amount;
    case "yearly": return amount / 12;
  }
}

/** Occurrence dates for a rule within the next `days` days (for schedule previews). */
export function upcomingOccurrences(rule: RecurringRule, days: number): string[] {
  const today = todayEST();
  const end = new Date(today + "T12:00:00");
  end.setDate(end.getDate() + days);
  const endStr = fmt(end);
  const out: string[] = [];
  let due = rule.next_due_date;
  let guard = 0;
  while (due <= endStr && guard < 40) {
    if (due >= today) out.push(due);
    due = advanceDueDate(due, rule.frequency, rule.day_of_month);
    guard++;
  }
  return out;
}

export interface AppliedOccurrence {
  rule: RecurringRule;
  date: string;
}

/**
 * Applies every due occurrence of the user's active autopay rules: inserts the
 * expense/income row, adjusts the linked account balance, and advances
 * next_due_date. The advance is an optimistic-lock update (matched on the old
 * next_due_date) so a second open tab can never double-apply an occurrence.
 */
export async function applyDueRecurringRules(userId: string | null): Promise<AppliedOccurrence[]> {
  const supabase = createClient();
  const today = todayEST();

  let q = supabase
    .from("recurring_rules")
    .select("*")
    .eq("active", true)
    .eq("autopay", true)
    .lte("next_due_date", today);
  if (userId) q = q.eq("user_id", userId);
  else q = q.is("user_id", null);

  const { data } = await q;
  const rules = (data as RecurringRule[]) || [];
  const applied: AppliedOccurrence[] = [];

  for (const rule of rules) {
    let due = rule.next_due_date;
    let guard = 0;
    // Each missed period is applied at its own date (capped for safety).
    while (due <= today && guard < 24) {
      guard++;
      const next = advanceDueDate(due, rule.frequency, rule.day_of_month);
      const { data: won } = await supabase
        .from("recurring_rules")
        .update({ next_due_date: next, last_applied_date: due, updated_at: new Date().toISOString() })
        .eq("id", rule.id)
        .eq("next_due_date", due)
        .select("id");
      if (!won || won.length === 0) break; // another tab already applied this occurrence
      await materializeOccurrence(rule, due);
      applied.push({ rule, date: due });
      due = next;
    }
  }
  return applied;
}

async function materializeOccurrence(rule: RecurringRule, date: string) {
  const supabase = createClient();
  const frequency = RULE_FREQ_LABEL[rule.frequency];

  if (rule.kind === "expense") {
    const isCredit = rule.payment_method === "credit" && !!rule.credit_card_id;
    const { error } = await supabase.from("expenses").insert({
      user_id: rule.user_id,
      name: rule.name,
      category: rule.category,
      amount: rule.amount,
      date,
      recurring: true,
      frequency,
      notes: rule.notes || "Auto-added by Recurring",
      payment_method: isCredit ? "credit" : rule.payment_method,
      credit_card_id: isCredit ? rule.credit_card_id : null,
      cash_account_id: isCredit ? null : rule.cash_account_id,
      is_card_payment: false,
      split_group_id: null,
    });
    // Cash-funded expenses debit the linked account; credit charges hit the card balance instead.
    if (!error && !isCredit && rule.cash_account_id) {
      await adjustAccountBalance(rule.cash_account_id, -Number(rule.amount));
    }
  } else {
    const { error } = await supabase.from("income").insert({
      user_id: rule.user_id,
      type: rule.income_type,
      source: rule.name,
      category: rule.category,
      amount: rule.amount,
      date,
      recurring: true,
      frequency,
      notes: rule.notes || "Auto-added by Recurring",
    });
    // Income rules can optionally deposit into a linked account.
    if (!error && rule.cash_account_id) {
      await adjustAccountBalance(rule.cash_account_id, Number(rule.amount));
    }
  }
}
