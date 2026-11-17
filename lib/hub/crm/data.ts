import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "../db-page";
import { open } from "../field-crypto";
import { LIMITS, closedKeys, isKind, parseRules, parseStages, type Kind, type LogRow, type Person, type StageDef, type StageRule } from "./model";

// Reads for the CRM pages. They use the service role, so every function takes the brand id and filters on it: the caller has
// already checked that this person may open the CRM in this brand.

const db = () => createSupabaseAdminClient();

const COLUMNS = "id, kind, name, company, email, phone, source, stage, value, next_follow_up, summary, tags, converted_at, created_at, updated_at";

export type Note = { id: string; person_id: string; body: string; author_id: string | null; author_label: string; created_at: string };

function normalize(r: Record<string, unknown>, brandId: string): Person | null {
  if (typeof r.id !== "string" || !isKind(r.kind) || typeof r.name !== "string" || typeof r.stage !== "string" || !r.stage) return null;
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
    summary: open(brandId, "crm_people.summary", s(r.summary)),
    tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === "string") : [],
    converted_at: typeof r.converted_at === "string" ? r.converted_at : null,
    created_at: s(r.created_at),
    updated_at: s(r.updated_at),
  };
}

const getWorkflowRow = cache(async (brandId: string) => {
  const { data } = await db().from("crm_workflows").select("stages, rules, updated_by").eq("brand_id", brandId).maybeSingle();
  return data;
});

/** The brand's stages: its own list, or the standard one. Read once per request. */
export const getStages = cache(async (brandId: string): Promise<StageDef[]> => parseStages((await getWorkflowRow(brandId))?.stages));

/** What the brand's stages do when someone enters them, and who last saved the rules (they are the ones who approved the tasks). */
export const getRules = cache(async (brandId: string): Promise<{ rules: StageRule[]; updatedBy: string | null }> => {
  const [row, stages] = await Promise.all([getWorkflowRow(brandId), getStages(brandId)]);
  return { rules: parseRules(row?.rules, stages), updatedBy: typeof row?.updated_by === "string" ? row.updated_by : null };
});

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
    const p = normalize(r as Record<string, unknown>, brandId);
    return p ? [p] : [];
  });
  return { items, total: count ?? items.length };
}

export async function getPerson(brandId: string, id: string): Promise<Person | null> {
  const { data } = await db().from("crm_people").select(COLUMNS).eq("brand_id", brandId).eq("id", id).maybeSingle();
  return data ? normalize(data as Record<string, unknown>, brandId) : null;
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
  return ((data ?? []) as Note[]).map((n) => ({ ...n, body: open(brandId, "crm_notes.body", n.body) }));
}

/** How many open leads and open clients have a follow-up today or earlier. */
export async function countDue(brandId: string, today: string): Promise<{ lead: number; client: number }> {
  // Stage keys are limited to a-z, 0-9, "-" and "_" (and never start with "-"), so they are safe inside the list.
  // "-" stands in when no stage is closed: it can never be a real key.
  const closed = closedKeys(await getStages(brandId));
  const notIn = `(${(closed.length ? closed : ["-"]).join(",")})`;
  const one = async (kind: Kind) => {
    const { count, error } = await db()
      .from("crm_people")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .eq("kind", kind)
      .not("next_follow_up", "is", null)
      .lte("next_follow_up", today)
      .not("stage", "in", notIn);
    if (error) throw new Error(error.message);
    return count ?? 0;
  };
  const [lead, client] = await Promise.all([one("lead"), one("client")]);
  return { lead, client };
}

/** Open leads and clients with a follow-up today or earlier, oldest first (up to `limit`; `total` is how many are due). */
export async function listDue(brandId: string, today: string, limit = 30): Promise<{ items: Person[]; total: number }> {
  const closed = closedKeys(await getStages(brandId));
  const notIn = `(${(closed.length ? closed : ["-"]).join(",")})`; // same rule as countDue
  const { data, count, error } = await db()
    .from("crm_people")
    .select(COLUMNS, { count: "exact" })
    .eq("brand_id", brandId)
    .not("next_follow_up", "is", null)
    .lte("next_follow_up", today)
    .not("stage", "in", notIn)
    .order("next_follow_up", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("[crm] due list failed:", error.message);
    return { items: [], total: 0 };
  }
  const items = (data ?? []).flatMap((r) => {
    const p = normalize(r as Record<string, unknown>, brandId);
    return p ? [p] : [];
  });
  return { items, total: count ?? items.length };
}

/** How many people are in a stage right now. */
export async function countInStage(brandId: string, kind: Kind, stage: string): Promise<number> {
  const { count } = await db().from("crm_people").select("id", { count: "exact", head: true }).eq("brand_id", brandId).eq("kind", kind).eq("stage", stage);
  return count ?? 0;
}

/** Stage changes since `sinceIso` (all of them when null), oldest first, up to 50,000. */
export async function listStageLog(brandId: string, sinceIso: string | null): Promise<LogRow[]> {
  let rows: Record<string, unknown>[];
  try {
    rows = await fetchAll<Record<string, unknown>>((from, to) => {
      let q = db().from("crm_stage_log").select("person_id, kind, from_stage, to_stage, converted, at").eq("brand_id", brandId);
      if (sinceIso) q = q.gte("at", sinceIso);
      return q.order("at", { ascending: true }).order("id", { ascending: true }).range(from, to);
    });
  } catch (e) {
    console.error("[crm] log failed:", e instanceof Error ? e.message : e);
    return [];
  }
  return rows.flatMap((r) => (isKind(r.kind) && typeof r.person_id === "string" && typeof r.to_stage === "string" ? [{ person_id: r.person_id, kind: r.kind, from_stage: typeof r.from_stage === "string" ? r.from_stage : null, to_stage: r.to_stage, converted: r.converted === true, at: String(r.at) }] : []));
}

// ---------------------------------------------------------------------------------------------- searching a big list
// The list, the counts, the export and the bulk changes all ask the database (crm_find and friends), because the API stops at 1,000 rows.

/** What the person typed and picked. `stage`: "" for any, "open" for people still being worked, or a stage key. `tag`: "" for any. */
export type PeopleFilter = { q: string; stage: string; due: boolean; tag: string; importId: string | null; contacts: boolean };
/** `contacts` is whether the search may look inside email and phone: false for anyone who cannot see them, or typing pieces of an address would give it away. */
export const NO_FILTER: PeopleFilter = { q: "", stage: "", due: false, tag: "", importId: null, contacts: false };

async function findArgs(brandId: string, kind: Kind, f: PeopleFilter, today: string) {
  return { p_brand: brandId, p_kind: kind, p_q: f.q, p_stage: f.stage, p_due: f.due, p_tag: f.tag, p_import: f.importId, p_today: today, p_closed: closedKeys(await getStages(brandId)), ...(f.contacts || !f.q ? {} : { p_contacts: false }) };
}

/** One page of the people who match, people to follow up first, then the most recently touched. `total` counts every match, not just this page. */
export async function findPeople(brandId: string, kind: Kind, f: PeopleFilter, today: string, page: number, perPage: number): Promise<{ items: Person[]; total: number }> {
  const from = Math.max(0, (page - 1) * perPage);
  const { data, count, error } = await db()
    .rpc("crm_find", await findArgs(brandId, kind, f, today), { count: "exact" })
    .order("sort_due", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + perPage - 1);
  if (error) {
    console.error("[crm] find failed:", error.message);
    return { items: [], total: 0 };
  }
  const items = ((data ?? []) as Record<string, unknown>[]).flatMap((r) => {
    const p = normalize(r, brandId);
    return p ? [p] : [];
  });
  return { items, total: count ?? items.length };
}

/** The ids of everyone who matches (up to `max`), for a change or an export that applies to the whole result and not one page. */
export async function findIds(brandId: string, kind: Kind, f: PeopleFilter, today: string, max = 20_000): Promise<string[]> {
  const args = await findArgs(brandId, kind, f, today);
  const rows = await fetchAll<{ id: string }>((from, to) => db().rpc("crm_find", args).select("id").order("id", { ascending: true }).range(from, to) as unknown as PromiseLike<{ data: { id: string }[] | null; error: { message: string } | null }>, max);
  return rows.map((r) => r.id);
}

/** Everyone who matches, in the same order as the list, for the export. */
export async function findAll(brandId: string, kind: Kind, f: PeopleFilter, today: string, max = 50_000): Promise<Person[]> {
  const args = await findArgs(brandId, kind, f, today);
  const rows = await fetchAll<Record<string, unknown>>(
    (from, to) =>
      db().rpc("crm_find", args).order("sort_due", { ascending: true, nullsFirst: false }).order("updated_at", { ascending: false }).order("id", { ascending: true }).range(from, to) as unknown as PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>,
    max,
  );
  return rows.flatMap((r) => {
    const p = normalize(r, brandId);
    return p ? [p] : [];
  });
}

export type Summary = { total: number; byStage: Record<string, number>; byStageValue: Record<string, number>; open: number; openValue: number; due: number };

/** Counts over everyone of a kind: how many in each stage, how many are open and worth what, how many need a follow-up today or earlier. */
export async function getSummary(brandId: string, kind: Kind, today: string): Promise<Summary> {
  const { data, error } = await db().rpc("crm_summary", { p_brand: brandId, p_kind: kind, p_closed: closedKeys(await getStages(brandId)), p_today: today });
  const empty: Summary = { total: 0, byStage: {}, byStageValue: {}, open: 0, openValue: 0, due: 0 };
  if (error || !data || typeof data !== "object") {
    if (error) console.error("[crm] summary failed:", error.message);
    return empty;
  }
  const o = data as Record<string, unknown>;
  const byStage: Record<string, number> = {};
  if (o.byStage && typeof o.byStage === "object") for (const [k, v] of Object.entries(o.byStage as Record<string, unknown>)) byStage[k] = Number(v) || 0;
  const byStageValue: Record<string, number> = {};
  if (o.byStageValue && typeof o.byStageValue === "object") for (const [k, v] of Object.entries(o.byStageValue as Record<string, unknown>)) byStageValue[k] = Math.round((Number(v) || 0) * 100) / 100;
  return { total: Number(o.total) || 0, byStage, byStageValue, open: Number(o.open) || 0, openValue: Math.round((Number(o.openValue) || 0) * 100) / 100, due: Number(o.due) || 0 };
}

/** The brand's tags, most used first. */
export async function listTags(brandId: string): Promise<{ tag: string; n: number }[]> {
  const { data, error } = await db().rpc("crm_tags", { p_brand: brandId });
  if (error) {
    console.error("[crm] tags failed:", error.message);
    return [];
  }
  return ((data ?? []) as { tag: unknown; n: unknown }[]).flatMap((r) => (typeof r.tag === "string" ? [{ tag: r.tag, n: Number(r.n) || 0 }] : []));
}

export type ImportRecord = { id: string; kind: Kind; file_name: string; tags: string[]; created_count: number; skipped_count: number; created_at: string; undone_at: string | null };

/** The most recent files imported, newest first. Empty (not an error) before the database update that adds the table. */
export async function listImports(brandId: string, limit = 8): Promise<ImportRecord[]> {
  const { data, error } = await db().from("crm_imports").select("id, kind, file_name, tags, created_count, skipped_count, created_at, undone_at").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(limit);
  if (error) {
    if (error.code !== "42P01") console.error("[crm] imports failed:", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).flatMap((r) =>
    typeof r.id === "string" && isKind(r.kind)
      ? [{ id: r.id, kind: r.kind, file_name: String(r.file_name ?? ""), tags: Array.isArray(r.tags) ? (r.tags as unknown[]).filter((t): t is string => typeof t === "string") : [], created_count: Number(r.created_count) || 0, skipped_count: Number(r.skipped_count) || 0, created_at: String(r.created_at), undone_at: typeof r.undone_at === "string" ? r.undone_at : null }]
      : [],
  );
}
