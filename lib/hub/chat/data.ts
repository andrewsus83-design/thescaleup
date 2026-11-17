import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isKind, isPlatform, parseFindings, type AuditItem, type Metrics } from "./model";

const db = () => createSupabaseAdminClient();

export type AuditRow = { id: string; name: string; created_at: string; conversations: number };
export type LinkKey = `${"task" | "crm" | "lead" | "content"}:${string}`;
export type FullItem = AuditItem & { channel: string; created_at: string };

/** The brand's audits, newest first, with how many conversations each holds. Empty when the tables are not there yet. */
export async function listAudits(brandId: string): Promise<{ rows: AuditRow[]; ready: boolean }> {
  const { data, error } = await db().from("chat_audits").select("id, name, created_at").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(50);
  if (error) return { rows: [], ready: !/relation|does not exist|schema cache/i.test(error.message) };
  const ids = (data ?? []).map((a) => a.id as string);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: items } = await db().from("chat_audit_items").select("audit_id").in("audit_id", ids).limit(5000);
    for (const i of items ?? []) counts.set(i.audit_id as string, (counts.get(i.audit_id as string) ?? 0) + 1);
  }
  return { ready: true, rows: (data ?? []).map((a) => ({ id: a.id as string, name: String(a.name), created_at: String(a.created_at), conversations: counts.get(a.id as string) ?? 0 })) };
}

const isMetrics = (m: unknown): m is Metrics => typeof m === "object" && m !== null && typeof (m as Metrics).messages === "number" && Array.isArray((m as Metrics).people) && typeof (m as Metrics).silentDays === "number";

/** One audit with its conversations and what has already been done from them. Null when it is not this brand's. */
export async function getAudit(brandId: string, id: string): Promise<{ audit: { id: string; name: string; created_at: string }; items: FullItem[]; done: Set<LinkKey> } | null> {
  const { data: audit } = await db().from("chat_audits").select("id, name, created_at").eq("brand_id", brandId).eq("id", id).maybeSingle();
  if (!audit) return null;
  const { data: rows } = await db().from("chat_audit_items").select("id, title, platform, channel, kind, metrics, findings, person_id, created_at").eq("audit_id", id).eq("brand_id", brandId).order("created_at").limit(200);
  const items: FullItem[] = (rows ?? []).flatMap((r) => {
    const findings = parseFindings(JSON.stringify(r.findings ?? {}), "0000-01-01"); // already checked on the way in; dates in the past stay
    if (!findings || !isMetrics(r.metrics) || !isPlatform(r.platform) || !isKind(r.kind)) return [];
    return [{ id: r.id as string, title: String(r.title), platform: r.platform, channel: String(r.channel ?? ""), kind: r.kind, metrics: r.metrics, findings, person_id: (r.person_id as string | null) ?? null, created_at: String(r.created_at) }];
  });
  const done = new Set<LinkKey>();
  if (items.length) {
    const { data: ls } = await db().from("chat_audit_links").select("item_id, kind, slot").eq("brand_id", brandId).in("item_id", items.map((i) => i.id)).limit(5000);
    for (const l of ls ?? []) done.add(`${l.kind as "task"}:${l.item_id}:${l.slot}` as LinkKey);
  }
  return { audit: { id: audit.id as string, name: String(audit.name), created_at: String(audit.created_at) }, items, done };
}

export const linkKey = (kind: "task" | "crm" | "lead" | "content", itemId: string, slot: string): LinkKey => `${kind}:${itemId}:${slot}` as LinkKey;
