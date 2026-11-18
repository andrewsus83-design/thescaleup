import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readProfile, type ProfileValue } from "./model";

// Service role, so every function takes the brand id: the caller has already checked that this person may see the brand.

/** The brand's profile and website, and its version number (used to catch two people saving at once). Null when the brand is gone or the read failed. */
export async function getProfile(brandId: string): Promise<{ value: ProfileValue; version: number; raw: unknown } | null> {
  const { data, error } = await createSupabaseAdminClient().from("brands").select("profile, website, profile_version").eq("id", brandId).maybeSingle();
  if (error || !data) {
    if (error) console.error("[brand-profile] read failed:", error.message);
    return null;
  }
  const version = typeof data.profile_version === "number" ? data.profile_version : 1;
  return { value: readProfile(data.profile, data.website), version, raw: data.profile };
}
