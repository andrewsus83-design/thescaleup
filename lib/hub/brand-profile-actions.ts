"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "./actions";
import { aiModel, askClaude } from "./ai";
import { getProfile } from "./brand-profile/data";
import { PROFILE_SYSTEM, changedKeys, mergeProfile, parseProfileDraft, parseProfileForm, type DraftState } from "./brand-profile/model";
import { atLeast } from "./permissions";
import { allow } from "./ratelimit";
import { getBrandKey } from "./secrets";
import { audit } from "./session";
import { str, taskContext, type Ctx } from "./tasks/context";
import { parseSources, sourcesUser } from "./wiki/build";
import { readSources } from "./wiki/read";

// The brand profile: saved by hand, or drafted by the AI from the brand's own website and social pages. The AI never saves anything:
// it hands a draft back to the page, and a person looks at it, changes it and presses Save.

const NO_KEY = "Add an Anthropic key in Settings → Integrations to use AI.";
const BUSY = "That is a lot of AI work in an hour. Try again later.";
const refresh = (slug: string) => revalidatePath(`/hub/b/${slug}`, "layout");

async function editContext(brandId: unknown): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const c = await taskContext(brandId, "brand");
  if (!c.ok) return c;
  if (!atLeast(c.ctx.level, "edit")) return { ok: false, error: "You can see the brand profile here but not change it." };
  return c;
}

/** Saves the profile, the website and the social accounts. A field left empty is cleared. */
export async function saveProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const parsed = parseProfileForm((k) => str(fd, k));
  if (!parsed.ok) return { error: parsed.error };
  if (!allow(`brandprofile-save:${ctx.user.id}`, 60)) return { error: "That is a lot of saving in an hour. Try again a bit later." };

  const current = await getProfile(ctx.brandId);
  if (!current) return { error: "Could not read the brand. Try again." };
  // What the person was looking at when they pressed Save. If someone else saved since, they would be overwriting without knowing.
  const seen = Number(str(fd, "version"));
  if (Number.isFinite(seen) && seen > 0 && seen !== current.version) return { error: "Someone else saved this profile while you were editing. Reload the page to see their changes, then try again." };

  const next = parsed.value;
  const changed = changedKeys(current.value, next);
  if (!changed.length) return { message: "Nothing changed." };
  const { data, error } = await ctx.admin
    .from("brands")
    .update({ profile: mergeProfile(current.raw, next), website: next.website, profile_version: current.version + 1 })
    .eq("id", ctx.brandId)
    .eq("profile_version", current.version)
    .select("id");
  if (error) {
    console.error("[brand-profile] save failed:", error.message);
    return { error: "Could not save the profile. Try again." };
  }
  if (!data?.length) return { error: "Someone else saved this profile at the same moment. Reload the page and try again." };
  // Names of what changed, never the text.
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "brand.profile.save", meta: { changed } });
  refresh(ctx.slug);
  return { message: "Profile saved." };
}

/** Reads the sources and drafts the profile. Nothing is saved: the page shows the draft in the form for a person to check. */
export async function draftProfile(_prev: DraftState, fd: FormData): Promise<DraftState> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const parsed = parseSources((k) => str(fd, k));
  if (!parsed.ok) return { error: parsed.error };
  if (!allow(`brandprofile-ai:${ctx.user.id}`, 6) || !allow(`brandprofile-ai-brand:${ctx.brandId}`, 12)) return { error: BUSY };
  const key = await getBrandKey(ctx.brandId, "claude", true);
  if (!key) return { error: NO_KEY };

  const { read, digest } = await readSources(parsed.value);
  const notes = read.map((r) => ({ label: r.label, ok: r.ok, note: r.note }));
  if (digest.length < 150) {
    const why = read.filter((r) => !r.ok).map((r) => `${r.label}: ${r.note}`).join(" ");
    return { error: `Not enough could be read to fill this in. ${why} Add a few lines about the brand in the notes box, or check the addresses.`.trim(), read: notes };
  }

  let reply: Awaited<ReturnType<typeof askClaude>>;
  try {
    reply = await askClaude(key, PROFILE_SYSTEM, sourcesUser(digest), 1500);
  } catch (e) {
    console.error("[brand-profile] draft failed:", e instanceof Error ? e.message : e);
    return { error: "The AI request failed. Check the Anthropic key in Settings and try again.", read: notes };
  }
  const draft = parseProfileDraft(reply.text);
  if (!draft) return { error: "The AI did not return a usable draft. Try again.", read: notes };

  await audit({
    actor: ctx.user,
    brandId: ctx.brandId,
    action: "brand.profile.ai",
    meta: { read: read.filter((r) => r.ok).length, failed: read.filter((r) => !r.ok).length, filled: Object.keys(draft.fields).length, model: aiModel(), tokens: reply.tokens },
  });
  return { message: "Drafted. Check each answer, change what is wrong, then save.", stamp: Date.now(), draft, read: notes };
}
