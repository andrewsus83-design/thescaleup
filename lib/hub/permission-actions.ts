"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "./actions";
import { FUNCTIONS, canEditRole, parseLevels } from "./permissions";
import { actorFor, audit, getHubUser } from "./session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");

async function authorize(fd: FormData) {
  const user = await getHubUser();
  if (!user) return { ok: false as const, error: "Your session ended. Sign in again." };
  const brandId = str(fd, "brandId");
  const role = str(fd, "role");
  if (!UUID.test(brandId)) return { ok: false as const, error: "Unknown brand." };
  const actor = await actorFor(user, brandId);
  if (!canEditRole(actor, role as never)) return { ok: false as const, error: "You cannot change access for that role." };
  const { data } = await createSupabaseAdminClient().from("brands").select("slug").eq("id", brandId).maybeSingle();
  if (!data) return { ok: false as const, error: "Unknown brand." };
  return { ok: true as const, user, brandId, role, slug: data.slug as string };
}

// The menu and every page read these rows, so refresh the whole brand area.
const refresh = (slug: string) => revalidatePath(`/hub/b/${slug}`, "layout");

export async function savePermissions(_prev: FormState, fd: FormData): Promise<FormState> {
  const auth = await authorize(fd);
  if (!auth.ok) return { error: auth.error };
  const levels = parseLevels((name) => (typeof fd.get(name) === "string" ? (fd.get(name) as string) : null));
  if (!levels) return { error: "Something in the form was not valid. Reload and try again." };

  const rows = FUNCTIONS.map((fn) => ({ brand_id: auth.brandId, role: auth.role, fn, level: levels[fn], updated_by: auth.user.id }));
  const { error } = await createSupabaseAdminClient().from("brand_role_permissions").upsert(rows, { onConflict: "brand_id,role,fn" });
  if (error) {
    console.error("[hub] savePermissions failed:", error.message);
    return { error: "Could not save. Try again." };
  }
  await audit({ actor: auth.user, brandId: auth.brandId, action: "permissions.set", target: auth.role, meta: { levels } });
  refresh(auth.slug);
  return { message: "Saved." };
}

/** Back to the defaults for one role: delete the stored changes. */
export async function resetPermissions(fd: FormData): Promise<void> {
  const auth = await authorize(fd);
  if (!auth.ok) return;
  await createSupabaseAdminClient().from("brand_role_permissions").delete().eq("brand_id", auth.brandId).eq("role", auth.role);
  await audit({ actor: auth.user, brandId: auth.brandId, action: "permissions.reset", target: auth.role });
  refresh(auth.slug);
}
