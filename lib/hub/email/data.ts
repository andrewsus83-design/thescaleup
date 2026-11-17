import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildRecipients, parseAudience, parseDoc, type Audience, type Doc, type Person, type Recipient, type Skips } from "./model";

// Reads for the campaign pages. They use the service role, so every function takes the brand id and filters on it: the caller has
// already checked that this person may open Mail in this brand.

const db = () => createSupabaseAdminClient();

export type CampaignRow = { id: string; name: string; status: "draft" | "sending" | "sent"; total: number; sent: number; failed: number; created_at: string; sent_at: string | null; updated_at: string };
export type Campaign = CampaignRow & { doc: Doc; address_id: string | null; audience: Audience; consent_at: string | null };
export type TemplateRow = { id: string; name: string; doc: Doc; updated_at: string };

export async function listCampaigns(brandId: string): Promise<CampaignRow[]> {
  const { data } = await db().from("email_campaigns").select("id, name, status, total, sent, failed, created_at, sent_at, updated_at").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(100);
  return (data ?? []) as CampaignRow[];
}

export async function getCampaign(brandId: string, id: string): Promise<Campaign | null> {
  const { data } = await db().from("email_campaigns").select("id, name, status, total, sent, failed, created_at, sent_at, updated_at, doc, address_id, audience, consent_at").eq("brand_id", brandId).eq("id", id).maybeSingle();
  if (!data) return null;
  return { ...(data as unknown as Campaign), doc: parseDoc(data.doc), audience: parseAudience(data.audience) };
}

export async function listTemplates(brandId: string): Promise<TemplateRow[]> {
  const { data } = await db().from("email_templates").select("id, name, doc, updated_at").eq("brand_id", brandId).order("updated_at", { ascending: false }).limit(100);
  return (data ?? []).map((t) => ({ id: t.id as string, name: t.name as string, doc: parseDoc(t.doc), updated_at: t.updated_at as string }));
}

export async function getTemplate(brandId: string, id: string): Promise<TemplateRow | null> {
  const { data } = await db().from("email_templates").select("id, name, doc, updated_at").eq("brand_id", brandId).eq("id", id).maybeSingle();
  return data ? { id: data.id as string, name: data.name as string, doc: parseDoc(data.doc), updated_at: data.updated_at as string } : null;
}

/** The stages the brand's CRM uses, for the audience picker. */
export async function crmStages(brandId: string): Promise<{ lead: string[]; client: string[] }> {
  const { data } = await db().from("crm_people").select("kind, stage").eq("brand_id", brandId).limit(5000);
  const out = { lead: new Set<string>(), client: new Set<string>() };
  for (const r of data ?? []) (r.kind === "client" ? out.client : out.lead).add(r.stage as string);
  return { lead: [...out.lead].sort(), client: [...out.client].sort() };
}

/** Everyone the audience resolves to today, minus people who unsubscribed or bounced. No email is sent here. */
export async function resolveAudience(brandId: string, audience: Audience, max?: number): Promise<{ list: Recipient[]; skips: Skips; matched: number }> {
  if (audience.kinds.length === 0) return { list: [], skips: { noEmail: 0, invalid: 0, duplicate: 0, suppressed: 0, overLimit: 0 }, matched: 0 };
  let q = db().from("crm_people").select("id, email, name, company, kind, stage").eq("brand_id", brandId).in("kind", audience.kinds).neq("email", "").order("created_at").limit(5000);
  if (audience.stages.length) q = q.in("stage", audience.stages);
  const { data } = await q;
  const people: Person[] = (data ?? []).map((p) => ({ id: p.id as string, email: String(p.email ?? ""), name: String(p.name ?? ""), company: String(p.company ?? "") }));
  const emails = [...new Set(people.map((p) => p.email.trim().toLowerCase()).filter(Boolean))];
  const suppressed = new Set<string>();
  for (let i = 0; i < emails.length; i += 400) {
    const { data: rows } = await db().from("email_suppressions").select("email").eq("brand_id", brandId).in("email", emails.slice(i, i + 400));
    for (const r of rows ?? []) suppressed.add(String(r.email));
  }
  const built = buildRecipients(people, suppressed, max);
  return { ...built, matched: people.length };
}

export async function countSuppressed(brandId: string): Promise<number> {
  const { count } = await db().from("email_suppressions").select("email", { count: "exact", head: true }).eq("brand_id", brandId);
  return count ?? 0;
}
