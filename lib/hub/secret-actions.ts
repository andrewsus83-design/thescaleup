"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { audit, actorFor, getHubUser } from "./session";
import { providersFor, secretValueError } from "./providers";
import { removeSecret, saveSecret } from "./secrets";
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

const refresh = (slug: string | null) => revalidatePath(slug ? `/hub/b/${slug}/settings` : "/hub/settings");

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
