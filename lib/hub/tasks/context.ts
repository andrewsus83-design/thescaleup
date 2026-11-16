import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { accessFor } from "../access";
import { MFA_REQUIRED, mfaPassed } from "../mfa";
import type { Fn, Level } from "../permissions";
import type { Actor } from "../rules";
import { actorFor, getHubUser, type HubUser } from "../session";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");

export type Ctx = {
  user: HubUser;
  brandId: string;
  slug: string;
  actor: Actor;
  level: Level;
  admin: ReturnType<typeof createSupabaseAdminClient>;
  /** What the rules in rules.ts need. */
  who: { actor: Actor; level: Level; userId: string };
};

/**
 * Every task action starts here: who is signed in, what they are in this brand, and what the access matrix gives that role
 * on `fn`. The service role skips database policies, so nothing below this line trusts the browser.
 */
export async function taskContext(brandId: unknown, fn: Fn = "tasks"): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const user = await getHubUser();
  if (!user) return { ok: false, error: "Your session ended. Sign in again." };
  if (typeof brandId !== "string" || !UUID.test(brandId)) return { ok: false, error: "Unknown brand." };
  const actor = await actorFor(user, brandId);
  if (!actor) return { ok: false, error: "Unknown brand." };
  const admin = createSupabaseAdminClient();
  const { data: brand } = await admin.from("brands").select("slug, status").eq("id", brandId).maybeSingle();
  if (!brand) return { ok: false, error: "Unknown brand." };
  if (brand.status === "archived") return { ok: false, error: "This brand is archived." };
  const access = await accessFor(brandId, actor);
  const level = access[fn];
  if (fn === "mail" && !(await mfaPassed())) return { ok: false, error: MFA_REQUIRED };
  return { ok: true, ctx: { user, brandId, slug: brand.slug as string, actor, level, admin, who: { actor, level, userId: user.id } } };
}
