"use server";

import { revalidatePath } from "next/cache";
import { getClientMember } from "@/lib/client/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PLAN_ITEM_STATUSES } from "@/lib/admin/plan-status";

const PLAN_STATUSES = PLAN_ITEM_STATUSES.map((s) => s.value) as string[];

/** Client moves one of their own plan items to a new status. */
export async function clientUpdatePlanItem(itemId: string, status: string) {
  const m = await getClientMember();
  if (!m || !PLAN_STATUSES.includes(status)) return;
  const db = createSupabaseAdminClient();
  await db
    .from("plan_items")
    .update({ status })
    .eq("id", itemId)
    .eq("member_id", m.id);
  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard");
}

export async function clientToggleReminder(id: string, done: boolean) {
  const m = await getClientMember();
  if (!m) return;
  const db = createSupabaseAdminClient();
  await db
    .from("reminders")
    .update({ done })
    .eq("id", id)
    .eq("member_id", m.id);
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
}

export async function clientAddTodo(formData: FormData) {
  const m = await getClientMember();
  if (!m) return;
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const db = createSupabaseAdminClient();
  await db.from("reminders").insert({
    member_id: m.id,
    title,
    due_date: (formData.get("due_date") as string) || null,
    audience: "client",
  });
  revalidatePath("/dashboard/calendar");
}

/** Client asks the team to refresh/recycle their plan — surfaces to admin. */
export async function clientRequestUpdate() {
  const m = await getClientMember();
  if (!m) return;
  const db = createSupabaseAdminClient();
  await db.from("reminders").insert({
    member_id: m.id,
    title: `Permintaan update plan dari ${m.business}`,
    audience: "admin",
  });
  revalidatePath("/dashboard");
}
