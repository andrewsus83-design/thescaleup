"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "./actions";
import { aiModel } from "./ai";
import { FIND, parseBrief } from "./leads/model";
import { findBusinesses } from "./leads/run";
import { addToCrm, saveSearch, skipIn } from "./leads/store";
import { atLeast } from "./permissions";
import { allow } from "./ratelimit";
import { getBrandKey } from "./secrets";
import { audit } from "./session";
import { UUID, str, taskContext, type Ctx } from "./tasks/context";

// The AI leads finder. A person describes the kind of business they want; the AI searches the public web and names businesses; the app
// opens each one's own website to confirm it and read the contact details it publishes. Nothing becomes a lead on its own: the person
// ticks the ones they want and adds them, and every lead added this way is tagged "ai-found" and can be undone from the import history.
// Cost control: at most FIND.searches web searches per run, an hourly limit per person and per brand, the brand's own Anthropic key,
// and the token and search counts in the audit log.

const NO_KEY = "Add an Anthropic key in Settings → Integrations to use AI.";
const BUSY = "That is a lot of searching in an hour. Try again later.";
const MISSING = "The leads finder needs its database step first (20261117410000_lead_finder.sql). Ask the person who runs the database updates.";
const refresh = (slug: string) => revalidatePath(`/hub/b/${slug}`, "layout");

async function editContext(brandId: unknown): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const c = await taskContext(brandId, "crm");
  if (!c.ok) return c;
  if (!atLeast(c.ctx.level, "edit")) return { ok: false, error: "You can see the CRM here but not change it." };
  return c;
}

/** Searches the web for the brief, checks what the AI named, saves the run and opens it. */
export async function findLeads(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const parsed = parseBrief((k) => str(fd, k));
  if (!parsed.ok) return { error: parsed.error };
  const brief = parsed.value;
  if (!allow(`leads:${ctx.user.id}`, FIND.perUserHour) || !allow(`leads-brand:${ctx.brandId}`, FIND.perBrandHour)) return { error: BUSY };
  const key = await getBrandKey(ctx.brandId, "claude", true);
  if (!key) return { error: NO_KEY };
  // Before any search cost: is the table there?
  const probe = await ctx.admin.from("lead_searches").select("id").eq("brand_id", ctx.brandId).limit(1);
  if (probe.error) {
    console.error("[leads] lead_searches not ready:", probe.error.message);
    return { error: MISSING };
  }

  const res = await findBusinesses(key, brief);
  if (!res.ok) return { error: res.error };

  const saved = await saveSearch(ctx.admin, ctx.brandId, ctx.user.id, brief, res);
  if (!saved) return { error: "The search ran but could not be saved. Try again." };
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.leads.find", target: saved.id, meta: { found: saved.kept, searches: res.searches, model: aiModel(), tokens: res.tokens } });
  refresh(ctx.slug);
  redirect(`/hub/b/${ctx.slug}/crm/find/${saved.id}`);
}

export type DecideResult = { ok: true; message: string } | { ok: false; error: string };

function pickIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > FIND.addMax) return null;
  const ids = raw.filter((x): x is string => typeof x === "string" && UUID.test(x));
  return ids.length === raw.length ? [...new Set(ids)] : null;
}

/** Adds the ticked businesses to the CRM as leads, tagged "ai-found". Anyone already in the CRM is left alone by the database. */
export async function addCandidates(input: { brandId: string; searchId: string; ids: string[] }): Promise<DecideResult> {
  const c = await editContext(input?.brandId);
  if (!c.ok) return { ok: false, error: c.error };
  const { ctx } = c;
  const ids = pickIds(input.ids);
  if (!ids) return { ok: false, error: `Pick between 1 and ${FIND.addMax} businesses.` };
  if (typeof input.searchId !== "string" || !UUID.test(input.searchId)) return { ok: false, error: "That search no longer exists." };
  if (!allow(`leads-add:${ctx.user.id}`, 60)) return { ok: false, error: "That is a lot of adding in an hour. Try again a bit later." };

  const r = await addToCrm(ctx.admin, ctx.brandId, ctx.user.id, input.searchId, ids);
  if (!r.ok) return r;
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.leads.add", target: r.importId ?? input.searchId, meta: { search: input.searchId, created: r.created ?? 0, skipped: r.skipped ?? 0 } });
  refresh(ctx.slug);
  return { ok: true, message: r.message };
}

/** Marks businesses as not wanted, so they are never shown again. With no `ids`, every business still waiting in the search. */
export async function skipCandidates(input: { brandId: string; searchId: string; ids?: string[] }): Promise<DecideResult> {
  const c = await editContext(input?.brandId);
  if (!c.ok) return { ok: false, error: c.error };
  const { ctx } = c;
  if (typeof input.searchId !== "string" || !UUID.test(input.searchId)) return { ok: false, error: "That search no longer exists." };
  const ids = input.ids === undefined ? null : pickIds(input.ids);
  if (input.ids !== undefined && !ids) return { ok: false, error: `Pick between 1 and ${FIND.addMax} businesses.` };
  const n = await skipIn(ctx.admin, ctx.brandId, ctx.user.id, input.searchId, ids);
  if (n === null) return { ok: false, error: "Could not skip them. Try again." };
  if (n > 0) {
    await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.leads.skip", target: input.searchId, meta: { count: n } });
    refresh(ctx.slug);
  }
  return { ok: true, message: n === 0 ? "Nothing to skip." : `Skipped ${n}. They will not be shown again.` };
}
