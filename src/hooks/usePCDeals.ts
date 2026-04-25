"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeRefetch } from "@/lib/useRealtimeRefetch";
import type {
  PCDeal,
  PCDealPart,
  PCDealStatus,
  PCDealVerdict,
  PCDealWithParts,
  PCPartCategory,
} from "@/lib/types";

function computeVerdict(margin: number): PCDealVerdict {
  if (margin > 30) return "great";
  if (margin >= 15) return "good";
  if (margin >= 5) return "fair";
  return "skip";
}

export function usePCDeals() {
  const { user } = useAuth();
  const supabase = createClient();
  const [deals, setDeals] = useState<PCDealWithParts[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      let dealsQ = supabase
        .from("pc_deals")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      let partsQ = supabase
        .from("pc_deal_parts")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (!user) {
        dealsQ = dealsQ.is("user_id", null);
        partsQ = partsQ.is("user_id", null);
      }

      const [dealsRes, partsRes] = await Promise.all([dealsQ, partsQ]);
      if (dealsRes.error) console.error("[usePCDeals] deals error:", dealsRes.error);
      if (partsRes.error) console.error("[usePCDeals] parts error:", partsRes.error);

      const rawDeals = (dealsRes.data || []) as PCDeal[];
      const rawParts = (partsRes.data || []) as PCDealPart[];

      const enriched: PCDealWithParts[] = rawDeals.map((d) => {
        const parts = rawParts.filter((p) => p.deal_id === d.id);
        const totalPartsValue = parts.reduce((s, p) => s + Number(p.estimated_value), 0);
        const askingPrice = Number(d.asking_price);
        const potentialProfit = totalPartsValue - askingPrice;
        const profitMargin = askingPrice > 0 ? (potentialProfit / askingPrice) * 100 : 0;
        const verdict = computeVerdict(profitMargin);
        let actualProfit: number | null = null;
        if (d.status === "sold" && d.sold_for != null && d.purchased_price != null) {
          actualProfit =
            Number(d.sold_for) - Number(d.purchased_price) - Number(d.selling_fees ?? 0);
          actualProfit = Math.round(actualProfit * 100) / 100;
        }
        return {
          ...d,
          parts,
          totalPartsValue: Math.round(totalPartsValue * 100) / 100,
          potentialProfit: Math.round(potentialProfit * 100) / 100,
          profitMargin: Math.round(profitMargin * 10) / 10,
          verdict,
          actualProfit,
        };
      });

      setDeals(enriched);
    } catch (err) {
      console.error("[usePCDeals] fetch threw:", err);
      setDeals([]);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);
  useRealtimeRefetch(["pc_deals", "pc_deal_parts"], fetchDeals);

  // ---------- Deal CRUD ----------
  const createDeal = async (data: {
    name: string;
    source?: string | null;
    listing_url?: string | null;
    asking_price: number;
    seller_notes?: string | null;
    condition?: string | null;
    status?: PCDealStatus;
    notes?: string | null;
  }) => {
    const maxOrder =
      deals.length > 0 ? Math.max(...deals.map((d) => d.display_order)) : 0;
    const { data: inserted, error } = await supabase
      .from("pc_deals")
      .insert({
        user_id: user?.id ?? null,
        name: data.name,
        source: data.source ?? null,
        listing_url: data.listing_url ?? null,
        asking_price: data.asking_price,
        seller_notes: data.seller_notes ?? null,
        condition: data.condition ?? "used",
        status: data.status ?? "evaluating",
        selling_fees: 0,
        notes: data.notes ?? null,
        display_order: maxOrder + 1,
      })
      .select()
      .single();
    if (error) console.error("[usePCDeals] createDeal error:", error);
    await fetchDeals();
    return (inserted as PCDeal | null) ?? null;
  };

  const updateDeal = async (id: string, data: Partial<PCDeal>) => {
    const { error } = await supabase.from("pc_deals").update(data).eq("id", id);
    if (error) console.error("[usePCDeals] updateDeal error:", error);
    await fetchDeals();
  };

  const deleteDeal = async (id: string) => {
    const { error } = await supabase.from("pc_deals").delete().eq("id", id);
    if (error) console.error("[usePCDeals] deleteDeal error:", error);
    await fetchDeals();
  };

  // ---------- Part CRUD ----------
  const addPart = async (
    dealId: string,
    data: {
      category: PCPartCategory;
      name: string;
      estimated_value: number;
      condition?: string | null;
      notes?: string | null;
    }
  ) => {
    const deal = deals.find((d) => d.id === dealId);
    const maxOrder = deal && deal.parts.length > 0
      ? Math.max(...deal.parts.map((p) => p.display_order))
      : 0;
    const { data: inserted, error } = await supabase
      .from("pc_deal_parts")
      .insert({
        deal_id: dealId,
        category: data.category,
        name: data.name,
        estimated_value: data.estimated_value,
        condition: data.condition ?? null,
        notes: data.notes ?? null,
        display_order: maxOrder + 1,
      })
      .select()
      .single();
    if (error) console.error("[usePCDeals] addPart error:", error);
    await fetchDeals();
    return (inserted as PCDealPart | null) ?? null;
  };

  const updatePart = async (id: string, data: Partial<PCDealPart>) => {
    const { error } = await supabase.from("pc_deal_parts").update(data).eq("id", id);
    if (error) console.error("[usePCDeals] updatePart error:", error);
    await fetchDeals();
  };

  const deletePart = async (id: string) => {
    const { error } = await supabase.from("pc_deal_parts").delete().eq("id", id);
    if (error) console.error("[usePCDeals] deletePart error:", error);
    await fetchDeals();
  };

  // ---------- Status transitions (with inventory hook) ----------
  // markPurchased also creates an `items` row so the PC shows in Inventory
  // and flows naturally through Sales History when later marked sold.
  const markPurchased = async (
    id: string,
    args: { purchasedPrice: number; purchasedDate: string }
  ) => {
    const deal = deals.find((d) => d.id === id);
    if (!deal) {
      console.error("[usePCDeals] markPurchased: deal not found", id);
      return;
    }

    // Build a description with the parts list so the inventory item
    // captures the breakdown.
    const partsDescription = deal.parts.length > 0
      ? deal.parts.map((p) => `${p.name} ($${Number(p.estimated_value).toFixed(2)})`).join("\n")
      : "";
    const noteParts = [
      `From PC Deal: ${deal.name}`,
      deal.source ? `Source: ${deal.source}` : null,
      deal.listing_url ? `Listing: ${deal.listing_url}` : null,
      partsDescription ? `\nParts:\n${partsDescription}` : null,
      deal.notes,
    ].filter(Boolean).join("\n");

    let inventoryItemId = deal.inventory_item_id;
    try {
      if (inventoryItemId) {
        // Already linked — just update purchase fields
        await supabase.from("items").update({
          purchase_price: args.purchasedPrice,
          purchase_date: args.purchasedDate,
          status: "active",
        }).eq("id", inventoryItemId);
      } else {
        const { data: item, error: itemErr } = await supabase
          .from("items")
          .insert({
            user_id: user?.id ?? null,
            name: deal.name,
            category: "Electronics",
            purchase_price: args.purchasedPrice,
            purchase_date: args.purchasedDate,
            platform_bought: deal.source ?? "Other",
            condition: deal.condition ?? "Used",
            status: "active",
            notes: noteParts || null,
            pc_deal_id: id,
          })
          .select("id")
          .single();
        if (itemErr) {
          console.error("[usePCDeals] markPurchased item insert error:", itemErr);
        } else if (item) {
          inventoryItemId = item.id;
        }
      }
    } catch (err) {
      console.error("[usePCDeals] markPurchased inventory failure:", err);
    }

    await updateDeal(id, {
      status: "purchased",
      purchased_price: args.purchasedPrice,
      purchased_date: args.purchasedDate,
      inventory_item_id: inventoryItemId,
    });
  };

  const markSold = async (
    id: string,
    args: { soldFor: number; soldDate: string; sellingFees?: number }
  ) => {
    const deal = deals.find((d) => d.id === id);
    if (!deal) {
      console.error("[usePCDeals] markSold: deal not found", id);
      return;
    }

    // Update the linked inventory item to mark it sold (so Sales History reflects it)
    if (deal.inventory_item_id) {
      try {
        await supabase.from("items").update({
          status: "sold",
          sale_price: args.soldFor,
          sale_date: args.soldDate,
          fees: args.sellingFees ?? 0,
          platform_sold: deal.source ?? null,
        }).eq("id", deal.inventory_item_id);
      } catch (err) {
        console.error("[usePCDeals] markSold inventory update failure:", err);
      }
    }

    await updateDeal(id, {
      status: "sold",
      sold_for: args.soldFor,
      sold_date: args.soldDate,
      selling_fees: args.sellingFees ?? 0,
    });
  };

  const markRejected = async (id: string) => {
    await updateDeal(id, { status: "rejected" });
  };

  // Reset wipes purchased/sold values; we leave the inventory item alone so the
  // user can clean up manually if they want (avoids accidental data loss).
  const resetToEvaluating = async (id: string) => {
    await updateDeal(id, {
      status: "evaluating",
      purchased_price: null,
      purchased_date: null,
      sold_for: null,
      sold_date: null,
      selling_fees: 0,
    });
  };

  return {
    deals,
    loading,
    refetch: fetchDeals,
    createDeal,
    updateDeal,
    deleteDeal,
    addPart,
    updatePart,
    deletePart,
    markPurchased,
    markSold,
    markRejected,
    resetToEvaluating,
  };
}
