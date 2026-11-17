import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LIMITS, isKind, isStageFor, type Kind, type Person } from "./model";

// Reads for the CRM pages. They use the service role, so every function takes the brand id and filters on it: the caller has
// already checked that this person may open the CRM in this brand.

const db = () => createSupabaseAdminClient();

const COLUMNS = "id, kind, name, company, email, phone, source, stage, value, next_follow_up, summary, converted_at, created_at, updated_at";

export type Note = { id: string; person_id: string; body: string; author_id: string | null; author_label: string; created_at: string };

function normalize(r: Record<string, unknown>): Person | null {
  if (typeof r.id !== "string" || !isKind(r.kind) || typeof r.name !== "string" || !isStageFor(r.kind, r.stage)) return null;
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  const value = r.value === null || r.value === undefined ? null : Number(r.value);
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    company: s(r.company),
    email: s(r.email),
    phone: s(r.phone),
    source: s(r.source),
    stage: r.stage,
    value: value !== null && Number.isFinite(value) ? value : null,
    next_follow_up: typeof r.next_follow_up === "string" ? r.next_follow_up : null,
    summary: s(r.summary),
    converted_at: typeof r.converted_at === "string" ? r.converted_at : null,
    created_at: s(r.created_at),
    updated_at: s(r.updated_at),
  };
}

/** The brand's leads or clients, most recently touched first (up to `limit`; `total` is how many exist). */
export async function listPeople(brandId: string, kind: Kind, limit: number = LIMITS.list): Promise<{ items: Person[]; total: number }> {
  const { data, count, error } = await db()
    .from("crm_people")
    .select(COLUMNS, { count: "exact" })
    .eq("brand_id", brandId)
    .eq("kind", kind)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[crm] list failed:", error.message);
    return { items: [], total: 0 };
  }
  const items = (data ?? []).flatMap((r) => {
    const p = normalize(r as Record<string, unknown>);
    return p ? [p] : [];
  });
  return { items, total: count ?? items.length };
}

export async function getPerson(brandId: string, id: string): Promise<Person | null> {
  const { data } = await db().from("crm_people").select(COLUMNS).eq("brand_id", brandId).eq("id", id).maybeSingle();
  return data ? normalize(data as Record<string, unknown>) : null;
}

export async function listNotes(brandId: string, personId: string): Promise<Note[]> {
  const { data, error } = await db()
    .from("crm_notes")
    .select("id, person_id, body, author_id, author_label, created_at")
    .eq("brand_id", brandId)
    .eq("person_id", personId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[crm] notes failed:", error.message);
    return [];
  }
  return (data ?? []) as Note[];
}

/** How many open leads and open clients have a follow-up today or earlier. */
export async function countDue(brandId: string, today: string): Promise<{ lead: number; client: number }> {
  const one = async (kind: Kind) => {
    const { count, error } = await db()
      .from("crm_people")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .eq("kind", kind)
      .not("next_follow_up", "is", null)
      .lte("next_follow_up", today)
      .not("stage", "in", "(lost,churned)");
    if (error) throw new Error(error.message);
    return count ?? 0;
  };
  const [lead, client] = await Promise.all([one("lead"), one("client")]);
  return { lead, client };
}
