"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { site } from "@/lib/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allow } from "../ratelimit";
import { canManageTeam } from "../rules";
import { actorFor, audit, getHubUser } from "../session";
import { agencyKey, disconnectAccounts, ensureProfile, forgetAccounts, listAccounts, startConnect } from "../zernio/api";
import { doneUrl, isPlatform, NO_AGENCY_KEY, OBJECT_ID, redirectOrigin } from "../zernio/model";

// The connect toggle on Settings, Social media connections. Who may use it: the agency owner and the brand's founder, the same people who
// could manage the team. The profile always comes from the brand, never from the browser, so one brand cannot connect into another.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StartResult = { ok: true; authUrl: string } | { ok: false; error: string };
export type DisconnectResult = { ok: true; removed: number } | { ok: false; error: string };

async function authorize(brandId: unknown) {
  if (typeof brandId !== "string" || !UUID.test(brandId)) return { ok: false as const, error: "Unknown brand." };
  const user = await getHubUser();
  if (!user) return { ok: false as const, error: "Your session ended. Sign in again." };
  if (!canManageTeam(await actorFor(user, brandId))) return { ok: false as const, error: "Only the founder or the agency owner can connect accounts." };
  const { data } = await createSupabaseAdminClient().from("brands").select("id, slug, name").eq("id", brandId).maybeSingle();
  if (!data) return { ok: false as const, error: "Unknown brand." };
  return { ok: true as const, user, brand: data as { id: string; slug: string; name: string } };
}

/** Starts the connection of one platform and returns the address for the pop-up. Nothing is connected until the person approves there. */
export async function startConnectAction(brandId: string, platform: string): Promise<StartResult> {
  const auth = await authorize(brandId);
  if (!auth.ok) return auth;
  if (!isPlatform(platform)) return { ok: false, error: "That platform cannot be connected here yet." };
  if (!allow(`zconnect:${auth.user.id}`, 40)) return { ok: false, error: "That is a lot of connection attempts. Try again in a while." };

  const key = await agencyKey();
  if (!key) return { ok: false, error: NO_AGENCY_KEY };
  const profile = await ensureProfile(key, auth.brand.id, auth.brand.name);
  if (!profile.ok) return { ok: false, error: profile.problem.message };

  const origin = redirectOrigin((await headers()).get("host"), site.url);
  const started = await startConnect(key, profile.id, platform, doneUrl(origin), auth.brand.name);
  if (!started.ok) return { ok: false, error: started.problem.message };
  await audit({ actor: auth.user, brandId: auth.brand.id, action: "social.connect.start", target: platform });
  return { ok: true, authUrl: started.authUrl };
}

/**
 * Removes accounts from this brand: one account, or every account of one platform. Only accounts on this brand's own profile can be removed.
 * The posts and numbers Zernio already holds are Zernio's to keep or drop; the hub just stops reading them.
 */
export async function disconnectAction(brandId: string, platform: string, accountId?: string): Promise<DisconnectResult> {
  const auth = await authorize(brandId);
  if (!auth.ok) return auth;
  if (!isPlatform(platform)) return { ok: false, error: "That platform cannot be changed here." };
  if (accountId !== undefined && (typeof accountId !== "string" || !OBJECT_ID.test(accountId))) return { ok: false, error: "That account is not valid." };
  if (!allow(`zdisconnect:${auth.user.id}`, 40)) return { ok: false, error: "That is a lot of changes. Try again in a while." };

  const key = await agencyKey();
  if (!key) return { ok: false, error: NO_AGENCY_KEY };
  // The profile is looked up, never made, here: a brand with no profile has nothing to remove.
  const profile = await ensureProfile(key, auth.brand.id, auth.brand.name);
  if (!profile.ok) return { ok: false, error: profile.problem.message };
  const listed = await listAccounts(key, profile.id, true);
  if (!listed.ok) return { ok: false, error: listed.problem.message };
  const ids = listed.accounts.filter((a) => a.platform === platform && (accountId === undefined || a.id === accountId)).map((a) => a.id);
  if (ids.length === 0) return { ok: true, removed: 0 };

  const done = await disconnectAccounts(key, profile.id, ids);
  forgetAccounts(profile.id);
  if (done.removed > 0) await audit({ actor: auth.user, brandId: auth.brand.id, action: "social.disconnect", target: platform, meta: { removed: done.removed } });
  revalidatePath(`/hub/b/${auth.brand.slug}`, "layout");
  return done.ok ? { ok: true, removed: done.removed } : { ok: false, error: done.problem.message };
}
