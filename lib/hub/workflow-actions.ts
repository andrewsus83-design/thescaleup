"use server";

import { revalidatePath } from "next/cache";
import { canManageTeam } from "./rules";
import { audit } from "./session";
import { getWorkflow } from "./tasks/data";
import { taskContext } from "./tasks/context";
import { checkWorkflow, type Draft } from "./tasks/workflow";

// Settings → Workflow: the statuses a brand's tasks move through, and whether new tasks wait for approval. Only the owner or the founder.

type Done = { ok: true; message: string } | { ok: false; error: string };

export async function saveWorkflow(input: { brandId: string; approvalRequired: boolean; statuses: Draft[] }): Promise<Done> {
  const c = await taskContext(input.brandId, "tasks");
  if (!c.ok) return c;
  const { ctx } = c;
  if (!canManageTeam(ctx.actor)) return { ok: false, error: "Only the owner or founder can change the workflow." };
  if (!Array.isArray(input.statuses) || input.statuses.length > 40) return { ok: false, error: "That is not a workflow this page understands. Reload and try again." };
  const rows: Draft[] = input.statuses.map((s) => ({ key: typeof s?.key === "string" ? s.key : null, label: String(s?.label ?? ""), stage: String(s?.stage ?? "") }));

  // Read it fresh: the cached copy may be from before someone else saved.
  const current = await getWorkflow(ctx.brandId);
  const { data: tasks, error: readError } = await ctx.admin.from("tasks").select("status").eq("brand_id", ctx.brandId).limit(50_000);
  if (readError) return { ok: false, error: "Could not check which statuses are in use. Try again." };
  const used = new Map<string, number>();
  for (const t of tasks ?? []) used.set(String(t.status), (used.get(String(t.status)) ?? 0) + 1);

  const checked = checkWorkflow(rows, current.statuses, used);
  if (!checked.ok) return checked;
  const { error } = await ctx.admin.from("brand_workflows").upsert({ brand_id: ctx.brandId, statuses: checked.statuses, approval_required: input.approvalRequired === true, updated_at: new Date().toISOString() }, { onConflict: "brand_id" });
  if (error) {
    console.error("[workflow] save failed:", error.message);
    return { ok: false, error: "Could not save the workflow. Try again." };
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "workflow.save", target: ctx.brandId, meta: { statuses: checked.statuses.length, approvalRequired: input.approvalRequired === true } });
  revalidatePath(`/hub/b/${ctx.slug}`, "layout");
  return { ok: true, message: "Workflow saved." };
}
