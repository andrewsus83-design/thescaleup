import "server-only";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStages } from "../crm/data";
import { firstStage, parseTags } from "../crm/model";
import { sealSummary, trySeal } from "../crm/seal";
import { AI_TAG, FIND, leadNote, readBrief, type Brief, type Candidate } from "./model";
import type { FindResult } from "./run";

// What a search writes to the database and what adding to the CRM does, kept apart from sign-in so it can be tested on its own.
// The caller has already checked that this person may change the CRM in this brand.

type Admin = ReturnType<typeof createSupabaseAdminClient>;
export type Found = Extract<FindResult, { ok: true }>;
export type Decided = { ok: true; message: string; created?: number; skipped?: number; importId?: string } | { ok: false; error: string };

const hostOk = (h: string) => /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(h) && h.length <= 253;
const emailOk = (e: string) => /^[a-z0-9._%+-]+@[a-z0-9.-]+$/.test(e) && e.length <= 254;

/**
 * Saves a finished search. Businesses this brand has seen before (added, skipped, or still waiting on an older search) are not shown
 * again; neither are businesses that already have someone in the CRM with an address on their domain, or one of the addresses just
 * read. Returns the search id and how many businesses are new.
 */
export async function saveSearch(admin: Admin, brandId: string, userId: string, brief: Brief, res: Found): Promise<{ id: string; kept: number; known: number; inCrm: number } | null> {
  const hosts = [...new Set(res.found.map((f) => f.host))].filter(hostOk);
  const emails = [...new Set(res.found.flatMap((f) => f.emails))].filter(emailOk);
  const known = new Set<string>();
  if (hosts.length) {
    const { data } = await admin.from("lead_candidates").select("host").eq("brand_id", brandId).in("host", hosts);
    for (const r of data ?? []) known.add(r.host as string);
  }
  const inCrm = new Set<string>();
  const filters = [...hosts.map((h) => `email.ilike.%@${h}`), ...emails.map((e) => `email.eq.${e}`)];
  if (filters.length) {
    const { data } = await admin.from("crm_people").select("email").eq("brand_id", brandId).or(filters.join(",")).limit(300);
    const have = (data ?? []).map((r) => String(r.email ?? "").toLowerCase());
    for (const f of res.found) if (have.some((e) => e.endsWith(`@${f.host}`) || f.emails.includes(e))) inCrm.add(f.host);
  }
  const fresh = res.found.filter((f) => !known.has(f.host) && !inCrm.has(f.host));
  const nKnown = res.found.filter((f) => known.has(f.host)).length;
  const nCrm = res.found.filter((f) => !known.has(f.host) && inCrm.has(f.host)).length;

  const { data: search, error } = await admin
    .from("lead_searches")
    .insert({ brand_id: brandId, brief, found: fresh.length, left_out: { ...res.left, known: nKnown, inCrm: nCrm }, searches_used: res.searches, tokens: res.tokens, created_by: userId })
    .select("id")
    .single();
  if (error || !search) {
    console.error("[leads] save failed:", error?.message);
    return null;
  }
  let kept = 0;
  if (fresh.length) {
    const { data: ins, error: e2 } = await admin
      .from("lead_candidates")
      .upsert(
        fresh.map((f) => ({ search_id: search.id, brand_id: brandId, company: f.company, website: f.website, host: f.host, location: f.location, why: f.why, source_url: f.sourceUrl, emails: f.emails, phones: f.phones, site: f.site })),
        { onConflict: "brand_id,host", ignoreDuplicates: true },
      )
      .select("id");
    if (e2) console.error("[leads] candidates failed:", e2.message);
    kept = ins?.length ?? 0;
    if (kept !== fresh.length) await admin.from("lead_searches").update({ found: kept }).eq("id", search.id);
  }
  return { id: search.id as string, kept, known: nKnown, inCrm: nCrm };
}

/** Adds the chosen businesses to the CRM as leads, tagged "ai-found". The database leaves out anyone already in the CRM, and the import record lets a manager undo it. */
export async function addToCrm(admin: Admin, brandId: string, userId: string, searchId: string, ids: string[]): Promise<Decided> {
  const { data: search } = await admin.from("lead_searches").select("brief").eq("brand_id", brandId).eq("id", searchId).maybeSingle();
  if (!search) return { ok: false, error: "That search no longer exists." };
  const what = readBrief(search.brief).what;
  const { data: rows, error } = await admin.from("lead_candidates").select("id, company, website, why, source_url, emails, phones, site").eq("brand_id", brandId).eq("search_id", searchId).eq("status", "new").in("id", ids);
  if (error) return { ok: false, error: "Could not read the businesses. Try again." };
  if (!rows || rows.length === 0) return { ok: false, error: "Those were already added or skipped. Reload the page." };

  const stages = await getStages(brandId);
  const start = firstStage(stages, "lead");
  const prepared = trySeal(() =>
    rows.map((r) => {
      const emails = Array.isArray(r.emails) ? (r.emails as string[]) : [];
      const phones = Array.isArray(r.phones) ? (r.phones as string[]) : [];
      const note = leadNote({ why: String(r.why ?? ""), website: String(r.website), sourceUrl: String(r.source_url ?? ""), site: r.site as Candidate["site"] }, what);
      return { name: String(r.company), company: String(r.company), email: emails[0] ?? "", phone: phones[0] ?? "", source: "AI finder", value: null, next_follow_up: null, summary: sealSummary(brandId, note), stage: start };
    }),
  );
  if (!prepared.ok) return { ok: false, error: prepared.error };

  const tags = parseTags(AI_TAG);
  const { data: imp, error: e1 } = await admin.from("crm_imports").insert({ brand_id: brandId, kind: "lead", file_name: `AI finder: ${what}`.slice(0, 200), tags, created_by: userId }).select("id").single();
  if (e1 || !imp) {
    console.error("[leads] import record failed:", e1?.message);
    return { ok: false, error: "Could not add them. Try again." };
  }
  const { data, error: e2 } = await admin.rpc("crm_import_chunk", { p_brand: brandId, p_kind: "lead", p_by: userId, p_rows: prepared.value, p_import: imp.id, p_tags: tags });
  if (e2) {
    console.error("[leads] add failed:", e2.code, e2.message);
    await admin.from("crm_imports").delete().eq("id", imp.id);
    return { ok: false, error: "Could not add them. Nothing was added; try again." };
  }
  const row = Array.isArray(data) ? data[0] : data;
  const created = Number(row?.created ?? 0);
  const skipped = Number(row?.skipped ?? 0);
  await admin.from("lead_candidates").update({ status: "added", decided_by: userId, decided_at: new Date().toISOString(), import_id: imp.id }).eq("brand_id", brandId).eq("status", "new").in("id", rows.map((r) => r.id as string));
  const word = (n: number) => `${n} ${n === 1 ? "lead" : "leads"}`;
  return { ok: true, created, skipped, importId: imp.id as string, message: `Added ${word(created)}, tagged ${tags[0] ?? AI_TAG}.${skipped > 0 ? ` ${skipped} ${skipped === 1 ? "was" : "were"} already in your CRM.` : ""} You can undo this from the import history.` };
}

/** Marks businesses as not wanted. With no `ids`, every business still waiting in the search. Returns how many were skipped, or null on an error. */
export async function skipIn(admin: Admin, brandId: string, userId: string, searchId: string, ids: string[] | null): Promise<number | null> {
  let q = admin.from("lead_candidates").update({ status: "skipped", decided_by: userId, decided_at: new Date().toISOString() }).eq("brand_id", brandId).eq("search_id", searchId).eq("status", "new");
  if (ids) q = q.in("id", ids);
  const { data, error } = await q.select("id");
  if (error) {
    console.error("[leads] skip failed:", error.message);
    return null;
  }
  return data?.length ?? 0;
}

export const MAX_PICK = FIND.addMax;
