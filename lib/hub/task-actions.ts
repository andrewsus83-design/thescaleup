"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "./actions";
import { audit } from "./session";
import { UUID, str, taskContext, type Ctx } from "./tasks/context";
import { getWorkflow, listMembers } from "./tasks/data";
import { TASK_COLUMNS, type Stage, type Task, type Workflow } from "./tasks/model";
import { LIMITS, canComment, canCreate, canDecide, canDelete, canEditFields, canMoveToStage, canSeeStage, startStatus, statusForStage, validateTaskInput } from "./tasks/rules";

const refresh = (slug: string) => revalidatePath(`/hub/b/${slug}`, "layout");

async function loadTask(ctx: Ctx, taskId: unknown): Promise<Task | null> {
  if (typeof taskId !== "string" || !UUID.test(taskId)) return null;
  const { data } = await ctx.admin.from("tasks").select(TASK_COLUMNS).eq("brand_id", ctx.brandId).eq("id", taskId).maybeSingle();
  return (data as Task | null) ?? null;
}

/** Approval fields follow the stage, like the database trigger does for browser sessions (the service role has to do it itself). */
function approvalPatch(from: Stage, to: Stage, userId: string): Record<string, unknown> {
  if (to === "proposed" || to === "rejected") return { approved_by: null, approved_at: null };
  if (from === "proposed" || from === "rejected") return { approved_by: userId, approved_at: new Date().toISOString() };
  return {};
}

/** Works out the update for a move to `statusKey`, or says why it is not allowed. */
function planMove(ctx: Ctx, task: Task, workflow: Workflow, statusKey: string): { ok: true; patch: Record<string, unknown> } | { ok: false; error: string } {
  const target = workflow.statuses.find((s) => s.key === statusKey);
  if (!target) return { ok: false, error: "That status does not exist in this brand's workflow." };
  if (!canMoveToStage(ctx.who, task, target.stage)) return { ok: false, error: "You cannot move this task there." };
  return { ok: true, patch: { status: statusKey, ...approvalPatch(task.stage, target.stage, ctx.user.id) } };
}

// ---------------------------------------------------------------------------------------------- create
export async function createTask(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await taskContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  if (!canCreate(ctx.who)) return { error: "You cannot add tasks in this brand." };

  const [members, workflow] = await Promise.all([listMembers(ctx.brandId), getWorkflow(ctx.brandId)]);
  const raw = Object.fromEntries(["title", "description", "assigneeId", "dueDate", "startDate", "priority", "tags"].map((k) => [k, str(fd, k)]));
  const v = validateTaskInput(raw, new Set(members.map((m) => m.userId)));
  if (!v.ok) return { error: v.error };

  const start = startStatus(workflow, ctx.actor);
  if (!start) return { error: "This brand's workflow has no status to start in. Check Settings." };

  const { error } = await ctx.admin.from("tasks").insert({
    brand_id: ctx.brandId,
    ...v.value,
    status: start.status,
    source: "manual",
    created_by: ctx.user.id,
    ...(start.stage === "proposed" ? {} : { approved_by: ctx.user.id, approved_at: new Date().toISOString() }),
  });
  if (error) {
    console.error("[hub] createTask failed:", error.message);
    return { error: "Could not add the task. Try again." };
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "task.create", target: v.value.title.slice(0, 80), meta: { stage: start.stage } });
  refresh(ctx.slug);
  return { message: start.stage === "proposed" ? "Added. It waits for the founder's approval." : "Task added." };
}

// ---------------------------------------------------------------------------------------------- update
export async function updateTask(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await taskContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const task = await loadTask(ctx, str(fd, "taskId"));
  if (!task || !canSeeStage(ctx.actor, task.stage)) return { error: "That task no longer exists." };

  const patch: Record<string, unknown> = {};
  if (canEditFields(ctx.who, task)) {
    const members = await listMembers(ctx.brandId);
    const raw = Object.fromEntries(["title", "description", "assigneeId", "dueDate", "startDate", "priority", "tags"].map((k) => [k, str(fd, k)]));
    const v = validateTaskInput(raw, new Set(members.map((m) => m.userId)));
    if (!v.ok) return { error: v.error };
    Object.assign(patch, v.value);
  }

  const status = str(fd, "status");
  if (status && status !== task.status) {
    const move = planMove(ctx, task, await getWorkflow(ctx.brandId), status);
    if (!move.ok) return { error: move.error };
    Object.assign(patch, move.patch);
  }
  if (!Object.keys(patch).length) return { error: "You cannot change this task." };

  const { error } = await ctx.admin.from("tasks").update(patch).eq("id", task.id).eq("brand_id", ctx.brandId);
  if (error) {
    console.error("[hub] updateTask failed:", error.message);
    return { error: "Could not save. Try again." };
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "task.update", target: task.id, meta: { fields: Object.keys(patch) } });
  refresh(ctx.slug);
  return { message: "Saved." };
}

// ---------------------------------------------------------------------------------------------- move (board, status menu)
export async function moveTask(brandId: string, taskId: string, statusKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = await taskContext(brandId);
  if (!c.ok) return { ok: false, error: c.error };
  const { ctx } = c;
  const task = await loadTask(ctx, taskId);
  if (!task || !canSeeStage(ctx.actor, task.stage)) return { ok: false, error: "That task no longer exists." };
  const move = planMove(ctx, task, await getWorkflow(ctx.brandId), String(statusKey));
  if (!move.ok) return move;
  const { error } = await ctx.admin.from("tasks").update(move.patch).eq("id", task.id).eq("brand_id", ctx.brandId);
  if (error) {
    console.error("[hub] moveTask failed:", error.message);
    return { ok: false, error: "Could not move the task. Try again." };
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "task.move", target: task.id, meta: { from: task.status, to: statusKey } });
  refresh(ctx.slug);
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------- approve / reject
async function decide(fd: FormData): Promise<FormState> {
  const c = await taskContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  if (!canDecide(ctx.who)) return { error: "Only the founder can approve or reject." };
  const task = await loadTask(ctx, str(fd, "taskId"));
  if (!task) return { error: "That task no longer exists." };
  if (task.stage !== "proposed") return { error: "This task is no longer waiting for a decision." };

  const approve = str(fd, "decision") === "approve";
  const workflow = await getWorkflow(ctx.brandId);
  const status = statusForStage(workflow, approve ? "active" : "rejected");
  if (!status) return { error: approve ? "This workflow has no active status to approve into." : "This workflow has no Rejected status." };

  const reason = str(fd, "reason").trim().slice(0, LIMITS.reason);
  const { error } = await ctx.admin
    .from("tasks")
    .update({ status, ...approvalPatch("proposed", approve ? "active" : "rejected", ctx.user.id) })
    .eq("id", task.id)
    .eq("brand_id", ctx.brandId)
    .eq("stage", "proposed"); // a second click, or another founder, cannot decide twice
  if (error) {
    console.error("[hub] decide failed:", error.message);
    return { error: "Could not save the decision. Try again." };
  }
  if (!approve && reason) {
    await ctx.admin.from("task_comments").insert({ task_id: task.id, brand_id: ctx.brandId, author_id: ctx.user.id, body: `Rejected: ${reason}` });
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: approve ? "task.approve" : "task.reject", target: task.id });
  refresh(ctx.slug);
  return { message: approve ? "Approved." : "Rejected." };
}

export async function decideTask(_prev: FormState, fd: FormData): Promise<FormState> {
  return decide(fd);
}

/** The Approve button in a list row: no state to show, the list refreshes. */
export async function approveInline(fd: FormData): Promise<void> {
  fd.set("decision", "approve");
  await decide(fd);
}

// ---------------------------------------------------------------------------------------------- comments
export async function addComment(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await taskContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  if (!canComment(ctx.who)) return { error: "You cannot comment in this brand." };
  const task = await loadTask(ctx, str(fd, "taskId"));
  if (!task || !canSeeStage(ctx.actor, task.stage)) return { error: "That task no longer exists." };
  const body = str(fd, "body").trim();
  if (!body) return { error: "Write something first." };
  if (body.length > LIMITS.comment) return { error: `Keep a comment under ${LIMITS.comment} characters.` };
  const { error } = await ctx.admin.from("task_comments").insert({ task_id: task.id, brand_id: ctx.brandId, author_id: ctx.user.id, body });
  if (error) {
    console.error("[hub] addComment failed:", error.message);
    return { error: "Could not post the comment. Try again." };
  }
  refresh(ctx.slug);
  return { message: "Posted." };
}

// ---------------------------------------------------------------------------------------------- delete
export async function deleteTask(fd: FormData): Promise<void> {
  const c = await taskContext(str(fd, "brandId"));
  if (!c.ok) return;
  const { ctx } = c;
  const task = await loadTask(ctx, str(fd, "taskId"));
  if (!task || !canDelete(ctx.who, task)) return;
  const { error } = await ctx.admin.from("tasks").delete().eq("id", task.id).eq("brand_id", ctx.brandId);
  if (error) {
    console.error("[hub] deleteTask failed:", error.message);
    return;
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "task.delete", target: task.title.slice(0, 80) });
  refresh(ctx.slug);
  redirect(`/hub/b/${ctx.slug}/tasks`);
}
