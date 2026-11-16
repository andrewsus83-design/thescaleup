import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBrandKey } from "../secrets";
import type { Actor } from "../rules";
import { isBrandRole } from "../rules";
import { isPriority, isStage, TASK_COLUMNS, type Member, type Task, type TaskComment, type Workflow, type WorkflowStatus } from "./model";
import { canSeeStage } from "./rules";

const DEFAULT_WORKFLOW: Workflow = {
  approvalRequired: true,
  statuses: [
    { key: "proposed", label: "Proposed", stage: "proposed" },
    { key: "approved", label: "Approved", stage: "active" },
    { key: "in_progress", label: "In progress", stage: "active" },
    { key: "review", label: "Review", stage: "review" },
    { key: "done", label: "Done", stage: "closed" },
    { key: "rejected", label: "Rejected", stage: "rejected" },
  ],
};

/** The brand's statuses and whether proposals need approval. Falls back to the default flow if the row is missing or odd. */
export const getWorkflow = cache(async (brandId: string): Promise<Workflow> => {
  const { data } = await createSupabaseAdminClient().from("brand_workflows").select("statuses, approval_required").eq("brand_id", brandId).maybeSingle();
  const raw = Array.isArray(data?.statuses) ? (data.statuses as unknown[]) : [];
  const statuses: WorkflowStatus[] = [];
  for (const s of raw) {
    const o = s as { key?: unknown; label?: unknown; stage?: unknown };
    if (typeof o.key === "string" && typeof o.label === "string" && isStage(o.stage)) statuses.push({ key: o.key, label: o.label, stage: o.stage });
  }
  return statuses.length ? { statuses, approvalRequired: data?.approval_required !== false } : DEFAULT_WORKFLOW;
});

/** The brand's people with their sign-in emails, for assignee menus and avatars. */
export const listMembers = cache(async (brandId: string): Promise<Member[]> => {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("brand_members").select("user_id, role").eq("brand_id", brandId).order("created_at");
  const people = await Promise.all(
    (data ?? [])
      .filter((m) => isBrandRole(m.role))
      .map(async (m) => {
        const { data: u } = await admin.auth.admin.getUserById(m.user_id);
        return { userId: m.user_id as string, email: u.user?.email ?? "unknown", role: m.role as Member["role"] };
      }),
  );
  return people.sort((a, b) => a.email.localeCompare(b.email));
});

/** Whether AI helpers can run for this brand (its own Anthropic key, or the workspace default). The key itself never leaves the server. */
export const hasAiKey = cache(async (brandId: string): Promise<boolean> => (await getBrandKey(brandId, "claude", true)) !== null);

export type TaskFilters = {
  userId: string;
  q?: string;
  /** "me", "none", or a user id. */
  assignee?: string;
  status?: string;
  priority?: string;
  /** Exactly this due day. */
  due?: string;
  dueFrom?: string;
  dueTo?: string;
  noDue?: boolean;
  limit?: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const likeEscape = (s: string) => s.replace(/[\\%_]/g, "\\$&");

function normalize(r: Record<string, unknown>): Task {
  return {
    ...(r as unknown as Task),
    priority: isPriority(r.priority) ? r.priority : "normal",
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
  };
}

/**
 * Tasks the person may see. Read with their own session, so the database policies filter first (ops and viewers never
 * get proposals or rejected work); `canSeeStage` repeats the rule so a policy change can never widen a page by accident.
 */
export async function listTasks(brandId: string, actor: Actor | null, f: TaskFilters): Promise<Task[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase.from("tasks").select(TASK_COLUMNS).eq("brand_id", brandId);
  if (f.q?.trim()) q = q.ilike("title", `%${likeEscape(f.q.trim().slice(0, 80))}%`);
  if (f.assignee === "me") q = q.eq("assignee_id", f.userId);
  else if (f.assignee === "none") q = q.is("assignee_id", null);
  else if (f.assignee && UUID.test(f.assignee)) q = q.eq("assignee_id", f.assignee);
  if (f.status) q = q.eq("status", f.status);
  if (f.priority && isPriority(f.priority)) q = q.eq("priority", f.priority);
  if (f.due) q = q.eq("due_date", f.due);
  if (f.dueFrom) q = q.gte("due_date", f.dueFrom);
  if (f.dueTo) q = q.lte("due_date", f.dueTo);
  if (f.noDue) q = q.is("due_date", null);
  const { data, error } = await q
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(Math.min(f.limit ?? 500, 1000));
  if (error) {
    console.error("[hub] listTasks failed:", error.message);
    return [];
  }
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>)).filter((t) => canSeeStage(actor, t.stage));
}

export async function getTask(brandId: string, taskId: string, actor: Actor | null): Promise<Task | null> {
  if (!UUID.test(taskId)) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("tasks").select(TASK_COLUMNS).eq("brand_id", brandId).eq("id", taskId).maybeSingle();
  if (!data) return null;
  const t = normalize(data as Record<string, unknown>);
  return canSeeStage(actor, t.stage) ? t : null;
}

export async function listComments(brandId: string, taskId: string): Promise<TaskComment[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("task_comments")
    .select("id, task_id, author_id, author_label, body, created_at")
    .eq("brand_id", brandId)
    .eq("task_id", taskId)
    .order("created_at", { ascending: true })
    .limit(300);
  return (data ?? []) as TaskComment[];
}

// ---------------------------------------------------------------------------------------------- time entries (service role only)
export type EntryRow = { id: string; user_id: string; clock_in: string; clock_out: string | null };

export async function listEntries(brandId: string, sinceIso: string, userId?: string): Promise<EntryRow[]> {
  let q = createSupabaseAdminClient().from("time_entries").select("id, user_id, clock_in, clock_out").eq("brand_id", brandId).gte("clock_in", sinceIso);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q.order("clock_in", { ascending: false }).limit(2000);
  return (data ?? []) as EntryRow[];
}

export async function getOpenEntry(brandId: string, userId: string): Promise<EntryRow | null> {
  const { data } = await createSupabaseAdminClient()
    .from("time_entries")
    .select("id, user_id, clock_in, clock_out")
    .eq("brand_id", brandId)
    .eq("user_id", userId)
    .is("clock_out", null)
    .maybeSingle();
  return (data as EntryRow | null) ?? null;
}
