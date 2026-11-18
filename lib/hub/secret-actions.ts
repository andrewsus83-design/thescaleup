"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { audit, actorFor, getHubUser } from "./session";
import { PROVIDERS, fallsBack, providersFor, secretValueError } from "./providers";
import { getKeys, removeSecret, saveSecret } from "./secrets";
import { allow } from "./ratelimit";
import { checkSpec, result, type CheckResult } from "./key-check-model";
import { runCheck } from "./key-check";
import type { FormState } from "./actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");

/** Who may change keys: the agency owner for workspace keys; the agency owner or the brand's founder for a brand's keys. */
async function authorize(scope: string): Promise<{ ok: true; brandId: string | null; slug: string | null; user: NonNullable<Awaited<ReturnType<typeof getHubUser>>> } | { ok: false; error: string }> {
  const user = await getHubUser();
  if (!user) return { ok: false, error: "Your session ended. Sign in again." };
  if (scope === "workspace") {
    return user.isOwner ? { ok: true, brandId: null, slug: null, user } : { ok: false, error: "Only the agency owner can change the workspace keys." };
  }
  if (!UUID.test(scope)) return { ok: false, error: "Unknown brand." };
  const actor = await actorFor(user, scope);
  if (actor !== "owner" && actor !== "founder") return { ok: false, error: "Only the founder or the agency owner can change a brand's keys." };
  const { data } = await createSupabaseAdminClient().from("brands").select("slug").eq("id", scope).maybeSingle();
  if (!data) return { ok: false, error: "Unknown brand." };
  return { ok: true, brandId: scope, slug: data.slug, user };
}

// "layout" also refreshes the sub-pages (Integrations, Social connections) that show these keys.
const refresh = (slug: string | null) => (slug ? revalidatePath(`/hub/b/${slug}/settings`, "layout") : revalidatePath("/hub/settings"));

export async function saveSecretAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const scope = str(fd, "scope");
  const provider = str(fd, "provider");
  const value = str(fd, "value").trim();
  const auth = await authorize(scope);
  if (!auth.ok) return { error: auth.error };
  if (!providersFor(auth.brandId ? "brand" : "workspace").some((p) => p.key === provider)) return { error: "Unknown provider." };
  const bad = secretValueError(value);
  if (bad) return { error: bad };

  const res = await saveSecret(auth.brandId, provider, value, auth.user.id);
  if (!res.ok) return { error: res.error };
  await audit({ actor: auth.user, brandId: auth.brandId, action: "secret.set", target: provider });
  refresh(auth.slug);
  return { message: "Saved." };
}

export async function removeSecretAction(fd: FormData): Promise<void> {
  const scope = str(fd, "scope");
  const provider = str(fd, "provider");
  const auth = await authorize(scope);
  if (!auth.ok || !providersFor(auth.brandId ? "brand" : "workspace").some((p) => p.key === provider)) return;
  await removeSecret(auth.brandId, provider);
  await audit({ actor: auth.user, brandId: auth.brandId, action: "secret.remove", target: provider });
  refresh(auth.slug);
}

/**
 * "Check connection": asks the provider one cheap question with the key this scope really uses (the brand's own key, or the
 * workspace default it falls back to) and says what came back. Same people as saving a key. Returns text only, never a key.
 */
export async function checkKeyAction(scope: string, provider: string): Promise<CheckResult> {
  if (typeof scope !== "string" || typeof provider !== "string") return result("error", "Unknown key.");
  const auth = await authorize(scope);
  if (!auth.ok) return result("error", auth.error);
  const def = providersFor(auth.brandId ? "brand" : "workspace").find((p) => p.key === provider);
  const spec = checkSpec(provider);
  if (!def || !spec) return result("error", "That key cannot be checked yet.");
  if (!allow(`keycheck:${auth.user.id}`, 60)) return result("error", "That is a lot of checks. Try again in a few minutes.");
  if (spec.cost !== "free" && !allow(`keycheck-paid:${auth.user.id}`, 10)) return result("error", "That check costs a little each time, so it is limited. Try again later.");

  const need = spec.needs ?? [provider];
  // A pair only works when its other half comes from the same place the app reads it, so both halves follow the same fallback rule.
  const fallback = auth.brandId ? need.every((k) => { const d = PROVIDERS.find((p) => p.key === k); return d ? fallsBack(d) : false; }) : false;
  const keys = await getKeys(auth.brandId, need, fallback);
  const out = need.some((k) => !keys[k])
    ? result("missing", need.length > 1 && need.some((k) => keys[k]) ? `${spec.label} needs both the login and the password. Save the missing one too.` : "The saved key could not be read. Save it again.")
    : await runCheck(provider, keys);

  await audit({ actor: auth.user, brandId: auth.brandId, action: "secret.check", target: provider, meta: { status: out.status } });
  return out;
}
