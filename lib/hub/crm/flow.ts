import "server-only";
import { allow } from "../ratelimit";
import { audit } from "../session";
import type { Ctx } from "../tasks/context";
import { getWorkflow } from "../tasks/data";
import { hubTz, todayIn } from "../tasks/dates";
import { startStatus, statusForStage } from "../tasks/rules";
import { getRules, getStages } from "./data";
import { describeRule, labelOf, planRule, type Kind } from "./model";

/** Writes down that someone entered a stage. A failure is logged and never blocks the move itself. */
export async function logStage(ctx: Pick<Ctx, "admin" | "brandId" | "user">, m: { personId: string; kind: Kind; from: string | null; to: string; converted?: boolean }): Promise<void> {
  const { error } = await ctx.admin.from("crm_stage_log").insert({
    brand_id: ctx.brandId,
    person_id: m.personId,
    kind: m.kind,
    from_stage: m.from,
    to_stage: m.to,
    converted: m.converted === true,
    changed_by: ctx.user.id,
  });
  if (error) console.error("[crm] stage log failed:", error.message);
}

type Who = { id: string; kind: Kind; name: string; company: string };

/**
 * Runs what the brand set for the stage someone just entered: a follow-up date and/or a task. It never blocks or undoes the
 * move: whatever goes wrong is logged and the person simply stays where they are. `keepFollowUp` leaves a follow-up that was
 * typed in by hand (a new person added with a date) alone.
 */
export async function runRules(ctx: Ctx, p: Who, stage: string, opts: { keepFollowUp?: boolean } = {}): Promise<void> {
  try {
    const [{ rules, updatedBy }, stages] = await Promise.all([getRules(ctx.brandId), getStages(ctx.brandId)]);
    const rule = rules.find((r) => r.stage === stage);
    if (!rule) return;
    if (!allow(`crm-auto:${ctx.brandId}`, 600)) {
      console.error("[crm] automation skipped: too many in an hour for", ctx.brandId);
      return;
    }

    // Only members can be given a task: look up the ones this rule could name.
    const candidates = [rule.task?.assignee === "mover" ? ctx.user.id : rule.task?.assignee].filter((v): v is string => typeof v === "string" && v !== "mover");
    const memberIds = new Set<string>();
    if (candidates.length) {
      const { data } = await ctx.admin.from("brand_members").select("user_id").eq("brand_id", ctx.brandId).in("user_id", candidates);
      for (const m of data ?? []) memberIds.add(m.user_id as string);
    }
    const plan = planRule(rule, p, todayIn(hubTz()), { moverId: ctx.user.id, memberIds });

    let followed = false;
    if (plan.followUp && !opts.keepFollowUp) {
      const { error } = await ctx.admin.from("crm_people").update({ next_follow_up: plan.followUp }).eq("brand_id", ctx.brandId).eq("id", p.id);
      if (error) console.error("[crm] automation follow-up failed:", error.message);
      else followed = true;
    }

    let tasked = false;
    if (plan.task && plan.task.title) {
      tasked = await addRuleTask(ctx, p, plan.task, labelOf(stages, stage), updatedBy ?? ctx.user.id);
    }
    if (followed || tasked) await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.automation", target: p.id, meta: { stage, did: describeRule(rule).slice(0, 200) } });
  } catch (e) {
    console.error("[crm] automation failed:", e instanceof Error ? e.message : e);
  }
}

/** Adds the rule's task unless the same one is already open for this person. The manager who set the rule approved it. */
async function addRuleTask(ctx: Ctx, p: Who, t: { title: string; due: string | null; assignee: string | null }, stageLabel: string, approver: string): Promise<boolean> {
  const link = `/hub/b/${ctx.slug}/crm/${p.id}`;
  const { data: open } = await ctx.admin
    .from("tasks")
    .select("id")
    .eq("brand_id", ctx.brandId)
    .eq("source", "automation")
    .eq("title", t.title)
    .like("description", `%${link}%`)
    .in("stage", ["proposed", "active", "review"])
    .limit(1);
  if (open && open.length) return false;

  const workflow = await getWorkflow(ctx.brandId);
  const active = statusForStage(workflow, "active");
  const start = active ? { status: active, stage: "active" as const } : startStatus(workflow, ctx.actor);
  if (!start) return false;
  const description = `${p.kind === "lead" ? "Lead" : "Client"}: ${p.name}${p.company ? ` (${p.company})` : ""}\nAdded because they entered "${stageLabel}".\n${link}`;
  const { error } = await ctx.admin.from("tasks").insert({
    brand_id: ctx.brandId,
    title: t.title,
    description,
    priority: "normal",
    assignee_id: t.assignee,
    due_date: t.due,
    tags: ["crm"],
    status: start.status,
    source: "automation",
    created_by: ctx.user.id,
    ...(start.stage === "proposed" ? {} : { approved_by: approver, approved_at: new Date().toISOString() }),
  });
  if (error) {
    console.error("[crm] automation task failed:", error.message);
    return false;
  }
  return true;
}
