import { createClient } from "@/lib/supabase/client";

/**
 * Adjusts the balance of a specific cash account by ID.
 * Positive amount = deposit, negative = withdrawal.
 */
export async function adjustAccountBalance(accountId: string, amount: number) {
  const supabase = createClient();
  const { data } = await supabase.from("cash_accounts").select("balance").eq("id", accountId).single();
  if (!data) return;
  const newBalance = Number(data.balance) + amount;
  await supabase.from("cash_accounts").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("id", accountId);
}

/**
 * Adjusts the balance of the user's first checking account.
 * Fallback for flows that don't have an account picker.
 */
export async function adjustCheckingBalance(userId: string | null, amount: number) {
  const supabase = createClient();
  let query = supabase.from("cash_accounts").select("id, balance").eq("type", "checking").order("display_order", { ascending: true }).limit(1);
  if (userId) query = query.eq("user_id", userId);
  else query = query.is("user_id", null);
  const { data } = await query;
  if (!data || data.length === 0) return;
  const newBalance = Number(data[0].balance) + amount;
  await supabase.from("cash_accounts").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("id", data[0].id);
}
