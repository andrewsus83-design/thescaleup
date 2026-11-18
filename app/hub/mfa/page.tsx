import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Card } from "@/components/brand/primitives";
import { MfaChallengeForm, MfaEnroll } from "@/components/hub/mfa-forms";
import { MFA_PATH, sessionAal } from "@/lib/hub/mfa";
import { safeNext } from "@/lib/hub/rules";
import { requireHubUser } from "@/lib/hub/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Authenticator" };
export const dynamic = "force-dynamic";

/** The second step in front of Mail: enter the code from the authenticator app, or set the app up the first time. */
export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  await requireHubUser(`${MFA_PATH}?next=${encodeURIComponent(next)}`);
  if ((await sessionAal()) === "aal2") redirect(next);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const enrolled = Boolean(data?.all.some((f) => f.factor_type === "totp" && f.status === "verified"));
  return (
    <div className="mx-auto flex min-h-full w-full max-w-auth flex-col justify-center px-5 py-12">
      <div className="mb-10 flex flex-col items-center text-center">
        <Logo variant="lockup" size={32} />
        <h1 className="mt-10 font-title text-balance text-h2 text-ink-800">{enrolled ? "Enter your code" : "Protect Mail with an authenticator"}</h1>
        <p className="mt-3 text-pretty text-body text-ink-500">{enrolled ? "Mail holds your customers' email, so each sign-in needs a code from your authenticator app." : "Mail holds your customers' email, so each sign-in needs a code from an authenticator app. Set it up once."}</p>
      </div>
      <Card>{enrolled ? <MfaChallengeForm next={next} /> : <MfaEnroll next={next} />}</Card>
    </div>
  );
}
