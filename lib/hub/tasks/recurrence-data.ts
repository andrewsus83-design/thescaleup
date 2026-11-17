import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isPriority } from "./model";
import { REPEAT_COLUMNS, type Recurrence } from "./recurrence-model";
import { REPEAT_MISSING } from "./recurrence-run";

/** The brand's repeating tasks, newest first. `ready` is false until the database step has been run. */
export async function listRepeats(brandId: string): Promise<{ ready: boolean; rows: Recurrence[] }> {
  const { data, error } = await createSupabaseAdminClient().from("task_recurrences").select(REPEAT_COLUMNS).eq("brand_id", brandId).order("created_at", { ascending: false }).limit(200);
  if (error) {
    if (!(error.code && REPEAT_MISSING.has(error.code))) console.error("[repeat] list failed:", error.message);
    return { ready: !(error.code && REPEAT_MISSING.has(error.code)), rows: [] };
  }
  return {
    ready: true,
    rows: (data ?? []).map((r) => ({
      ...(r as unknown as Recurrence),
      priority: isPriority(r.priority) ? r.priority : "normal",
      tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
      items: Array.isArray(r.items) ? (r.items as string[]) : [],
      weekdays: Array.isArray(r.weekdays) ? (r.weekdays as number[]).map(Number) : [],
    })),
  };
}
