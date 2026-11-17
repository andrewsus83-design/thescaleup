import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMode, type LeadForm } from "./forms";

// Reads for the lead forms. Service role: every function filters on the brand, or on the unguessable token for the public page.

const db = () => createSupabaseAdminClient();
const COLUMNS = "id, brand_id, token, name, title, intro, thanks, email_mode, phone_mode, ask_company, ask_message, consent_text, tags, source, enabled, created_by, created_at";

function normalize(r: Record<string, unknown>): LeadForm | null {
  if (typeof r.id !== "string" || typeof r.brand_id !== "string" || typeof r.token !== "string" || !isMode(r.email_mode) || !isMode(r.phone_mode)) return null;
  return {
    id: r.id,
    brand_id: r.brand_id,
    token: r.token,
    name: String(r.name ?? ""),
    title: String(r.title ?? ""),
    intro: String(r.intro ?? ""),
    thanks: String(r.thanks ?? ""),
    email_mode: r.email_mode,
    phone_mode: r.phone_mode,
    ask_company: r.ask_company === true,
    ask_message: r.ask_message === true,
    consent_text: String(r.consent_text ?? ""),
    tags: Array.isArray(r.tags) ? (r.tags as unknown[]).filter((t): t is string => typeof t === "string") : [],
    source: String(r.source ?? ""),
    enabled: r.enabled !== false,
    created_by: typeof r.created_by === "string" ? r.created_by : null,
    created_at: String(r.created_at),
  };
}

/** The brand's forms with how many answers each got in the last 30 days. Empty (not an error) before the database update that adds the table. */
export async function listForms(brandId: string): Promise<(LeadForm & { recent: number })[]> {
  const { data, error } = await db().from("crm_forms").select(COLUMNS).eq("brand_id", brandId).order("created_at", { ascending: false }).limit(50);
  if (error) {
    if (error.code !== "42P01") console.error("[crm] forms failed:", error.message);
    return [];
  }
  const forms = ((data ?? []) as Record<string, unknown>[]).flatMap((r) => {
    const f = normalize(r);
    return f ? [f] : [];
  });
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const counts = await Promise.all(forms.map((f) => db().from("crm_form_entries").select("id", { count: "exact", head: true }).eq("form_id", f.id).gte("created_at", since).then((r) => r.count ?? 0)));
  return forms.map((f, i) => ({ ...f, recent: counts[i] }));
}

export async function getForm(brandId: string, id: string): Promise<LeadForm | null> {
  const { data } = await db().from("crm_forms").select(COLUMNS).eq("brand_id", brandId).eq("id", id).maybeSingle();
  return data ? normalize(data as Record<string, unknown>) : null;
}

/** The public page's lookup: the form, and the brand's name to show on it. Once per request. */
export const getFormByToken = cache(async (token: string): Promise<{ form: LeadForm; brandName: string } | null> => {
  const { data } = await db().from("crm_forms").select(`${COLUMNS}, brands(name, status)`).eq("token", token).maybeSingle();
  if (!data) return null;
  const form = normalize(data as Record<string, unknown>);
  const brand = (data as { brands?: { name?: unknown; status?: unknown } | { name?: unknown; status?: unknown }[] | null }).brands;
  const b = Array.isArray(brand) ? brand[0] : brand;
  if (!form || !b || b.status === "archived") return null;
  return { form, brandName: String(b.name ?? "") };
});

/** Answers a form got since `sinceMs` ago, optionally from one connection. */
export async function recentEntries(formId: string, sinceMs: number, ipHash?: string): Promise<number> {
  let q = db().from("crm_form_entries").select("id", { count: "exact", head: true }).eq("form_id", formId).gte("created_at", new Date(Date.now() - sinceMs).toISOString());
  if (ipHash) q = q.eq("ip_hash", ipHash);
  const { count } = await q;
  return count ?? 0;
}
