import "server-only";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { coerceDoc, type WebsiteDoc } from "./schema";

/** Load a member's PUBLISHED website. Returns null if member/db missing;
 *  { brand, doc: null } when there is no published site yet. */
export async function loadSite(
  memberId: string,
  opts?: { allowDraft?: boolean },
): Promise<{ brand: string; doc: WebsiteDoc | null } | null> {
  if (!isSupabaseAdminConfigured()) return null;
  try {
    const db = createSupabaseAdminClient();
    const [{ data: member }, { data: project }] = await Promise.all([
      db.from("leads").select("business, name").eq("id", memberId).maybeSingle(),
      db
        .from("builder_projects")
        .select("data, status")
        .eq("member_id", memberId)
        .eq("builder", "website")
        .maybeSingle(),
    ]);
    if (!member) return null;
    const brand = (member.business as string) || "Website";
    const data = project?.data as (Record<string, unknown> & { published?: unknown }) | undefined;
    if (!data) return { brand, doc: null };

    // Preview (admin) = the working copy. Public = the published snapshot
    // (data.published), so unpublished edits never leak; falls back to the
    // whole doc for legacy rows saved as "submitted" before snapshots existed.
    if (opts?.allowDraft) return { brand, doc: coerceDoc(data, brand) };
    if (data.published) return { brand, doc: coerceDoc(data.published, brand) };
    if (project?.status === "submitted") return { brand, doc: coerceDoc(data, brand) };
    return { brand, doc: null };
  } catch {
    return null;
  }
}
