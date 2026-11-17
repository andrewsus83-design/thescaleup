// Who can do what with a task. Pure rules, no I/O: the server actions call these before every write and the pages use the
// same functions to decide which buttons to show, so the screen and the server can never disagree.
//
// Roles (see lib/hub/rules.ts): owner (agency), founder, staff, ops, viewer. The Settings → Team access matrix gives each
// role none / view / edit on the "tasks" function; these rules say what "edit" means.
//   owner, founder  everything, and they are the only ones who approve, reject or delete other people's work
//   staff           create (as a proposal when approval is on), edit any task, move work between active, review and done
//   ops             works only the tasks assigned to them: moves between active and review, and comments
//   viewer          reads only
// This mirrors the database policies in 20261116130000_brand_foundation.sql, which stay as the second line of defence.

import { atLeast, type Level } from "../permissions";
import type { Actor } from "../rules";
import { isIsoDate } from "./dates";
import { isPriority, type Stage, type Task, type Workflow, type WorkflowStatus } from "./model";

type Who = { actor: Actor | null; level: Level; userId: string };
type TaskLike = Pick<Task, "stage" | "assignee_id" | "created_by">;

const isDecider = (a: Actor | null) => a === "owner" || a === "founder";
const isStaffUp = (a: Actor | null) => a === "owner" || a === "founder" || a === "staff";

/** Ops and viewers never see proposals or rejected work. */
export function canSeeStage(actor: Actor | null, stage: Stage): boolean {
  if (isStaffUp(actor)) return true;
  if (actor === "ops" || actor === "viewer") return stage !== "proposed" && stage !== "rejected";
  return false;
}

export const canCreate = ({ actor, level }: Who) => atLeast(level, "edit") && isStaffUp(actor);
export const canDecide = ({ actor, level }: Who) => atLeast(level, "edit") && isDecider(actor);
export const canComment = ({ actor, level }: Who) => atLeast(level, "edit") && (isStaffUp(actor) || actor === "ops");

/**
 * Set up, change, pause or delete a repeating task. What a recipe makes goes straight onto the board, so when the brand wants new work
 * approved only the people who approve may set one up; otherwise anyone who can add tasks may.
 */
export const canRepeat = (w: Who, workflow: Pick<Workflow, "approvalRequired">) => (workflow.approvalRequired ? canDecide(w) : canCreate(w));
/** See the list of repeating tasks (everyone who can add tasks or approve them). */
export const canSeeRepeats = (w: Who) => canCreate(w) || canDecide(w);

/** Change title, description, assignee, dates, priority and tags. */
export function canEditFields(w: Who, t: TaskLike): boolean {
  return atLeast(w.level, "edit") && canSeeStage(w.actor, t.stage) && isStaffUp(w.actor);
}

export function canDelete(w: Who, t: TaskLike): boolean {
  if (!atLeast(w.level, "edit")) return false;
  if (isDecider(w.actor)) return true;
  // Staff can withdraw their own proposal, nothing else.
  return w.actor === "staff" && t.stage === "proposed" && t.created_by === w.userId;
}

/** May this person move the task from its current stage into `to`? Approving and rejecting are decisions, not moves. */
export function canMoveToStage(w: Who, t: TaskLike, to: Stage): boolean {
  if (!atLeast(w.level, "edit") || !canSeeStage(w.actor, t.stage)) return false;
  if (to === t.stage) return true;
  if (isDecider(w.actor)) return true;
  // Everything that enters or leaves "proposed" or "rejected" is the founder's call.
  if (t.stage === "proposed" || t.stage === "rejected" || to === "proposed" || to === "rejected") return false;
  if (w.actor === "staff") return true;
  // ops: only their own tasks, and only between active and review (they hand work over; someone else closes it).
  if (w.actor === "ops") return t.assignee_id === w.userId && (t.stage === "active" || t.stage === "review") && (to === "active" || to === "review");
  return false;
}

/** The statuses a person may move this task to (used for the board and the status menu). Includes the current status. */
export function allowedStatuses(w: Who, t: TaskLike & { status: string }, workflow: Workflow): WorkflowStatus[] {
  return workflow.statuses.filter((s) => s.key === t.status || canMoveToStage(w, t, s.stage));
}

/** The status key to use for a stage: the first status the workflow has in it. */
export const statusForStage = (workflow: Workflow, stage: Stage): string | null => workflow.statuses.find((s) => s.stage === stage)?.key ?? null;

/**
 * The status a new task starts in. A founder's task is approved by definition. When the brand requires approval, everyone
 * else (and every AI draft) starts as a proposal. A workflow with no "proposed" status simply has nothing to approve.
 */
export function startStatus(workflow: Workflow, actor: Actor | null, opts: { ai?: boolean } = {}): { status: string; stage: Stage } | null {
  const wantsProposal = workflow.approvalRequired && (opts.ai || !isDecider(actor));
  const order: Stage[] = wantsProposal ? ["proposed", "active"] : ["active"];
  for (const stage of order) {
    const key = statusForStage(workflow, stage);
    if (key) return { status: key, stage };
  }
  const first = workflow.statuses.find((s) => s.stage !== "rejected");
  return first ? { status: first.key, stage: first.stage } : null;
}

// ---------------------------------------------------------------------------------------------- input
export type TaskInput = {
  title: string;
  description: string | null;
  priority: "urgent" | "high" | "normal" | "low";
  assignee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  tags: string[];
};

export const LIMITS = { title: 200, description: 8000, tag: 30, tags: 10, comment: 4000, reason: 500 } as const;

/** Splits "a, b ,c" into clean unique tags. */
export function parseTags(raw: string): string[] {
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const t = part.trim().replace(/\s+/g, " ").slice(0, LIMITS.tag);
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
    if (out.length >= LIMITS.tags) break;
  }
  return out;
}

/** Validates form values. `memberIds` are the people who can be assigned (the brand's members). */
export function validateTaskInput(raw: Record<string, string>, memberIds: ReadonlySet<string>): { ok: true; value: TaskInput } | { ok: false; error: string } {
  const title = (raw.title ?? "").trim().replace(/\s+/g, " ");
  if (!title) return { ok: false, error: "Give the task a title." };
  if (title.length > LIMITS.title) return { ok: false, error: `Keep the title under ${LIMITS.title} characters.` };
  const description = (raw.description ?? "").trim();
  if (description.length > LIMITS.description) return { ok: false, error: `Keep the description under ${LIMITS.description} characters.` };

  const due = (raw.dueDate ?? "").trim();
  const start = (raw.startDate ?? "").trim();
  if (due && !isIsoDate(due)) return { ok: false, error: "The due date is not a valid date." };
  if (start && !isIsoDate(start)) return { ok: false, error: "The start date is not a valid date." };
  if (due && start && start > due) return { ok: false, error: "The start date is after the due date." };

  const priority = (raw.priority ?? "normal").trim() || "normal";
  if (!isPriority(priority)) return { ok: false, error: "Pick a priority from the list." };

  const assignee = (raw.assigneeId ?? "").trim();
  if (assignee && !memberIds.has(assignee)) return { ok: false, error: "That person is not on this brand's team." };

  return {
    ok: true,
    value: {
      title,
      description: description || null,
      priority,
      assignee_id: assignee || null,
      start_date: start || null,
      due_date: due || null,
      tags: parseTags(raw.tags ?? ""),
    },
  };
}
