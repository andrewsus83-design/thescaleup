import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { atLeast, isConfigurableRole, isFn, isLevel, resolveAccess, type Access, type Fn, type Level, type Overrides } from "./permissions";
import type { Actor } from "./rules";
import { requireBrand } from "./session";

/** The stored changes for one role in one brand (the rest is the defaults). */
export const loadOverrides = cache(async (brandId: string, role: string): Promise<Overrides> => {
  if (!isConfigurableRole(role)) return {};
  const { data } = await createSupabaseAdminClient().from("brand_role_permissions").select("fn, level").eq("brand_id", brandId).eq("role", role);
  const out: Overrides = {};
  for (const r of data ?? []) if (isFn(r.fn) && isLevel(r.level)) out[r.fn] = r.level;
  return out;
});

/** What this person can open and change in this brand. */
export async function accessFor(brandId: string, actor: Actor): Promise<Access> {
  return resolveAccess(actor, actor === "owner" || actor === "founder" ? {} : await loadOverrides(brandId, actor));
}

/** For a page: the brand and the person, or a 404 when their role has less than `min` on this function. */
export async function requireFunction(slug: string, fn: Fn, min: Level = "view") {
  const ctx = await requireBrand(slug);
  const access = await accessFor(ctx.brand.id, ctx.actor);
  if (!atLeast(access[fn], min)) notFound();
  return { ...ctx, access };
}
