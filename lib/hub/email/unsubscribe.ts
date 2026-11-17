import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { unsubscribeKey } from "./secret";
import { verifyUnsubscribe } from "./token";

/** The brand and address a signed link is for, and the brand's name. null when the link is not one of ours. */
export async function readUnsubscribeLink(token: string): Promise<{ brandId: string; email: string; brand: string } | null> {
  const key = unsubscribeKey();
  if (!key) return null;
  const v = verifyUnsubscribe(key, token);
  if (!v) return null;
  const { data } = await createSupabaseAdminClient().from("brands").select("name").eq("id", v.brandId).maybeSingle();
  if (!data) return null;
  return { ...v, brand: String(data.name ?? "this brand") };
}

/** Stops all email from the brand to that address. Safe to call twice; an earlier bounce or complaint is kept as it was. */
export async function unsubscribe(token: string): Promise<boolean> {
  const link = await readUnsubscribeLink(token);
  if (!link) return false;
  const { error } = await createSupabaseAdminClient().from("email_suppressions").upsert({ brand_id: link.brandId, email: link.email, reason: "unsubscribed" }, { onConflict: "brand_id,email", ignoreDuplicates: true });
  if (error) console.error("[email] unsubscribe failed:", error.message);
  return !error;
}
