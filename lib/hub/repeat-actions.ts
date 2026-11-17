"use server";

import { revalidatePath } from "next/cache";
import { allow } from "./ratelimit";
import { audit } from "./session";
import { getWorkflow, listMembers } from "./tasks/data";
import { addDays, hubTz, todayIn } from "./tasks/dates";
import { parseRepeat, REPEAT_LIMITS } from "./tasks/recurrence-model";
import { REPEAT_MISSING, makeDueTasks } from "./tasks/recurrence-run";
import { canRepeat } from "./tasks/rules";
import { UUID, taskContext, type Ctx } from "./tasks/context";

// Repeating tasks: set one up, change it, pause it, delete it. What a recipe makes goes straight onto the board, so only people who
// may set one up (see canRepeat) can change them. Tasks it already made are ordinary tasks and stay when the recipe is deleted.

type Done<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const refresh = (slug: string) => revalidatePath(`/hub/b/${slug}/tasks`, "layout");
const NOT_READY = "Repeating tasks need their database step first (20261117420000_recurring_tasks.sql). Ask the person who runs the database updates.";
const NOT_ALLOWED = "Only the founder can set up repeating tasks in this brand.";

async function access(brandId: unknown): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const c = await taskContext(brandId);
  if (!c.ok) return c;
  if (!canRepeat(c.ctx.who, await getWorkflow(c.ctx.brandId))) return fail(NOT_ALLOWED);
  if (!allow(`repeat:${c.ctx.user.id}`, 120)) return fail("Too many changes in a short time. Wait a few minutes.");
  return c;
}

export async function saveRepeat(input: { brandId: string; id?: string } & Record<string, unknown>): Promise<Done<{ id: string; made: number }>> {
  const c = await access(input.brandId);
  if (!c.ok) return c;
  const { ctx } = c;
  const members = await listMembers(ctx.brandId);
  const today = todayIn(hubTz());
  const v = parseRepeat(input, new Set(members.map((m) => m.userId)), today);
  if (!v.ok) return v;

  let id = input.id;
  if (id) {
    if (!UUID.test(id)) return fail("Unknown repeating task.");
    const { data, error } = await ctx.admin.from("task_recurrences").update(v.value).eq("brand_id", ctx.brandId).eq("id", id).select("id");
    if (error) return fail(error.code && REPEAT_MISSING.has(error.code) ? NOT_READY : "Could not save. Try again.");
    if (!data?.length) return fail("Unknown repeating task.");
  } else {
    const { count, error: cErr } = await ctx.admin.from("task_recurrences").select("id", { count: "exact", head: true }).eq("brand_id", ctx.brandId);
    if (cErr) return fail(cErr.code && REPEAT_MISSING.has(cErr.code) ? NOT_READY : "Could not save. Try again.");
    if ((count ?? 0) >= REPEAT_LIMITS.perBrand) return fail(`A brand can have up to ${REPEAT_LIMITS.perBrand} repeating tasks. Delete one you no longer use.`);
    const { data, error } = await ctx.admin.from("task_recurrences").insert({ ...v.value, brand_id: ctx.brandId, created_by: ctx.user.id, last_made_on: addDays(today, -1) }).select("id").single();
    if (error || !data) return fail(error?.code && REPEAT_MISSING.has(error.code) ? NOT_READY : "Could not save. Try again.");
    id = data.id as string;
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: input.id ? "task.repeat.update" : "task.repeat.create", target: id, meta: { title: v.value.title.slice(0, 80), freq: v.value.freq, every: v.value.every } });

  // A new recipe never makes tasks for days before today (last_made_on starts at yesterday). If today is one of its days, the first task appears now.
  const run = await makeDueTasks({ brandId: ctx.brandId });
  refresh(ctx.slug);
  return { ok: true, id: id as string, made: run.made };
}

export async function setRepeatActive(brandId: string, id: string, active: boolean): Promise<Done<{ made: number }>> {
  const c = await access(brandId);
  if (!c.ok) return c;
  const { ctx } = c;
  if (!UUID.test(id)) return fail("Unknown repeating task.");
  const { data: row, error: readErr } = await ctx.admin.from("task_recurrences").select("last_made_on").eq("brand_id", ctx.brandId).eq("id", id).maybeSingle();
  if (readErr) return fail(readErr.code && REPEAT_MISSING.has(readErr.code) ? NOT_READY : "Could not change it. Try again.");
  if (!row) return fail("Unknown repeating task.");
  // Resuming does not make up for the days it was paused: nothing before today is made, only today's task if today is one of its days.
  const yesterday = addDays(todayIn(hubTz()), -1);
  const last = row.last_made_on as string | null;
  const patch = active && (!last || last < yesterday) ? { active, last_made_on: yesterday } : { active };
  const { data, error } = await ctx.admin.from("task_recurrences").update(patch).eq("brand_id", ctx.brandId).eq("id", id).select("id");
  if (error || !data?.length) return fail("Could not change it. Try again.");
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: active ? "task.repeat.resume" : "task.repeat.pause", target: id });
  const run = active ? await makeDueTasks({ brandId: ctx.brandId }) : { made: 0 };
  refresh(ctx.slug);
  return { ok: true, made: run.made };
}

export async function deleteRepeat(brandId: string, id: string): Promise<Done> {
  const c = await access(brandId);
  if (!c.ok) return c;
  const { ctx } = c;
  if (!UUID.test(id)) return fail("Unknown repeating task.");
  const { data, error } = await ctx.admin.from("task_recurrences").delete().eq("brand_id", ctx.brandId).eq("id", id).select("id, title");
  if (error || !data?.length) return fail(error?.code && REPEAT_MISSING.has(error.code) ? NOT_READY : "Could not delete it. Try again.");
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "task.repeat.delete", target: id, meta: { title: String(data[0].title).slice(0, 80) } });
  refresh(ctx.slug);
  return { ok: true };
}
