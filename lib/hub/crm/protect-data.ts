import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sealReady } from "../field-crypto";

const db = () => createSupabaseAdminClient();

/** How much text in the CRM is still stored as plain text, and whether the server can wrap it. */
export async function protectionStatus(brandId: string): Promise<{ ready: boolean; summaries: number; notes: number; failed: boolean }> {
  const [s, n] = await Promise.all([
    db().from("crm_people").select("id", { count: "exact", head: true }).eq("brand_id", brandId).neq("summary", "").not("summary", "like", "enc:v1:%"),
    db().from("crm_notes").select("id", { count: "exact", head: true }).eq("brand_id", brandId).not("body", "like", "enc:v1:%"),
  ]);
  if (s.error || n.error) console.error("[crm] protection status failed:", s.error?.message ?? n.error?.message);
  return { ready: sealReady(), summaries: s.count ?? 0, notes: n.count ?? 0, failed: Boolean(s.error || n.error) };
}
