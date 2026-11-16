import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Actor } from "./rules";
import { isBrandRole } from "./rules";

export type HubUser = { id: string; email: string; isOwner: boolean };

/** The signed-in person (Supabase Auth session), or null. Owner status comes from the platform_admins table. */
export const getHubUser = cache(async (): Promise<HubUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  const email = u?.email?.toLowerCase();
  if (!u || !email || !u.email_confirmed_at) return null;
  const admin = createSupabaseAdminClient();
  const { data: row } = await admin.from("platform_admins").select("user_id").eq("user_id", u.id).maybeSingle();
  return { id: u.id, email, isOwner: !!row };
});

export async function requireHubUser(next = "/hub"): Promise<HubUser> {
  const u = await getHubUser();
  if (!u) redirect(`/hub/login?next=${encodeURIComponent(next)}`);
  return u;
}

export type BrandRow = { id: string; slug: string; name: string; website: string | null; status: string };

/** Brands the person can see. Row level security does the filtering, so this is the same list the database allows. */
export async function listMyBrands(): Promise<BrandRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("brands").select("id, slug, name, website, status").neq("status", "archived").order("name");
  return (data ?? []) as BrandRow[];
}

/** The brand plus what this person is in it. 404 when they have no access (never reveals that the brand exists).
 *  Cached per request: the layout and the page both ask, and the second ask must not hit the database again. */
export const requireBrand = cache(async (slug: string): Promise<{ user: HubUser; brand: BrandRow; actor: Actor }> => {
  const user = await requireHubUser(`/hub/b/${slug}`);
  const supabase = await createSupabaseServerClient();
  const { data: brand } = await supabase.from("brands").select("id, slug, name, website, status").eq("slug", slug).maybeSingle();
  if (!brand) notFound();
  const actor = await actorFor(user, brand.id);
  if (!actor) notFound();
  return { user, brand: brand as BrandRow, actor };
});

/** Server-side role lookup used by every mutation (the service role skips RLS, so each action re-checks here). */
export async function actorFor(user: HubUser, brandId: string): Promise<Actor | null> {
  if (user.isOwner) return "owner";
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("brand_members").select("role").eq("brand_id", brandId).eq("user_id", user.id).maybeSingle();
  return data && isBrandRole(data.role) ? data.role : null;
}

export async function audit(entry: { actor: HubUser; brandId?: string | null; action: string; target?: string; meta?: Record<string, unknown> }) {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("audit_log").insert({
      actor_id: entry.actor.id,
      actor_email: entry.actor.email,
      brand_id: entry.brandId ?? null,
      action: entry.action,
      target: entry.target ?? null,
      meta: entry.meta ?? {},
    });
  } catch {
    /* the audit trail must never break the action itself */
  }
}
