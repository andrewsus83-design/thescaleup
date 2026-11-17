"use server";

import { revalidatePath } from "next/cache";
import { atLeast } from "./permissions";
import { UUID, taskContext, type Ctx } from "./tasks/context";
import { ITEM_LIMITS, appendPositions, itemText, splitItems, swapWithNeighbour, type Item } from "./tasks/items";
import { TASK_COLUMNS, type Task } from "./tasks/model";
import { canEditFields, canSeeStage } from "./tasks/rules";

type Result = { ok: true; items: Item[] } | { ok: false; error: string };

const NOT_READY = "Checklists need their database step first (20261117350000_task_items.sql). Ask the person who runs the database updates.";
const fail = (error: string): Result => ({ ok: false, error });
const asId = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);

/**
 * Who may do what with a checklist: changing the list (add, rename, reorder, delete) is for the people who may edit the task's
 * details; ticking is also for an ops person on a task assigned to them. Everyone sees only tasks they could already open.
 */
async function open(brandId: unknown, taskId: unknown, need: "edit" | "tick"): Promise<{ ok: true; ctx: Ctx; task: Task } | { ok: false; error: string }> {
  const c = await taskContext(brandId);
  if (!c.ok) return c;
  const { ctx } = c;
  const id = asId(taskId);
  if (!id) return { ok: false, error: "That task no longer exists." };
  const { data } = await ctx.admin.from("tasks").select(TASK_COLUMNS).eq("brand_id", ctx.brandId).eq("id", id).maybeSingle();
  const task = data as Task | null;
  if (!task || !canSeeStage(ctx.actor, task.stage)) return { ok: false, error: "That task no longer exists." };
  const mayEdit = canEditFields(ctx.who, task);
  const mayTick = mayEdit || (ctx.actor === "ops" && atLeast(ctx.level, "edit") && task.assignee_id === ctx.user.id);
  if (need === "edit" ? !mayEdit : !mayTick) return { ok: false, error: need === "edit" ? "Only the founder or staff can change the checklist." : "You can tick items on tasks assigned to you." };
  return { ok: true, ctx, task };
}

async function current(ctx: Ctx, taskId: string): Promise<{ ok: true; items: Item[] } | { ok: false; error: string }> {
  const { data, error } = await ctx.admin.from("task_items").select("id, body, done, position").eq("brand_id", ctx.brandId).eq("task_id", taskId).order("position").order("created_at").limit(200);
  if (error) {
    if (error.code === "42P01") return { ok: false, error: NOT_READY };
    console.error("[hub] checklist read failed:", error.message);
    return { ok: false, error: "Could not load the checklist. Try again." };
  }
  return { ok: true, items: (data ?? []).map((r) => ({ id: r.id as string, body: String(r.body), done: r.done === true, position: Number(r.position) })) };
}

async function done(ctx: Ctx, taskId: string): Promise<Result> {
  revalidatePath(`/hub/b/${ctx.slug}/tasks`, "layout");
  const r = await current(ctx, taskId);
  return r.ok ? r : fail(r.error);
}

/** One item per line; a pasted "- [ ] step" list works. Up to 100 items in a task. */
export async function addItems(brandId: string, taskId: string, raw: string): Promise<Result> {
  const o = await open(brandId, taskId, "edit");
  if (!o.ok) return fail(o.error);
  const { ctx, task } = o;
  const have = await current(ctx, task.id);
  if (!have.ok) return fail(have.error);
  const parsed = splitItems(typeof raw === "string" ? raw : "", ITEM_LIMITS.perTask - have.items.length);
  if (!parsed.ok) return fail(parsed.error);
  const at = appendPositions(have.items, parsed.items.length);
  const now = new Date().toISOString();
  const { error } = await ctx.admin.from("task_items").insert(parsed.items.map((it, i) => ({ task_id: task.id, brand_id: ctx.brandId, body: it.body, done: it.done, done_by: it.done ? ctx.user.id : null, done_at: it.done ? now : null, position: at[i], created_by: ctx.user.id })));
  if (error) {
    console.error("[hub] addItems failed:", error.message);
    return fail("Could not add the items. Try again.");
  }
  return done(ctx, task.id);
}

export async function toggleItem(brandId: string, taskId: string, itemId: string, on: boolean): Promise<Result> {
  const o = await open(brandId, taskId, "tick");
  if (!o.ok) return fail(o.error);
  const { ctx, task } = o;
  const id = asId(itemId);
  if (!id) return fail("That item no longer exists.");
  const { data, error } = await ctx.admin
    .from("task_items")
    .update(on === true ? { done: true, done_by: ctx.user.id, done_at: new Date().toISOString() } : { done: false, done_by: null, done_at: null })
    .eq("brand_id", ctx.brandId)
    .eq("task_id", task.id)
    .eq("id", id)
    .select("id");
  if (error) {
    console.error("[hub] toggleItem failed:", error.message);
    return fail("Could not save that. Try again.");
  }
  if (!data?.length) return fail("That item no longer exists. Reload the page.");
  return done(ctx, task.id);
}

export async function renameItem(brandId: string, taskId: string, itemId: string, raw: string): Promise<Result> {
  const o = await open(brandId, taskId, "edit");
  if (!o.ok) return fail(o.error);
  const { ctx, task } = o;
  const id = asId(itemId);
  const text = itemText(typeof raw === "string" ? raw : "");
  if (!id) return fail("That item no longer exists.");
  if (!text.ok) return fail(text.error);
  const { data, error } = await ctx.admin.from("task_items").update({ body: text.body }).eq("brand_id", ctx.brandId).eq("task_id", task.id).eq("id", id).select("id");
  if (error) {
    console.error("[hub] renameItem failed:", error.message);
    return fail("Could not save that. Try again.");
  }
  if (!data?.length) return fail("That item no longer exists. Reload the page.");
  return done(ctx, task.id);
}

export async function removeItem(brandId: string, taskId: string, itemId: string): Promise<Result> {
  const o = await open(brandId, taskId, "edit");
  if (!o.ok) return fail(o.error);
  const { ctx, task } = o;
  const id = asId(itemId);
  if (!id) return fail("That item no longer exists.");
  const { error } = await ctx.admin.from("task_items").delete().eq("brand_id", ctx.brandId).eq("task_id", task.id).eq("id", id);
  if (error) {
    console.error("[hub] removeItem failed:", error.message);
    return fail("Could not delete that. Try again.");
  }
  return done(ctx, task.id);
}

export async function moveItem(brandId: string, taskId: string, itemId: string, dir: "up" | "down"): Promise<Result> {
  const o = await open(brandId, taskId, "edit");
  if (!o.ok) return fail(o.error);
  const { ctx, task } = o;
  const id = asId(itemId);
  if (!id || (dir !== "up" && dir !== "down")) return fail("That item no longer exists.");
  const have = await current(ctx, task.id);
  if (!have.ok) return fail(have.error);
  const swap = swapWithNeighbour(have.items, id, dir);
  if (!swap) return { ok: true, items: have.items };
  for (const p of [swap.a, swap.b]) {
    const { error } = await ctx.admin.from("task_items").update({ position: p.position }).eq("brand_id", ctx.brandId).eq("task_id", task.id).eq("id", p.id);
    if (error) {
      console.error("[hub] moveItem failed:", error.message);
      return fail("Could not move that. Try again.");
    }
  }
  return done(ctx, task.id);
}
