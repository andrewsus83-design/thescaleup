"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin/config";
import { site } from "@/lib/site";
import { audit, actorFor, getHubUser } from "./session";
import { inviteMail, isMailConfigured, loginCodeMail, sendMail } from "./mail";
import { canInvite, canManageTeam, canRemove, isBrandRole, isEmail, normalizeEmail, passwordError, safeNext, ROLE_LABEL } from "./rules";
import { slugError } from "./slug";
import { hashToken, looksLikeToken, newInviteToken } from "./tokens";

export type FormState = {
  error?: string;
  message?: string;
  step?: "code";
  email?: string;
  inviteUrl?: string;
  emailed?: boolean;
};

const baseUrl = () => (process.env.HUB_BASE_URL || site.url).replace(/\/+$/, "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");

// ------------------------------------------------------------------ rate limit (per serverless instance, like /admin/access)
const hits = new Map<string, { n: number; reset: number }>();
function allow(key: string, max: number, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  if (hits.size > 5000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
  const e = hits.get(key);
  if (!e || now > e.reset) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (e.n >= max) return false;
  e.n++;
  return true;
}
async function clientIp(): Promise<string> {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// ------------------------------------------------------------------ sign in
/** Sends a 6-digit code, but only to emails that already have access (an owner, a member, or an open invite). */
export async function requestLoginCode(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = normalizeEmail(str(fd, "email"));
  if (!isEmail(email)) return { error: "Enter a valid email address." };
  if (!isMailConfigured()) return { error: "Sign-in email is not set up yet. Ask the agency owner to finish the email setup." };

  const ip = await clientIp();
  if (!allow(`code:ip:${ip}`, 20) || !allow(`code:email:${email}`, 5)) {
    return { error: "Too many attempts. Try again in 15 minutes." };
  }

  const generic: FormState = { step: "code", email, message: "If this email has access, a sign-in code is on its way." };
  try {
    const admin = createSupabaseAdminClient();
    let userId: string | null = null;
    const { data: found } = await admin.rpc("user_id_by_email", { p_email: email });
    if (typeof found === "string") userId = found;

    let known = isAdminEmail(email);
    if (!known && userId) {
      const { count } = await admin.from("brand_members").select("brand_id", { count: "exact", head: true }).eq("user_id", userId);
      known = (count ?? 0) > 0;
    }
    if (!known) {
      const { count } = await admin
        .from("brand_invites")
        .select("id", { count: "exact", head: true })
        .eq("email", email)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString());
      known = (count ?? 0) > 0;
    }
    if (!known) return generic;

    if (!userId) {
      const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
      if (error && !/already|registered|exists/i.test(error.message)) throw error;
    }
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const code = data?.properties?.email_otp;
    if (error || !code) throw error ?? new Error("no code returned");
    const mail = loginCodeMail(code);
    const sent = await sendMail({ to: email, ...mail });
    if (!sent.ok) console.error("[hub] login code email failed:", sent.error);
  } catch (e) {
    console.error("[hub] requestLoginCode failed:", e instanceof Error ? e.message : e);
  }
  return generic;
}

export async function verifyLoginCode(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = normalizeEmail(str(fd, "email"));
  const code = str(fd, "code").replace(/\s+/g, "");
  const next = safeNext(str(fd, "next"));
  if (!isEmail(email) || !/^\d{6,10}$/.test(code)) return { step: "code", email, error: "Enter the code from the email." };
  if (!allow(`verify:email:${email}`, 10) || !allow(`verify:ip:${await clientIp()}`, 30)) {
    return { step: "code", email, error: "Too many attempts. Try again in 15 minutes." };
  }

  const supabase = await createSupabaseServerClient();
  let user = null;
  for (const type of ["email", "magiclink"] as const) {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type });
    if (!error && data.user) {
      user = data.user;
      break;
    }
  }
  if (!user) return { step: "code", email, error: "That code is wrong or expired. Request a new one." };

  await seedPlatformOwner(user);
  redirect(next);
}

/** Agency owners (ADMIN_EMAILS) become platform owners once their email is verified. */
async function seedPlatformOwner(user: User): Promise<void> {
  if (!user.email || !isAdminEmail(user.email) || !user.email_confirmed_at) return;
  try {
    await createSupabaseAdminClient().from("platform_admins").upsert({ user_id: user.id, email: user.email.toLowerCase() }, { onConflict: "user_id" });
  } catch (e) {
    console.error("[hub] platform_admins upsert failed:", e instanceof Error ? e.message : e);
  }
}

/**
 * Email + password. Only passwords that were set through this app count (app_metadata.hub_password, writable by the
 * server only). That way a password planted on an account before its owner ever signed in is useless.
 */
export async function signInWithPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = normalizeEmail(str(fd, "email"));
  const password = str(fd, "password");
  const next = safeNext(str(fd, "next"));
  if (!isEmail(email) || !password) return { error: "Enter your email and password." };
  if (!allow(`pw:email:${email}`, 8) || !allow(`pw:ip:${await clientIp()}`, 30)) {
    return { error: "Too many attempts. Try again in 15 minutes." };
  }
  const wrong = { error: "Wrong email or password. No password yet? Use an email code, then set one under Account." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return wrong;
  if (!data.user.email_confirmed_at || data.user.app_metadata?.hub_password !== true) {
    await supabase.auth.signOut();
    return wrong;
  }
  await seedPlatformOwner(data.user);
  redirect(next);
}

/** Sets or changes the signed-in person's password. */
export async function setPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getHubUser();
  if (!user) return { error: "Your session ended. Sign in again." };
  const pw = str(fd, "password");
  if (pw !== str(fd, "confirm")) return { error: "The two passwords do not match." };
  const bad = passwordError(pw, user.email);
  if (bad) return { error: bad };
  if (!allow(`setpw:${user.id}`, 10)) return { error: "Too many attempts. Try again in 15 minutes." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) return { error: error.message };
  const { error: metaError } = await createSupabaseAdminClient().auth.admin.updateUserById(user.id, { app_metadata: { hub_password: true } });
  if (metaError) {
    console.error("[hub] could not flag password:", metaError.message);
    return { error: "The password was saved but could not be activated. Try again." };
  }
  await audit({ actor: user, action: "password.set" });
  return { message: "Password saved. You can now sign in with your email and password." };
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/hub/login");
}

// ------------------------------------------------------------------ brands
export async function createBrand(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getHubUser();
  if (!user?.isOwner) return { error: "Only the agency owner can add a brand." };

  const name = str(fd, "name").trim();
  const slug = str(fd, "slug").trim().toLowerCase();
  let website: string | null = null;
  const rawSite = str(fd, "website").trim();
  if (!name || name.length > 80) return { error: "Enter the brand name (up to 80 characters)." };
  const se = slugError(slug);
  if (se) return { error: `Address: ${se}` };
  if (rawSite) {
    try {
      const u = new URL(/^https?:\/\//i.test(rawSite) ? rawSite : `https://${rawSite}`);
      if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) throw new Error("bad");
      website = u.toString();
    } catch {
      return { error: "That website address does not look right." };
    }
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("brands").insert({ slug, name, website, status: "active", created_by: user.id }).select("id").single();
  if (error || !data) {
    if (error?.code === "23505") return { error: "That address is already taken." };
    if (error?.code === "23514") return { error: "That address is not allowed." };
    console.error("[hub] createBrand failed:", error?.message);
    return { error: "Could not create the brand. Try again." };
  }
  await audit({ actor: user, brandId: data.id, action: "brand.create", target: slug });
  redirect(`/hub/b/${slug}/settings`);
}

/**
 * Changes a brand's name. The address (slug) stays the same on purpose, so every link, bookmark and connected account keeps working.
 * The agency owner and the brand's founder can do it.
 */
export async function renameBrand(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getHubUser();
  if (!user) return { error: "Your session ended. Sign in again." };
  const brandId = str(fd, "brandId");
  if (!UUID.test(brandId)) return { error: "Unknown brand." };
  const actor = await actorFor(user, brandId);
  if (actor !== "owner" && actor !== "founder") return { error: "Only the founder or the agency owner can change the brand name." };
  const name = str(fd, "name").replace(/\s+/g, " ").trim();
  if (!name || name.length > 80) return { error: "Enter the brand name (up to 80 characters)." };

  const admin = createSupabaseAdminClient();
  const { data: brand } = await admin.from("brands").select("slug, name").eq("id", brandId).maybeSingle();
  if (!brand) return { error: "Unknown brand." };
  if (brand.name === name) return { message: "That is already the name." };
  const { error } = await admin.from("brands").update({ name }).eq("id", brandId);
  if (error) {
    console.error("[hub] renameBrand failed:", error.message);
    return { error: "Could not change the name. Try again." };
  }
  await audit({ actor: user, brandId, action: "brand.rename", target: brand.slug as string, meta: { from: brand.name, to: name } });
  revalidatePath("/hub", "layout");
  return { message: "Name changed." };
}

// ------------------------------------------------------------------ team
export async function createInvite(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getHubUser();
  if (!user) return { error: "Your session ended. Sign in again." };
  const brandId = str(fd, "brandId");
  const email = normalizeEmail(str(fd, "email"));
  const role = str(fd, "role");
  if (!UUID.test(brandId)) return { error: "Unknown brand." };
  if (!isEmail(email)) return { error: "Enter a valid email address." };
  if (!isBrandRole(role)) return { error: "Choose a role." };

  const actor = await actorFor(user, brandId);
  if (!canInvite(actor, role)) return { error: "You cannot invite that role." };
  if (!allow(`invite:${user.id}`, 30, 60 * 60 * 1000)) return { error: "Too many invites in the last hour." };

  const admin = createSupabaseAdminClient();
  const { data: brand } = await admin.from("brands").select("id, slug, name").eq("id", brandId).maybeSingle();
  if (!brand) return { error: "Unknown brand." };

  const { data: existingId } = await admin.rpc("user_id_by_email", { p_email: email });
  if (typeof existingId === "string") {
    const { data: m } = await admin.from("brand_members").select("role").eq("brand_id", brandId).eq("user_id", existingId).maybeSingle();
    if (m) return { error: "That person is already on this brand." };
  }

  await admin.from("brand_invites").delete().eq("brand_id", brandId).eq("email", email).is("accepted_at", null);
  const { token, hash } = newInviteToken();
  const { error } = await admin.from("brand_invites").insert({ brand_id: brandId, email, role, token_hash: hash, invited_by: user.id });
  if (error) {
    console.error("[hub] createInvite failed:", error.message);
    return { error: "Could not create the invite. Try again." };
  }

  const inviteUrl = `${baseUrl()}/hub/invite?token=${token}`;
  const mail = inviteMail({ brand: brand.name, role: ROLE_LABEL[role], invitedBy: user.email, url: inviteUrl });
  const sent = await sendMail({ to: email, ...mail });
  if (!sent.ok) console.error("[hub] invite email failed:", sent.error);
  await audit({ actor: user, brandId, action: "invite.create", target: email, meta: { role, emailed: sent.ok } });
  revalidatePath(`/hub/b/${brand.slug}/settings`);
  return { message: sent.ok ? `Invitation emailed to ${email}.` : `Invitation created, but the email could not be sent. Copy the link below and send it yourself.`, inviteUrl, emailed: sent.ok };
}

export async function revokeInvite(fd: FormData): Promise<void> {
  const user = await getHubUser();
  const inviteId = str(fd, "inviteId");
  if (!user || !UUID.test(inviteId)) return;
  const admin = createSupabaseAdminClient();
  const { data: inv } = await admin.from("brand_invites").select("id, brand_id, role, email, brands(slug)").eq("id", inviteId).is("accepted_at", null).maybeSingle();
  if (!inv || !isBrandRole(inv.role)) return;
  const actor = await actorFor(user, inv.brand_id);
  if (!canManageTeam(actor) || !canInvite(actor, inv.role)) return;
  await admin.from("brand_invites").delete().eq("id", inviteId);
  await audit({ actor: user, brandId: inv.brand_id, action: "invite.revoke", target: inv.email });
  const slug = (inv.brands as unknown as { slug: string } | null)?.slug;
  if (slug) revalidatePath(`/hub/b/${slug}/settings`);
}

export async function removeMember(fd: FormData): Promise<void> {
  const user = await getHubUser();
  const brandId = str(fd, "brandId");
  const userId = str(fd, "userId");
  if (!user || !UUID.test(brandId) || !UUID.test(userId)) return;
  const actor = await actorFor(user, brandId);
  const admin = createSupabaseAdminClient();
  const { data: m } = await admin.from("brand_members").select("role, brands(slug)").eq("brand_id", brandId).eq("user_id", userId).maybeSingle();
  if (!m || !isBrandRole(m.role)) return;
  if (!canManageTeam(actor) || !canRemove(actor, m.role, userId === user.id)) return;
  await admin.from("brand_members").delete().eq("brand_id", brandId).eq("user_id", userId);
  await audit({ actor: user, brandId, action: "member.remove", target: userId, meta: { role: m.role } });
  const slug = (m.brands as unknown as { slug: string } | null)?.slug;
  if (slug) revalidatePath(`/hub/b/${slug}/settings`);
}

// ------------------------------------------------------------------ accept an invite
export async function acceptInvite(fd: FormData): Promise<void> {
  const token = str(fd, "token");
  if (!looksLikeToken(token)) redirect("/hub");
  const user = await getHubUser();
  if (!user) redirect(`/hub/login?next=${encodeURIComponent(`/hub/invite?token=${token}`)}`);

  const admin = createSupabaseAdminClient();
  const { data: inv } = await admin
    .from("brand_invites")
    .select("id, brand_id, email, role, expires_at, accepted_at, brands(slug)")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  const slug = (inv?.brands as unknown as { slug: string } | null)?.slug;
  const valid = inv && !inv.accepted_at && new Date(inv.expires_at) > new Date() && inv.email === user.email && isBrandRole(inv.role) && slug;
  if (!valid) redirect(`/hub/invite?token=${token}`);

  const { error } = await admin.from("brand_members").insert({ brand_id: inv.brand_id, user_id: user.id, role: inv.role });
  if (error && error.code !== "23505") {
    console.error("[hub] acceptInvite failed:", error.message);
    redirect(`/hub/invite?token=${token}`);
  }
  await admin.from("brand_invites").update({ accepted_at: new Date().toISOString() }).eq("id", inv.id);
  await audit({ actor: user, brandId: inv.brand_id, action: "invite.accept", target: inv.role });
  redirect(`/hub/b/${slug}`);
}
