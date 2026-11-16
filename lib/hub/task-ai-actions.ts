"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import type { FormState } from "./actions";
import { allow } from "./ratelimit";
import { getBrandKey } from "./secrets";
import { audit } from "./session";
import { str, taskContext, UUID } from "./tasks/context";
import { dayIn, hubTz, fmtDay } from "./tasks/dates";
import { getWorkflow, listComments, listMembers } from "./tasks/data";
import { MAX_DRAFTS, MAX_INPUT_CHARS, SUMMARY_SYSTEM, extractPrompt, extractUser, parseDrafts } from "./tasks/ai-parse";
import { TASK_COLUMNS, type Task } from "./tasks/model";
import { canComment, canCreate, canSeeStage, startStatus } from "./tasks/rules";

// Two small, user-triggered helpers. Nothing runs by itself, the model has no tools, and everything it writes is either a
// *proposal* a person approves (drafted tasks) or a comment (a summary). Cost control: size caps on input and output, an hourly
// limit per person, and the token counts go to the audit log until the usage ledger exists.

const model = () => process.env.HUB_AI_MODEL?.trim() || "claude-sonnet-5-5";
const NO_KEY = "Add an Anthropic key in Settings → Integrations to use AI.";
const BUSY = "That is a lot of AI requests in an hour. Try again later.";

async function ask(apiKey: string, system: string, user: string, maxTokens: number) {
  const client = new Anthropic({ apiKey });
  const resp = await client.messages.create({ model: model(), max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }, { timeout: 60_000 });
  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return { text, tokens: { in: resp.usage?.input_tokens ?? 0, out: resp.usage?.output_tokens ?? 0 } };
}

/** Pasted notes in, proposed tasks out. */
export async function draftTasks(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await taskContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  if (!canCreate(ctx.who)) return { error: "You cannot add tasks in this brand." };

  const text = str(fd, "text").trim();
  if (text.length < 20) return { error: "Paste a few sentences of notes first." };
  if (text.length > MAX_INPUT_CHARS) return { error: `That is too long. Keep it under ${MAX_INPUT_CHARS.toLocaleString("en-US")} characters.` };
  if (!allow(`ai:${ctx.user.id}`, 12)) return { error: BUSY };

  const key = await getBrandKey(ctx.brandId, "claude", true);
  if (!key) return { error: NO_KEY };

  const [members, workflow] = await Promise.all([listMembers(ctx.brandId), getWorkflow(ctx.brandId)]);
  const start = startStatus(workflow, ctx.actor, { ai: true });
  if (!start) return { error: "This brand's workflow has no status to start in. Check Settings." };

  let reply: Awaited<ReturnType<typeof ask>>;
  try {
    reply = await ask(key, extractPrompt(dayIn(hubTz())), extractUser(text), 2500);
  } catch (e) {
    console.error("[hub] draftTasks failed:", e instanceof Error ? e.message : e);
    return { error: "The AI request failed. Check the Anthropic key in Settings and try again." };
  }

  const drafts = parseDrafts(reply.text, members);
  if (!drafts.length) return { error: "No tasks found in that text. Try adding what needs to be done and by when." };

  const { error } = await ctx.admin.from("tasks").insert(
    drafts.slice(0, MAX_DRAFTS).map((d) => ({
      brand_id: ctx.brandId,
      title: d.title,
      description: d.description,
      priority: d.priority,
      due_date: d.due_date,
      assignee_id: d.assignee_id,
      status: start.status,
      source: "ai",
      created_by: ctx.user.id,
      ...(start.stage === "proposed" ? {} : { approved_by: ctx.user.id, approved_at: new Date().toISOString() }),
    })),
  );
  if (error) {
    console.error("[hub] draftTasks insert failed:", error.message);
    return { error: "Could not save the drafted tasks. Try again." };
  }
  // The notes themselves are not logged, only how much was used.
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "task.ai_draft", meta: { count: drafts.length, chars: text.length, model: model(), tokens: reply.tokens } });
  revalidatePath(`/hub/b/${ctx.slug}`, "layout");
  const n = drafts.length;
  return { message: `${n} ${n === 1 ? "task" : "tasks"} drafted.${start.stage === "proposed" ? " They are waiting for approval in the list." : ""}` };
}

/** A short status and next steps for one task, posted as a comment from the AI assistant. */
export async function summarizeTask(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await taskContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  if (!canComment(ctx.who)) return { error: "You cannot comment in this brand." };
  const taskId = str(fd, "taskId");
  if (!UUID.test(taskId)) return { error: "That task no longer exists." };
  const { data } = await ctx.admin.from("tasks").select(TASK_COLUMNS).eq("brand_id", ctx.brandId).eq("id", taskId).maybeSingle();
  const task = data as Task | null;
  if (!task || !canSeeStage(ctx.actor, task.stage)) return { error: "That task no longer exists." };
  if (!allow(`ai:${ctx.user.id}`, 12)) return { error: BUSY };

  const key = await getBrandKey(ctx.brandId, "claude", true);
  if (!key) return { error: NO_KEY };

  const [workflow, comments] = await Promise.all([getWorkflow(ctx.brandId), listComments(ctx.brandId, task.id)]);
  const status = workflow.statuses.find((s) => s.key === task.status)?.label ?? task.status;
  const recent = comments.filter((m) => m.author_label !== "AI assistant").slice(-20);
  const body = [
    `Title: ${task.title}`,
    `Status: ${status}`,
    `Priority: ${task.priority}`,
    task.due_date ? `Due: ${fmtDay(task.due_date)}` : "Due: not set",
    task.description ? `Description: ${task.description.slice(0, 3000)}` : "Description: none",
    recent.length ? `Comments:\n${recent.map((m) => `- ${m.body.slice(0, 500)}`).join("\n").slice(0, 4000)}` : "Comments: none",
  ].join("\n");

  let reply: Awaited<ReturnType<typeof ask>>;
  try {
    reply = await ask(key, SUMMARY_SYSTEM, `<task>\n${body.replace(/<\/?task>/gi, "")}\n</task>`, 600);
  } catch (e) {
    console.error("[hub] summarizeTask failed:", e instanceof Error ? e.message : e);
    return { error: "The AI request failed. Check the Anthropic key in Settings and try again." };
  }
  const text = reply.text.trim().slice(0, 2000);
  if (!text) return { error: "The AI returned nothing. Try again." };

  const { error } = await ctx.admin.from("task_comments").insert({ task_id: task.id, brand_id: ctx.brandId, author_id: null, author_label: "AI assistant", body: text });
  if (error) {
    console.error("[hub] summarizeTask insert failed:", error.message);
    return { error: "Could not post the summary. Try again." };
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "task.ai_summary", target: task.id, meta: { model: model(), tokens: reply.tokens } });
  revalidatePath(`/hub/b/${ctx.slug}`, "layout");
  return { message: "Summary added to the comments." };
}
