import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Channel, Kind, Status } from "./model";

// Reads for the Content pages. They use the service role, so every function takes the brand id and filters on it: the caller has
// already checked that this person may open Content in this brand.

export type ContentItem = { id: string; title: string; body: string; kind: Kind; channel: Channel | null; status: Status; scheduled_for: string | null; source: "manual" | "ai"; created_at: string; updated_at: string };
export type ContentCard = Omit<ContentItem, "body">;

const CARD = "id, title, kind, channel, status, scheduled_for, source, created_at, updated_at";
const db = () => createSupabaseAdminClient();

/** Everything planned between two days, both included (the calendar grid's first and last cell). */
export async function listPlanned(brandId: string, from: string, to: string): Promise<ContentCard[]> {
  const { data } = await db().from("content_items").select(CARD).eq("brand_id", brandId).gte("scheduled_for", from).lte("scheduled_for", to).order("scheduled_for").order("created_at").limit(500);
  return (data ?? []) as ContentCard[];
}

/** Pieces with no day yet, newest first. */
export async function listUnscheduled(brandId: string, limit = 20): Promise<{ items: ContentCard[]; total: number }> {
  const { data, count } = await db().from("content_items").select(CARD, { count: "exact" }).eq("brand_id", brandId).is("scheduled_for", null).neq("status", "posted").order("created_at", { ascending: false }).limit(limit);
  return { items: (data ?? []) as ContentCard[], total: count ?? 0 };
}

export async function getItem(brandId: string, id: string): Promise<ContentItem | null> {
  const { data } = await db().from("content_items").select(`${CARD}, body`).eq("brand_id", brandId).eq("id", id).maybeSingle();
  return (data as ContentItem | null) ?? null;
}
