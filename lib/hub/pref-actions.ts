"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "./actions";
import { getHubUser } from "./session";
import { PHONE_BAR_SLOTS, isTabKey, type TabKey } from "./tabs";

/** Saves the person's own phone menu. It is theirs alone, so no role check: only that they are signed in. */
export async function savePhoneMenu(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getHubUser();
  if (!user) return { error: "Your session ended. Sign in again." };
  const picked: TabKey[] = [];
  for (let i = 1; i <= PHONE_BAR_SLOTS; i++) {
    const v = fd.get(`slot${i}`);
    if (v === null || v === "") continue; // a person with fewer than four menus fills fewer slots
    if (!isTabKey(v)) return { error: "Something in the form was not valid. Reload and try again." };
    if (picked.includes(v)) return { error: "Each menu can only be on the bar once." };
    picked.push(v);
  }
  if (picked.length === 0) return { error: "Pick at least one menu." };
  const { error } = await createSupabaseAdminClient().from("hub_user_prefs").upsert({ user_id: user.id, phone_tabs: picked }, { onConflict: "user_id" });
  if (error) {
    console.error("[hub] savePhoneMenu failed:", error.message);
    return { error: "Could not save. Try again." };
  }
  revalidatePath("/hub", "layout");
  return { message: "Saved." };
}

export async function resetPhoneMenu(): Promise<void> {
  const user = await getHubUser();
  if (!user) return;
  await createSupabaseAdminClient().from("hub_user_prefs").delete().eq("user_id", user.id);
  revalidatePath("/hub", "layout");
}
