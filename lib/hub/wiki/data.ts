import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { searchTerm } from "../mail/model";
import type { Node, PageType } from "./model";

// Reads for the Wiki pages. They use the service role, so every function takes the brand id and filters on it: the caller has
// already checked that this person may open the Wiki in this brand.

export type WikiCard = { id: string; slug: string; title: string; summary: string; type: PageType; tags: string[]; ai_readable: boolean; parent_id: string | null; updated_at: string; updated_by: string | null };
export type WikiPage = WikiCard & { body: string; created_at: string; created_by: string | null };
export type WikiVersion = { id: string; title: string; summary: string; body: string; edited_by: string | null; edited_at: string };

const CARD = "id, slug, title, summary, type, tags, ai_readable, parent_id, updated_at, updated_by";
const db = () => createSupabaseAdminClient();

export type Filters = { q?: string; type?: PageType; tag?: string };

/**
 * The pages of a brand for the index. With a search, pages whose title contains the words come first, then pages whose text matches;
 * without one, all pages by title. The type and tag filters apply to both.
 */
export async function listPages(brandId: string, f: Filters = {}): Promise<WikiCard[]> {
  const base = () => {
    let q = db().from("wiki_pages").select(CARD).eq("brand_id", brandId);
    if (f.type) q = q.eq("type", f.type);
    if (f.tag) q = q.contains("tags", [f.tag]);
    return q;
  };
  const term = searchTerm(f.q);
  if (!term) {
    const { data } = await base().order("title").limit(500);
    return (data ?? []) as WikiCard[];
  }
  const [byTitle, byText] = await Promise.all([base().ilike("title", `%${term}%`).order("title").limit(100), base().textSearch("search", term, { type: "websearch", config: "simple" }).limit(100)]);
  const seen = new Set<string>();
  const out: WikiCard[] = [];
  for (const row of [...(byTitle.data ?? []), ...(byText.data ?? [])] as WikiCard[]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

/** Every page as a tree node, for breadcrumbs and the parent menu. */
export async function listNodes(brandId: string): Promise<Node[]> {
  const { data } = await db().from("wiki_pages").select("id, title, slug, parent_id").eq("brand_id", brandId).order("title").limit(2000);
  return (data ?? []) as Node[];
}

/** The tags in use, with how many pages carry each, most used first. */
export async function listTags(brandId: string): Promise<{ tag: string; count: number }[]> {
  const { data } = await db().from("wiki_pages").select("tags").eq("brand_id", brandId).limit(2000);
  const n = new Map<string, number>();
  for (const row of data ?? []) for (const t of (row.tags as string[]) ?? []) n.set(t, (n.get(t) ?? 0) + 1);
  return [...n].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)).slice(0, 30);
}

export async function getPageBySlug(brandId: string, slug: string): Promise<WikiPage | null> {
  const { data } = await db().from("wiki_pages").select(`${CARD}, body, created_at, created_by`).eq("brand_id", brandId).eq("slug", slug).maybeSingle();
  return (data as WikiPage | null) ?? null;
}

export async function listChildren(brandId: string, parentId: string): Promise<WikiCard[]> {
  const { data } = await db().from("wiki_pages").select(CARD).eq("brand_id", brandId).eq("parent_id", parentId).order("title").limit(200);
  return (data ?? []) as WikiCard[];
}

export async function listVersions(brandId: string, pageId: string): Promise<WikiVersion[]> {
  const { data } = await db().from("wiki_versions").select("id, title, summary, body, edited_by, edited_at").eq("brand_id", brandId).eq("page_id", pageId).order("edited_at", { ascending: false }).limit(100);
  return (data ?? []) as WikiVersion[];
}
