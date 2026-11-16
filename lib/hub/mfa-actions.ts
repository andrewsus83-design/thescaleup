"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FormState } from "./actions";
import { mfaPassed } from "./mfa";
import { allow } from "./ratelimit";
import { canManageTeam, canRemove, cleanCode, isBrandRole, safeNext } from "./rules";
import { actorFor, audit, getHubUser } from "./session";
import { UUID, str } from "./tasks/context";

export type MfaState = FormState & { factorId?: string; qr?: string; secret?: string };

const TOO_MANY = "Too many attempts. Wait a few minutes and try again.";
const WRONG = "That code is not right. Codes change every 30 seconds, so wait for the next one and try again.";
/** What the setup form posts back so a wrong code keeps the same QR. Only an inline image is accepted, so nothing else can be echoed into the page. */
const echo = (fd: FormData) => {
  const qr = str(fd, "qr");
  const secret = str(fd, "secret");
  return { qr: /^data:image\/svg\+xml[;,]/.test(qr) ? qr : undefined, secret: /^[A-Z2-7]{16,64}$/.test(secret) ? secret : undefined };
};
const tries = (userId: string) => allow(`mfa:${userId}`, 15, 15 * 60 * 1000);

/** Step one of setting up: a new authenticator secret for this person, shown as a QR code. An unfinished earlier try is replaced. */
export async function startEnrollment(): Promise<MfaState> {
  const user = await getHubUser();
  if (!user) return { error: "Your session ended. Sign in again." };
  if (!tries(user.id)) return { error: TOO_MANY };
  const supabase = await createSupabaseServerClient();
  const { data: list, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError || !list) return { error: "Could not start the setup. Try again." };
  if (list.all.some((f) => f.factor_type === "totp" && f.status === "verified")) return { error: "An authenticator is already set up. Reload this page and enter its code." };
  for (const f of list.all) if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "The Scale Up", friendlyName: "Authenticator" });
  if (error || !data) {
    console.error("[mfa] enroll failed:", error?.message);
    return { error: /disabled/i.test(error?.message ?? "") ? "Authenticator sign-in is switched off for this project. Turn on TOTP under Authentication, Multi-Factor in Supabase." : "Could not start the setup. Try again." };
  }
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Step two: the first code proves the app has the secret. This also turns the current session into a verified one. */
export async function confirmEnrollment(_prev: MfaState, fd: FormData): Promise<MfaState> {
  const user = await getHubUser();
  if (!user) return { error: "Your session ended. Sign in again." };
  const factorId = str(fd, "factorId");
  const code = cleanCode(str(fd, "code"));
  if (!UUID.test(factorId)) return { error: "Start the setup again." };
  if (!code) return { error: "Type the 6 digits from your authenticator app.", factorId, ...echo(fd) };
  if (!tries(user.id)) return { error: TOO_MANY };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: WRONG, factorId, ...echo(fd) };
  await audit({ actor: user, action: "mfa.enroll" });
  redirect(safeNext(str(fd, "next")));
}

/** The code step of every new sign-in. */
export async function verifyAuthenticator(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getHubUser();
  if (!user) return { error: "Your session ended. Sign in again." };
  const code = cleanCode(str(fd, "code"));
  if (!code) return { error: "Type the 6 digits from your authenticator app." };
  if (!tries(user.id)) return { error: TOO_MANY };
  const supabase = await createSupabaseServerClient();
  const { data: list } = await supabase.auth.mfa.listFactors();
  const factor = list?.all.find((f) => f.factor_type === "totp" && f.status === "verified");
  if (!factor) return { error: "No authenticator is set up yet. Reload this page to set one up." };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { error: WRONG };
  redirect(safeNext(str(fd, "next")));
}

/**
 * For someone who lost their phone: removes their authenticator so they set up a new one at their next Mail visit.
 * Who may do this follows who may remove them from the team, and the person doing it must have passed their own check.
 */
export async function resetAuthenticator(fd: FormData): Promise<void> {
  const user = await getHubUser();
  const brandId = str(fd, "brandId");
  const userId = str(fd, "userId");
  if (!user || !UUID.test(brandId) || !UUID.test(userId)) return;
  if (!(await mfaPassed())) return;
  const actor = await actorFor(user, brandId);
  const admin = createSupabaseAdminClient();
  const { data: m } = await admin.from("brand_members").select("role, brands(slug)").eq("brand_id", brandId).eq("user_id", userId).maybeSingle();
  if (!m || !isBrandRole(m.role)) return;
  if (!canManageTeam(actor) || !canRemove(actor, m.role, userId === user.id)) return;
  const { data } = await admin.auth.admin.mfa.listFactors({ userId });
  for (const f of data?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId });
  await audit({ actor: user, brandId, action: "mfa.reset", target: userId });
  const slug = (m.brands as unknown as { slug: string } | null)?.slug;
  if (slug) revalidatePath(`/hub/b/${slug}/settings`);
}
