import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { addDays, hubTz, todayIn } from "./dates";
import { getWorkflow } from "./data";
import { latestOn, madeTags, REPEAT_COLUMNS, type Recurrence } from "./recurrence-model";
import { startStatus, statusForStage } from "./rules";
import { isPriority } from "./model";

// Makes the tasks that repeating recipes owe. Called from the daily cron and, so it also works with no cron set up, whenever the Tasks page
// opens. Calling it often is safe: a recipe only ever makes the latest day it owes (a week of missed days makes one task, not seven), it
// remembers that day in last_made_on, and the database refuses a second task for the same recipe and day.

/** The table or a column is not there yet: the database step has not been run. PostgREST words it either way depending on its version. */
export const REPEAT_MISSING = new Set(["42P01", "42703", "PGRST205", "PGRST204"]);

export type MadeResult = { ready: boolean; checked: number; made: number; failed: number };

const norm = (r: Record<string, unknown>): Recurrence => ({
  ...(r as unknown as Recurrence),
  priority: isPriority(r.priority) ? r.priority : "normal",
  tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
  items: Array.isArray(r.items) ? (r.items as string[]) : [],
  weekdays: Array.isArray(r.weekdays) ? (r.weekdays as number[]).map(Number) : [],
});

/** Makes what is owed today for one brand, or for every brand when `brandId` is left out. Never throws: the page and the cron carry on. */
export async function makeDueTasks(opts: { brandId?: string; today?: string } = {}): Promise<MadeResult> {
  const out: MadeResult = { ready: true, checked: 0, made: 0, failed: 0 };
  try {
    const admin = createSupabaseAdminClient();
    const today = opts.today ?? todayIn(hubTz());
    let q = admin
      .from("task_recurrences")
      .select(REPEAT_COLUMNS)
      .eq("active", true)
      .lte("starts_on", today)
      .or(`last_made_on.is.null,last_made_on.lt.${today}`)
      .order("created_at")
      .limit(1000);
    if (opts.brandId) q = q.eq("brand_id", opts.brandId);
    const { data, error } = await q;
    if (error) {
      if (error.code && REPEAT_MISSING.has(error.code)) return { ...out, ready: false };
      console.error("[repeat] read failed:", error.message);
      return { ...out, failed: 1 };
    }

    // Only recipes that owe a day newer than the one they last made.
    const owed: { r: Recurrence; day: string }[] = [];
    for (const row of data ?? []) {
      const r = norm(row);
      out.checked++;
      const day = latestOn(r, today);
      if (day && (!r.last_made_on || day > r.last_made_on)) owed.push({ r, day });
    }
    if (owed.length === 0) return out;

    const brandIds = [...new Set(owed.map((o) => o.r.brand_id))];
    const { data: brands } = await admin.from("brands").select("id, status").in("id", brandIds);
    const live = new Set((brands ?? []).filter((b) => b.status !== "archived").map((b) => b.id as string));

    for (const brandId of brandIds) {
      if (!live.has(brandId)) continue;
      const mine = owed.filter((o) => o.r.brand_id === brandId);
      const workflow = await getWorkflow(brandId);
      // The manager who set the recipe up approved what it makes, so it goes straight onto the board when the workflow has an active status.
      const active = statusForStage(workflow, "active");
      const start = active ? { status: active, stage: "active" as const } : startStatus(workflow, "founder");
      if (!start) {
        out.failed += mine.length;
        continue;
      }
      // A person who left the team must not keep getting work.
      const assignees = [...new Set(mine.map((o) => o.r.assignee_id).filter((v): v is string => !!v))];
      const members = new Set<string>();
      if (assignees.length) {
        const { data: ms } = await admin.from("brand_members").select("user_id").eq("brand_id", brandId).in("user_id", assignees);
        for (const m of ms ?? []) members.add(m.user_id as string);
      }

      for (const { r, day } of mine) {
        const now = new Date().toISOString();
        const { data: made, error: insErr } = await admin
          .from("tasks")
          .insert({
            brand_id: brandId,
            title: r.title,
            description: r.description,
            priority: r.priority,
            assignee_id: r.assignee_id && members.has(r.assignee_id) ? r.assignee_id : null,
            due_date: addDays(day, r.due_in_days),
            tags: madeTags(r.tags),
            status: start.status,
            source: "automation",
            created_by: r.created_by,
            recurrence_id: r.id,
            occurs_on: day,
            ...(start.stage === "proposed" ? {} : { approved_by: r.created_by, approved_at: now }),
          })
          .select("id")
          .single();

        if (insErr) {
          // 23505: another request made this day's task a moment ago. That is the same as success.
          if (insErr.code !== "23505") {
            console.error("[repeat] could not make a task:", insErr.message);
            out.failed++;
            continue;
          }
        } else if (made) {
          out.made++;
          if (r.items.length) {
            const { error: itemErr } = await admin.from("task_items").insert(
              r.items.map((body, i) => ({ task_id: made.id as string, brand_id: brandId, body, position: i + 1, created_by: r.created_by })),
            );
            if (itemErr) console.error("[repeat] could not add the checklist:", itemErr.message);
          }
        }
        const { error: markErr } = await admin.from("task_recurrences").update({ last_made_on: day }).eq("id", r.id).eq("brand_id", brandId);
        if (markErr) console.error("[repeat] could not note the day:", markErr.message);
      }
    }
    return out;
  } catch (e) {
    console.error("[repeat] run failed:", e instanceof Error ? e.message : e);
    return { ...out, failed: out.failed + 1 };
  }
}
