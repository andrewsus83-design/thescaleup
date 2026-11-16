"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "./actions";
import { aiModel, askClaude } from "./ai";
import { atLeast } from "./permissions";
import { allow } from "./ratelimit";
import { getBrandKey } from "./secrets";
import { audit } from "./session";
import { MAX, brandNotes, findTemplate, isChannel, parseItem, titleFor, writeSystem, writeUser } from "./content/model";
import { UUID, str, taskContext, type Ctx } from "./tasks/context";

const NO_KEY = "Add an Anthropic key in Settings → Integrations to write with AI.";
const BUSY = "That is a lot of AI requests in an hour. Try again later.";
const refresh = (slug: string) => revalidatePath(`/hub/b/${slug}`, "layout");

/** Who is asking and whether their Content access lets them change things. */
async function editContext(fd: FormData): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const c = await taskContext(str(fd, "brandId"), "content");
  if (!c.ok) return c;
  if (!atLeast(c.ctx.level, "edit")) return { ok: false, error: "You can read content here but not change it." };
  return c;
}

/** Creates a piece (no id) or saves changes to one (id). A new piece opens in its own page afterwards. */
export async function saveItem(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await editContext(fd);
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const parsed = parseItem((k) => str(fd, k));
  if (!parsed.ok) return { error: parsed.error };
  const id = str(fd, "id");
  if (id) {
    if (!UUID.test(id)) return { error: "That piece no longer exists." };
    const { data, error } = await ctx.admin.from("content_items").update(parsed.value).eq("brand_id", ctx.brandId).eq("id", id).select("id").maybeSingle();
    if (error) return { error: "Could not save. Try again." };
    if (!data) return { error: "That piece no longer exists." };
    await audit({ actor: ctx.user, brandId: ctx.brandId, action: "content.update", target: id, meta: { status: parsed.value.status } });
    refresh(ctx.slug);
    return { message: "Saved." };
  }
  const { data, error } = await ctx.admin.from("content_items").insert({ ...parsed.value, brand_id: ctx.brandId, created_by: ctx.user.id }).select("id").single();
  if (error || !data) {
    console.error("[content] insert failed:", error?.message);
    return { error: "Could not save. Try again." };
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "content.create", target: data.id as string });
  refresh(ctx.slug);
  redirect(`/hub/b/${ctx.slug}/content/${data.id}`);
}

export async function deleteItem(fd: FormData): Promise<void> {
  const c = await editContext(fd);
  const id = str(fd, "id");
  if (!c.ok || !UUID.test(id)) return;
  const { ctx } = c;
  await ctx.admin.from("content_items").delete().eq("brand_id", ctx.brandId).eq("id", id);
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "content.delete", target: id });
  refresh(ctx.slug);
  redirect(`/hub/b/${ctx.slug}/content`);
}

/** A template and a brief in, a draft piece out. It is saved as a draft with no day, and opens for editing. */
export async function writeContent(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await editContext(fd);
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const template = findTemplate(str(fd, "template"));
  if (!template) return { error: "Pick what to write." };
  const brief = str(fd, "brief").trim();
  if (brief.length < 10) return { error: "Say what it is about in a sentence or two first." };
  if (brief.length > MAX.brief) return { error: `That is too long. Keep it under ${MAX.brief.toLocaleString("en-US")} characters.` };
  const rawChannel = str(fd, "channel");
  const channel = template.usesChannel && isChannel(rawChannel) ? rawChannel : null;
  if (!allow(`ai:${ctx.user.id}`, 12)) return { error: BUSY };

  const key = await getBrandKey(ctx.brandId, "claude", true);
  if (!key) return { error: NO_KEY };
  const { data: brand } = await ctx.admin.from("brands").select("name, profile").eq("id", ctx.brandId).maybeSingle();

  let reply: Awaited<ReturnType<typeof askClaude>>;
  try {
    reply = await askClaude(key, writeSystem((brand?.name as string) ?? "", brandNotes(brand?.profile), template, channel), writeUser(brief), 1500);
  } catch (e) {
    console.error("[content] write failed:", e instanceof Error ? e.message : e);
    return { error: "The AI request failed. Check the Anthropic key in Settings and try again." };
  }
  const text = reply.text.trim().slice(0, MAX.body);
  if (!text) return { error: "Nothing came back. Add a little more detail and try again." };

  const { data, error } = await ctx.admin
    .from("content_items")
    .insert({ brand_id: ctx.brandId, title: titleFor(template, brief), body: text, kind: template.id, channel, status: "draft", source: "ai", created_by: ctx.user.id })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[content] ai insert failed:", error?.message);
    return { error: "Could not save the draft. Try again." };
  }
  // The brief and the text are not logged, only how much was used.
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "content.ai", target: data.id as string, meta: { template: template.id, chars: brief.length, model: aiModel(), tokens: reply.tokens } });
  refresh(ctx.slug);
  redirect(`/hub/b/${ctx.slug}/content/${data.id}`);
}
