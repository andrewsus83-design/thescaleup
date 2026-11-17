import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isRequestStatus, type Request } from "./model";

const db = () => createSupabaseAdminClient();

export type Index = { pages: number; tasks: number; leads: number; content: number; last: string | null };

/** What an importer has already brought over for a brand, read from import_refs (the index that lets a second run skip it). Null when the table is not there yet. */
export async function indexFor(brandId: string, source: string): Promise<Index | null> {
  const count = async (kind: string) => {
    const r = await db().from("import_refs").select("external_id", { count: "exact", head: true }).eq("brand_id", brandId).eq("source", source).eq("kind", kind);
    return r.error ? null : (r.count ?? 0);
  };
  const [pages, tasks, leads, content, last] = await Promise.all([
    count("doc_page"),
    count("task"),
    count("lead"),
    count("content"),
    db().from("import_refs").select("created_at").eq("brand_id", brandId).eq("source", source).order("created_at", { ascending: false }).limit(1),
  ]);
  if (pages === null || tasks === null || leads === null || content === null) return null;
  const at = (last.data?.[0] as { created_at?: unknown } | undefined)?.created_at;
  return { pages, tasks, leads, content, last: typeof at === "string" ? at : null };
}

/** This brand's requests, newest first. Empty when the table is not there yet. */
export async function listRequests(brandId: string): Promise<Request[]> {
  const { data, error } = await db().from("import_requests").select("id, source, note, status, created_at").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(30);
  if (error) return [];
  return (data ?? []).flatMap((r) => (isRequestStatus(r.status) ? [{ id: String(r.id), source: String(r.source), note: String(r.note ?? ""), status: r.status, created_at: String(r.created_at) }] : []));
}

/** Every brand's open requests, for the agency owner. */
export async function listAllOpenRequests(): Promise<(Request & { brand: string })[]> {
  const { data, error } = await db().from("import_requests").select("id, source, note, status, created_at, brands(name)").eq("status", "open").order("created_at", { ascending: false }).limit(50);
  if (error) return [];
  return (data ?? []).flatMap((r) => {
    if (!isRequestStatus(r.status)) return [];
    const b = (r as unknown as { brands: { name?: unknown } | { name?: unknown }[] | null }).brands;
    const name = Array.isArray(b) ? b[0]?.name : b?.name;
    return [{ id: String(r.id), source: String(r.source), note: String(r.note ?? ""), status: r.status, created_at: String(r.created_at), brand: typeof name === "string" ? name : "A brand" }];
  });
}
