import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isTabKey, type TabKey } from "./tabs";

/** The four menus this person put on their phone's bottom bar, or null when they never chose. */
export const getPhoneTabs = cache(async (userId: string): Promise<TabKey[] | null> => {
  const { data } = await createSupabaseAdminClient().from("hub_user_prefs").select("phone_tabs").eq("user_id", userId).maybeSingle();
  if (!data || !Array.isArray(data.phone_tabs) || data.phone_tabs.length === 0) return null;
  return data.phone_tabs.filter(isTabKey);
});
