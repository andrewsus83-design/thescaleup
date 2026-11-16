import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Mail holds the brand's customers' email, so opening it takes a second step: a code from an authenticator app.
// Supabase marks a session "aal2" once a code was accepted in it; a fresh password or email-code sign-in is "aal1".
// The level is read from the signed token (getClaims verifies it), never from anything the browser sends along.

export const MFA_PATH = "/hub/mfa";
export const MFA_REQUIRED = "Confirm your authenticator code first. Open Mail again to continue.";

/** The assurance level of this request's session: "aal2" after an authenticator code was accepted in it. */
export const sessionAal = cache(async (): Promise<string | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const aal = data?.claims?.aal;
  return typeof aal === "string" ? aal : null;
});

export const mfaPassed = async (): Promise<boolean> => (await sessionAal()) === "aal2";

/** For a page or route: sends the person to set up or enter their code, then back to `next`. */
export async function requireMfa(next: string): Promise<void> {
  if (!(await mfaPassed())) redirect(`${MFA_PATH}?next=${encodeURIComponent(next)}`);
}
