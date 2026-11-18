"use server";

import { revalidatePath } from "next/cache";
import { accessFor } from "./access";
import { aiModel, askClaudeChat } from "./ai";
import { getProfile } from "./brand-profile/data";
import { PROFILE_TOTAL, filledCount } from "./brand-profile/model";
import { atLeast } from "./permissions";
import { allow } from "./ratelimit";
import { getBrandKey } from "./secrets";
import { audit } from "./session";
import { UUID, taskContext, type Ctx } from "./tasks/context";
import { getWorkflow, listComments, listItems } from "./tasks/data";
import { dayIn, hubTz } from "./tasks/dates";
import { DO_LIMITS, JOBS, flagDraft, isJob, plain, cleanTurns, type Flags, type JobId } from "./tasks/do-ai";
import { commentsText, firstMessage, profileText, rankWiki, systemPrompt, taskText, wikiBlock, wikiTerms } from "./tasks/do-ai-prompt";
import { TASK_COLUMNS, shortName, type Task } from "./tasks/model";
import { canComment, canSeeStage } from "./tasks/rules";
import { aiDefault, isType, pageSlug, parsePage, uniqueSlug } from "./wiki/model";

// "Do with AI" on a task. One press gives a draft; a short chat can change it. Nothing here is kept between requests: the page sends the
// chat each time, and the AI reads the brand's notes fresh. Only two things are ever written, and only when a person presses the
// button: a saved draft (a comment on the task) and a new Wiki page. The AI has no tools and changes nothing itself.

const NO_KEY = "Add an Anthropic key in Settings → Integrations to use AI.";
const BUSY = "That is a lot of AI requests in an hour. Try again later.";
const FAILED = "The AI request failed. Check the Anthropic key in Settings and try again.";
const GONE = "That task no longer exists.";

export type DoRead = { profile: number; profileTotal: number; wiki: number; steps: number; comments: number };
export type DoResult = { ok: true; text: string; job: JobId; read: DoRead; flags: Flags; truncated: boolean } | { ok: false; error: string };
export type SaveResult = { ok: true; message: string; href?: string } | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const id = (v: unknown) => (typeof v === "string" ? v : "");

/** The task, if it exists in this brand and this person may see it. */
async function readTask(ctx: Ctx, taskId: string): Promise<Task | null> {
  if (!UUID.test(taskId)) return null;
  const { data } = await ctx.admin.from("tasks").select(TASK_COLUMNS).eq("brand_id", ctx.brandId).eq("id", taskId).maybeSingle();
  const task = data as Task | null;
  return task && canSeeStage(ctx.actor, task.stage) ? task : null;
}

/** A draft for the task. The page sends the chat so far (`turns`); nothing about it is stored here. */
export async function doWithAi(input: unknown): Promise<DoResult> {
  const i = obj(input);
  const c = await taskContext(i.brandId);
  if (!c.ok) return fail(c.error);
  const { ctx } = c;
  if (!canComment(ctx.who)) return fail("You cannot use AI on tasks in this brand.");
  if (!isJob(i.job)) return fail("Pick what kind of help you want.");
  const job = JOBS[i.job];
  const t = cleanTurns(i.turns);
  if (!t.ok) return fail("This chat got too long. Close it and start a new one.");
  const ask = plain(i.ask);
  if (job.needsText && ask.length < 10) return fail("Paste the text to check first.");
  if (ask.length > (job.needsText ? DO_LIMITS.paste : DO_LIMITS.ask)) return fail(`That is too long. Keep it under ${(job.needsText ? DO_LIMITS.paste : DO_LIMITS.ask).toLocaleString("en-US")} characters.`);
  const task = await readTask(ctx, id(i.taskId));
  if (!task) return fail(GONE);
  if (!allow(`taskdo:${ctx.user.id}`, 40) || !allow(`taskdo-brand:${ctx.brandId}`, 200)) return fail(BUSY);
  const key = await getBrandKey(ctx.brandId, "claude", true);
  if (!key) return fail(NO_KEY);

  // The AI reads what this person may read: the profile needs Brand access and the Wiki needs Wiki access.
  const access = await accessFor(ctx.brandId, ctx.actor);
  const [workflow, items, comments, profile, brandRow] = await Promise.all([
    getWorkflow(ctx.brandId),
    listItems(ctx.brandId, task.id),
    listComments(ctx.brandId, task.id),
    atLeast(access.brand, "view") ? getProfile(ctx.brandId) : null,
    ctx.admin.from("brands").select("name").eq("id", ctx.brandId).maybeSingle(),
  ]);

  let pages: { title: string; type: string; body: string }[] = [];
  let others: string[] = [];
  if (atLeast(access.wiki, "view")) {
    const { data } = await ctx.admin.from("wiki_pages").select("id, title, summary, type, tags").eq("brand_id", ctx.brandId).eq("ai_readable", true).limit(500);
    const cards = (data ?? []) as { id: string; title: string; summary: string; type: string; tags: string[] }[];
    const chosen = rankWiki(cards, wikiTerms(task.title, task.description ?? "", ...items.map((x) => x.body), ...task.tags));
    if (chosen.length) {
      const { data: bodies } = await ctx.admin.from("wiki_pages").select("id, title, type, body").eq("brand_id", ctx.brandId).in("id", chosen.map((p) => p.id));
      const byId = new Map((bodies ?? []).map((b) => [b.id as string, b as { title: string; type: string; body: string }]));
      pages = chosen.map((p) => byId.get(p.id)).filter((p): p is { title: string; type: string; body: string } => !!p);
    }
    const used = new Set(chosen.map((p) => p.id));
    others = cards.filter((p) => !used.has(p.id)).slice(0, 30).map((p) => p.title);
  }

  const status = workflow.statuses.find((s) => s.key === task.status)?.label ?? task.status;
  const system = systemPrompt({
    job,
    brandName: typeof brandRow.data?.name === "string" ? brandRow.data.name : "",
    today: dayIn(hubTz()),
    language: profile?.value.fields.language ?? "",
    profile: profile ? profileText(profile.value) : "",
    wiki: wikiBlock(pages),
    otherPages: others,
    task: taskText({ title: task.title, description: task.description, status, priority: task.priority, due: task.due_date, items, tags: task.tags }),
    comments: commentsText(comments.map((m) => ({ label: m.author_label, body: m.body }))),
  });
  const messages = [{ role: "user" as const, content: firstMessage(job, ask) }, ...t.turns.map((x) => ({ role: x.role, content: x.text }))];

  let reply: Awaited<ReturnType<typeof askClaudeChat>>;
  try {
    reply = await askClaudeChat(key, system, messages, DO_LIMITS.maxTokens);
  } catch (e) {
    console.error("[hub] doWithAi failed:", e instanceof Error ? e.message : e);
    return fail(FAILED);
  }
  const text = plain(reply.text).slice(0, DO_LIMITS.reply);
  if (!text) return fail("The AI returned nothing. Try again.");

  // Sizes and names only: never the text of the task, the notes or the draft.
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "task.ai_do", target: task.id, meta: { job: job.id, turns: t.turns.length, chars: text.length, model: aiModel(), tokens: reply.tokens } });
  return {
    ok: true,
    text,
    job: job.id,
    flags: flagDraft(text),
    truncated: reply.truncated,
    read: { profile: profile ? filledCount(profile.value) : 0, profileTotal: PROFILE_TOTAL, wiki: pages.length, steps: items.length, comments: comments.length },
  };
}

/** Keeps a draft on the task, as a comment. The only thing from a chat that is stored, and only when a person presses Save. */
export async function saveAiDraft(input: unknown): Promise<SaveResult> {
  const i = obj(input);
  const c = await taskContext(i.brandId);
  if (!c.ok) return fail(c.error);
  const { ctx } = c;
  if (!canComment(ctx.who)) return fail("You cannot comment in this brand.");
  const task = await readTask(ctx, id(i.taskId));
  if (!task) return fail(GONE);
  const text = plain(i.text);
  if (text.length < 10) return fail("There is nothing to save yet.");
  if (text.length > DO_LIMITS.save) return fail(`That is too long to keep on a task (${DO_LIMITS.save.toLocaleString("en-US")} characters at most). Ask the AI to shorten it.`);
  if (!allow(`taskdo-save:${ctx.user.id}`, 60)) return fail("That is a lot of saving in an hour. Try again a bit later.");
  const { error } = await ctx.admin.from("task_comments").insert({ task_id: task.id, brand_id: ctx.brandId, author_id: ctx.user.id, author_label: `AI draft, saved by ${shortName(ctx.user.email)}`, body: text });
  if (error) {
    console.error("[hub] saveAiDraft failed:", error.message);
    return fail("Could not save the draft. Try again.");
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "task.ai_save", target: task.id, meta: { chars: text.length } });
  revalidatePath(`/hub/b/${ctx.slug}`, "layout");
  return { ok: true, message: "Saved to the comments below." };
}

/**
 * Makes a Wiki page from a draft. A person chooses the title and type and presses the button, so the page is theirs. A draft that still
 * has [NEED: ...] gaps is refused: the Wiki is what later drafts read as fact, and a guess must not become one.
 */
export async function addDraftToWiki(input: unknown): Promise<SaveResult> {
  const i = obj(input);
  const c = await taskContext(i.brandId, "wiki");
  if (!c.ok) return fail(c.error);
  const { ctx } = c;
  if (!atLeast(ctx.level, "edit")) return fail("You can read the Wiki here but not change it.");
  const text = plain(i.text);
  if (/\[NEED:/i.test(text)) return fail("This draft still has [NEED: ...] gaps. Fill them in with real facts first, or the Wiki will keep a guess as fact.");
  const type = id(i.type);
  if (!isType(type)) return fail("Pick a type from the list.");
  const parsed = parsePage((k) => ({ title: id(i.title), summary: "Written with AI from a task and checked by a person.", body: text, type, tags: "", parentId: "", aiReadable: aiDefault(type) ? "on" : "" })[k] ?? "");
  if (!parsed.ok) return fail(parsed.error);
  if (!parsed.value.body.trim()) return fail("There is nothing to add yet.");
  if (!allow(`wiki-save:${ctx.user.id}`, 200)) return fail("That is a lot of saves in an hour. Try again a bit later.");

  const { data: taken } = await ctx.admin.from("wiki_pages").select("slug").eq("brand_id", ctx.brandId).limit(2000);
  const base = pageSlug(parsed.value.title);
  let slug = uniqueSlug(base, new Set((taken ?? []).map((r) => r.slug as string)));
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await ctx.admin.from("wiki_pages").insert({ ...parsed.value, slug, brand_id: ctx.brandId, created_by: ctx.user.id, updated_by: ctx.user.id }).select("id, slug").single();
    if (!error && data) {
      await audit({ actor: ctx.user, brandId: ctx.brandId, action: "wiki.create", target: data.id as string, meta: { type, from: "task_ai" } });
      revalidatePath(`/hub/b/${ctx.slug}`, "layout");
      return { ok: true, message: "Added to the Wiki.", href: `/hub/b/${ctx.slug}/wiki/${data.slug}` };
    }
    if (error?.code !== "23505") {
      console.error("[hub] addDraftToWiki failed:", error?.message);
      return fail("Could not add it to the Wiki. Try again.");
    }
    slug = `${base.slice(0, 70)}-${Math.random().toString(36).slice(2, 6)}`; // two pages with the same title at the same moment
  }
  return fail("Could not add it to the Wiki. Try again.");
}
