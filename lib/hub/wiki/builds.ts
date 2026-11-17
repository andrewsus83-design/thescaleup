import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DRAFT_TAG, SOCIALS, type Draft, type Question, type Sources } from "./build";
import { isType } from "./model";

// Reads for the Wiki builder pages. Service role, so every function takes the brand id and filters on it: the caller has already
// checked that this person may edit the Wiki in this brand.

const db = () => createSupabaseAdminClient();

export type ReadNote = { label: string; url: string; ok: boolean; chars: number; note: string };
export type Build = {
  id: string;
  status: "asking" | "ready";
  sources: Sources;
  read: ReadNote[];
  digest: string;
  questions: Question[];
  answers: Record<string, string>;
  drafts: Draft[];
  created_at: string;
  created_by: string | null;
};

const s = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");

function normalize(r: Record<string, unknown>): Build | null {
  if (typeof r.id !== "string") return null;
  const src = (r.sources && typeof r.sources === "object" ? r.sources : {}) as Record<string, unknown>;
  const social = (Array.isArray(src.social) ? src.social : []).flatMap((x) => {
    const o = x as { id?: unknown; url?: unknown };
    const known = SOCIALS.find((k) => k.id === o?.id);
    return known && typeof o.url === "string" ? [{ id: known.id, url: o.url }] : [];
  });
  const read = (Array.isArray(r.read) ? r.read : []).flatMap((x): ReadNote[] => {
    const o = (x ?? {}) as Record<string, unknown>;
    return typeof o.label === "string" ? [{ label: s(o.label, 80), url: s(o.url, 300), ok: o.ok === true, chars: Number(o.chars) || 0, note: s(o.note, 200) }] : [];
  });
  const questions = (Array.isArray(r.questions) ? r.questions : []).flatMap((x): Question[] => {
    const o = (x ?? {}) as Record<string, unknown>;
    return typeof o.id === "string" && typeof o.q === "string" ? [{ id: s(o.id, 10), q: s(o.q, 240), why: s(o.why, 120) }] : [];
  });
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries((r.answers && typeof r.answers === "object" ? r.answers : {}) as Record<string, unknown>)) if (typeof v === "string") answers[k] = v;
  const drafts = (Array.isArray(r.drafts) ? r.drafts : []).flatMap((x): Draft[] => {
    const o = (x ?? {}) as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.title !== "string" || !isType(o.type)) return [];
    const state = o.state === "added" || o.state === "skipped" ? o.state : "new";
    return [{ id: o.id, title: o.title, type: o.type, summary: s(o.summary, 300), body: s(o.body, 12_000), tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === "string").slice(0, 10) : [DRAFT_TAG], state, slug: typeof o.slug === "string" ? o.slug : undefined }];
  });
  return {
    id: r.id,
    status: r.status === "ready" ? "ready" : "asking",
    sources: { website: typeof src.website === "string" ? src.website : null, social, notes: s(src.notes, 6000) },
    read,
    digest: s(r.digest, 40_000),
    questions,
    answers,
    drafts,
    created_at: s(r.created_at, 40),
    created_by: typeof r.created_by === "string" ? r.created_by : null,
  };
}

const COLUMNS = "id, status, sources, read, digest, questions, answers, drafts, created_at, created_by";

export async function getBuild(brandId: string, id: string): Promise<Build | null> {
  const { data } = await db().from("wiki_builds").select(COLUMNS).eq("brand_id", brandId).eq("id", id).maybeSingle();
  return data ? normalize(data as Record<string, unknown>) : null;
}

/** The brand's earlier builds, newest first, without the long text. */
export async function listBuilds(brandId: string): Promise<{ id: string; status: "asking" | "ready"; created_at: string; website: string | null; total: number; added: number }[]> {
  const { data } = await db().from("wiki_builds").select("id, status, sources, drafts, created_at").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(20);
  return (data ?? []).map((r) => {
    const drafts = Array.isArray(r.drafts) ? (r.drafts as { state?: unknown }[]) : [];
    const src = (r.sources ?? {}) as { website?: unknown };
    return { id: r.id as string, status: r.status === "ready" ? "ready" : "asking", created_at: String(r.created_at), website: typeof src.website === "string" ? src.website : null, total: drafts.length, added: drafts.filter((d) => d?.state === "added").length };
  });
}
