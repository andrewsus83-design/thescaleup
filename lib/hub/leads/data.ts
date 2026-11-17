import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readBrief, type Brief, type Candidate, type SiteState } from "./model";

// Reads for the leads finder pages. They use the service role, so every function takes the brand id and filters on it: the caller has
// already checked that this person may open the CRM in this brand.

const db = () => createSupabaseAdminClient();

export const LEADS_MISSING = "42P01"; // Postgres: the table does not exist yet (the database step has not been run)

export type SearchRow = { id: string; brief: Brief; found: number; fresh: number; added: number; created_at: string };
export type Search = { id: string; brief: Brief; found: number; left: { notBusiness: number; repeated: number; missing: number; known: number; inCrm: number }; searches: number; created_at: string };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** The brand's recent searches. `ready` is false until the database step has been run. */
export async function listSearches(brandId: string, limit = 10): Promise<{ ready: boolean; rows: SearchRow[] }> {
  const { data, error } = await db().from("lead_searches").select("id, brief, found, created_at").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(limit);
  if (error) return { ready: error.code !== LEADS_MISSING, rows: [] };
  const ids = (data ?? []).map((r) => r.id as string);
  const counts = new Map<string, { fresh: number; added: number }>();
  if (ids.length) {
    const { data: cs } = await db().from("lead_candidates").select("search_id, status").eq("brand_id", brandId).in("search_id", ids).limit(2000);
    for (const c of cs ?? []) {
      const e = counts.get(c.search_id as string) ?? { fresh: 0, added: 0 };
      if (c.status === "new") e.fresh++;
      if (c.status === "added") e.added++;
      counts.set(c.search_id as string, e);
    }
  }
  return {
    ready: true,
    rows: (data ?? []).map((r) => ({ id: r.id as string, brief: readBrief(r.brief), found: num(r.found), fresh: counts.get(r.id as string)?.fresh ?? 0, added: counts.get(r.id as string)?.added ?? 0, created_at: r.created_at as string })),
  };
}

const SITES: SiteState[] = ["ok", "unreadable", "mismatch"];
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** One search with every business it found. null when it is not this brand's. */
export async function getSearch(brandId: string, id: string): Promise<{ search: Search; candidates: Candidate[] } | null> {
  const { data: s, error } = await db().from("lead_searches").select("id, brief, found, left_out, searches_used, created_at").eq("brand_id", brandId).eq("id", id).maybeSingle();
  if (error || !s) return null;
  const { data: rows } = await db().from("lead_candidates").select("id, company, website, host, location, why, source_url, emails, phones, site, status").eq("brand_id", brandId).eq("search_id", id).order("created_at", { ascending: true }).limit(100);
  const left = (s.left_out && typeof s.left_out === "object" ? s.left_out : {}) as Record<string, unknown>;
  const candidates: Candidate[] = (rows ?? []).flatMap((r) => {
    if (typeof r.id !== "string" || typeof r.company !== "string" || typeof r.website !== "string" || typeof r.host !== "string") return [];
    const status = r.status === "added" || r.status === "skipped" ? r.status : "new";
    return [
      {
        id: r.id,
        company: r.company,
        website: r.website,
        host: r.host,
        location: typeof r.location === "string" ? r.location : "",
        why: typeof r.why === "string" ? r.why : "",
        sourceUrl: typeof r.source_url === "string" ? r.source_url : "",
        emails: strs(r.emails),
        phones: strs(r.phones),
        site: SITES.includes(r.site as SiteState) ? (r.site as SiteState) : "unreadable",
        status,
      },
    ];
  });
  return {
    search: {
      id: s.id as string,
      brief: readBrief(s.brief),
      found: num(s.found),
      left: { notBusiness: num(left.notBusiness), repeated: num(left.repeated), missing: num(left.missing), known: num(left.known), inCrm: num(left.inCrm) },
      searches: num(s.searches_used),
      created_at: s.created_at as string,
    },
    candidates,
  };
}
