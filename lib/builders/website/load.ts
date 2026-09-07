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
): Promise<{ brand: string; doc: WebsiteDoc | null } | null> {
  if (!isSupabaseAdminConfigured()) return null;
  try {
    const db = createSupabaseAdminClient();
    const [{ data: member }, { data: project }] = await Promise.all([
      db.from("leads").select("business, name").eq("id", memberId).maybeSingle(),
      db
        .from("builder_projects")
        .select("data")
        .eq("member_id", memberId)
        .eq("builder", "website")
        .eq("status", "submitted")
        .maybeSingle(),
    ]);
    if (!member) return null;
    const brand = (member.business as string) || "Website";
    if (!project?.data) return { brand, doc: null };
    return { brand, doc: coerceDoc(project.data, brand) };
  } catch {
    return null;
  }
}
