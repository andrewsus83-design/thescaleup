"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "./actions";
import { aiModel, askClaude } from "./ai";
import { atLeast } from "./permissions";
import { allow } from "./ratelimit";
import { getBrandKey } from "./secrets";
import { audit } from "./session";
import { UUID, str, taskContext, type Ctx } from "./tasks/context";
import { PAGE_SYSTEM, PLAN_SYSTEM, QUESTIONS_SYSTEM, answersText, gapsDraft, pageUser, parseAnswers, parseDraft, parsePlan, parseQuestions, parseSources, planUser, sourcesUser, type Draft } from "./wiki/build";
import { getBuild } from "./wiki/builds";
import { readSources } from "./wiki/read";
import { aiDefault, pageSlug, parsePage, uniqueSlug } from "./wiki/model";

// The Wiki AI Page Builder. Three steps, each started by a person: read the sources and ask questions; take the answers and
// draft pages; add or skip each draft. The model has no tools and never writes to the Wiki itself: a draft becomes a page only
// when someone adds it. Cost control: size caps on everything sent, an hourly limit per person and per brand, the brand's own
// Anthropic key, and the token counts in the audit log.

const NO_KEY = "Add an Anthropic key in Settings → Integrations to use AI.";
const BUSY = "That is a lot of AI work in an hour. Try again later.";
const refresh = (slug: string) => revalidatePath(`/hub/b/${slug}`, "layout");

async function editContext(brandId: unknown): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const c = await taskContext(brandId, "wiki");
  if (!c.ok) return c;
  if (!atLeast(c.ctx.level, "edit")) return { ok: false, error: "You can read the Wiki here but not change it." };
  return c;
}

/** Step 1: read the website and social pages, ask the questions that are still open, save the run and open it. */
export async function startBuild(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const parsed = parseSources((k) => str(fd, k));
  if (!parsed.ok) return { error: parsed.error };
  const src = parsed.value;
  if (!allow(`wikibuild:${ctx.user.id}`, 6) || !allow(`wikibuild-brand:${ctx.brandId}`, 12)) return { error: BUSY };
  const key = await getBrandKey(ctx.brandId, "claude", true);
  if (!key) return { error: NO_KEY };
  // Before any reading or AI cost: is the table there? (The database step may not have been run yet.)
  const probe = await ctx.admin.from("wiki_builds").select("id").eq("brand_id", ctx.brandId).limit(1);
  if (probe.error) {
    console.error("[wiki-ai] wiki_builds not ready:", probe.error.message);
    return { error: "The Wiki builder needs its database step first (20261117260000_wiki_builds.sql). Ask the person who runs the database updates." };
  }

  const { read, digest } = await readSources(src);
  if (digest.length < 150) {
    const why = read.filter((r) => !r.ok).map((r) => `${r.label}: ${r.note}`).join(" ");
    return { error: `Not enough could be read to start. ${why} Add a few lines about the brand in the notes box, or check the addresses.`.trim() };
  }

  let reply: Awaited<ReturnType<typeof askClaude>>;
  try {
    reply = await askClaude(key, QUESTIONS_SYSTEM, sourcesUser(digest), 1500);
  } catch (e) {
    console.error("[wiki-ai] questions failed:", e instanceof Error ? e.message : e);
    return { error: "The AI request failed. Check the Anthropic key in Settings and try again." };
  }
  const questions = parseQuestions(reply.text);

  const { data, error } = await ctx.admin
    .from("wiki_builds")
    .insert({ brand_id: ctx.brandId, status: "asking", sources: src, read, digest, questions, created_by: ctx.user.id })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[wiki-ai] save failed:", error?.message);
    return { error: "Could not save this run. Try again." };
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "wiki.build.start", target: data.id as string, meta: { read: read.filter((r) => r.ok).length, failed: read.filter((r) => !r.ok).length, questions: questions.length, model: aiModel(), tokens: reply.tokens } });
  refresh(ctx.slug);
  redirect(`/hub/b/${ctx.slug}/wiki/build/${data.id}`);
}

/** Step 2: save the answers; with intent "write", also plan the pages and write each one as a draft. */
export async function answerBuild(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const id = str(fd, "id");
  if (!UUID.test(id)) return { error: "That run no longer exists." };
  const build = await getBuild(ctx.brandId, id);
  if (!build) return { error: "That run no longer exists." };
  const answers = parseAnswers(build.questions, (k) => str(fd, k));
  const write = str(fd, "intent") === "write";

  if (!write) {
    const { error } = await ctx.admin.from("wiki_builds").update({ answers }).eq("brand_id", ctx.brandId).eq("id", id);
    if (error) return { error: "Could not save the answers. Try again." };
    return { message: "Answers saved." };
  }

  if (!allow(`wikiwrite:${ctx.user.id}`, 6) || !allow(`wikiwrite-brand:${ctx.brandId}`, 12)) return { error: BUSY };
  const key = await getBrandKey(ctx.brandId, "claude", true);
  if (!key) return { error: NO_KEY };

  const tokens = { in: 0, out: 0 };
  const tally = (t: { in: number; out: number }) => {
    tokens.in += t.in;
    tokens.out += t.out;
  };
  let plan;
  try {
    const reply = await askClaude(key, PLAN_SYSTEM, planUser(build.digest, answersText(build.questions, answers)), 4000);
    tally(reply.tokens);
    plan = parsePlan(reply.text);
  } catch (e) {
    console.error("[wiki-ai] plan failed:", e instanceof Error ? e.message : e);
    return { error: "The AI request failed. Check the Anthropic key in Settings and try again." };
  }
  if (!plan) return { error: "The AI could not plan the pages from what was read. Add more in the answers or notes and try again." };

  const stamp = Date.now().toString(36);
  const settled = await Promise.allSettled(
    plan.pages.map(async (p, i) => {
      const reply = await askClaude(key, PAGE_SYSTEM, pageUser(p.title, p.brief, plan.facts), 1800);
      tally(reply.tokens);
      return parseDraft(`d${stamp}${i}`, p, reply.text);
    }),
  );
  const fresh: Draft[] = settled.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
  const gaps = gapsDraft(`d${stamp}g`, plan.gaps);
  if (gaps) fresh.push(gaps);
  if (!fresh.length) return { error: "No page could be written. Try again in a moment." };
  const failed = plan.pages.length - (gaps ? fresh.length - 1 : fresh.length);

  // Pages already added stay in the record; drafts that were never added are replaced by the new ones.
  const kept = build.drafts.filter((d) => d.state === "added");
  const { error } = await ctx.admin.from("wiki_builds").update({ answers, status: "ready", drafts: [...kept, ...fresh] }).eq("brand_id", ctx.brandId).eq("id", id);
  if (error) {
    console.error("[wiki-ai] save drafts failed:", error.message);
    return { error: "The pages were written but could not be saved. Try again." };
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "wiki.build.write", target: id, meta: { pages: fresh.length, failed, answered: Object.keys(answers).length, model: aiModel(), tokens } });
  refresh(ctx.slug);
  redirect(`/hub/b/${ctx.slug}/wiki/build/${id}${failed > 0 ? `?failed=${failed}` : ""}`);
}

/** Puts a draft into the Wiki as a page, with the "ai-draft" tag so it can be found and checked. Returns the slug, or null. */
async function addToWiki(ctx: Ctx, d: Draft): Promise<string | null> {
  const parsed = parsePage((k) => ({ title: d.title, summary: d.summary, body: d.body, type: d.type, tags: d.tags.join(",") }[k] ?? ""));
  if (!parsed.ok) return null;
  const { data: rows } = await ctx.admin.from("wiki_pages").select("slug").eq("brand_id", ctx.brandId).limit(2000);
  const taken = new Set((rows ?? []).map((r) => r.slug as string));
  const base = pageSlug(parsed.value.title);
  let slug = uniqueSlug(base, taken);
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await ctx.admin
      .from("wiki_pages")
      .insert({ ...parsed.value, ai_readable: aiDefault(d.type), slug, brand_id: ctx.brandId, created_by: ctx.user.id, updated_by: ctx.user.id })
      .select("id, slug")
      .single();
    if (!error && data) {
      await audit({ actor: ctx.user, brandId: ctx.brandId, action: "wiki.create", target: data.id as string, meta: { type: d.type, from: "ai-builder" } });
      return data.slug as string;
    }
    if (error?.code !== "23505") {
      console.error("[wiki-ai] add failed:", error?.message);
      return null;
    }
    slug = `${base.slice(0, 70)}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return null;
}

/** Step 3: add one draft (`draftId`) or all that are still new (`all`) to the Wiki, or skip one (`skip`). */
export async function reviewDrafts(fd: FormData): Promise<void> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return;
  const { ctx } = c;
  const id = str(fd, "id");
  if (!UUID.test(id)) return;
  const build = await getBuild(ctx.brandId, id);
  if (!build) return;
  const only = str(fd, "draftId");
  const skip = str(fd, "skip") === "1";
  if (!allow(`wikiadd:${ctx.user.id}`, 100)) return;

  const drafts = [...build.drafts];
  for (const d of drafts) {
    if (only ? d.id !== only : str(fd, "all") !== "1") continue;
    if (d.state === "added") continue;
    if (skip) {
      d.state = "skipped";
      continue;
    }
    const slug = await addToWiki(ctx, d);
    if (slug) {
      d.state = "added";
      d.slug = slug;
    }
  }
  const { error } = await ctx.admin.from("wiki_builds").update({ drafts }).eq("brand_id", ctx.brandId).eq("id", id);
  if (error) console.error("[wiki-ai] review save failed:", error.message);
  refresh(ctx.slug);
}

/** Deletes a run (the drafts that were never added go with it; pages already added stay). */
export async function deleteBuild(fd: FormData): Promise<void> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return;
  const { ctx } = c;
  const id = str(fd, "id");
  if (!UUID.test(id)) return;
  const { error } = await ctx.admin.from("wiki_builds").delete().eq("brand_id", ctx.brandId).eq("id", id);
  if (!error) await audit({ actor: ctx.user, brandId: ctx.brandId, action: "wiki.build.delete", target: id });
  refresh(ctx.slug);
  redirect(`/hub/b/${ctx.slug}/wiki/build`);
}
