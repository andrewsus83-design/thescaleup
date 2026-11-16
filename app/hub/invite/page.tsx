import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Alert, Btn, Card } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { acceptInvite, signOut } from "@/lib/hub/actions";
import { isBrandRole, ROLE_LABEL } from "@/lib/hub/rules";
import { getHubUser } from "@/lib/hub/session";
import { hashToken, looksLikeToken } from "@/lib/hub/tokens";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Invitation" };
export const dynamic = "force-dynamic";

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  let invite: { email: string; role: string; brandName: string; expired: boolean; used: boolean } | null = null;
  if (looksLikeToken(token)) {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.from("brand_invites").select("email, role, expires_at, accepted_at, brands(name)").eq("token_hash", hashToken(token)).maybeSingle();
    if (data && isBrandRole(data.role)) {
      invite = {
        email: data.email,
        role: data.role,
        brandName: (data.brands as unknown as { name: string } | null)?.name ?? "a brand",
        expired: new Date(data.expires_at) <= new Date(),
        used: !!data.accepted_at,
      };
    }
  }

  const user = invite ? await getHubUser() : null;
  const shell = (children: React.ReactNode) => (
    <div className="mx-auto flex min-h-full w-full max-w-[30rem] flex-col justify-center px-5 py-12">
      <div className="mb-10 flex flex-col items-center text-center">
        <Logo variant="lockup" size={32} />
      </div>
      <Card>{children}</Card>
    </div>
  );

  if (!invite || invite.expired || invite.used) {
    return shell(
      <div className="space-y-6">
        <Alert tone="warn" role="alert">
          {invite?.used ? "This invitation was already used." : invite?.expired ? "This invitation expired." : "This invitation link is not valid."} Ask for a new one.
        </Alert>
        <Link href="/hub" className={btnCls("secondary", "md")}>
          Go to ScaleUp
        </Link>
      </div>,
    );
  }

  const heading = (
    <>
      <h1 className="font-title text-h3 text-ink-800">Join {invite.brandName}</h1>
      <p className="mt-2 text-body text-ink-500">
        You were invited as <strong className="text-ink-800">{ROLE_LABEL[invite.role as keyof typeof ROLE_LABEL]}</strong> for <strong className="text-ink-800">{invite.email}</strong>.
      </p>
    </>
  );

  if (!user) {
    const next = `/hub/invite?token=${token}`;
    return shell(
      <div className="space-y-6">
        {heading}
        <Link href={`/hub/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(invite.email)}`} className={btnCls("primary", "lg", "w-full")}>
          Sign in to accept
        </Link>
      </div>,
    );
  }

  if (user.email !== invite.email) {
    return shell(
      <div className="space-y-6">
        {heading}
        <Alert tone="warn" role="alert">
          You are signed in as {user.email}. Sign out and sign in as {invite.email} to accept.
        </Alert>
        <form action={signOut}>
          <Btn type="submit" variant="secondary" size="md">
            Sign out
          </Btn>
        </form>
      </div>,
    );
  }

  return shell(
    <form action={acceptInvite} className="space-y-6">
      <input type="hidden" name="token" value={token} />
      {heading}
      <Btn type="submit" variant="primary" size="lg" className="w-full">
        Join {invite.brandName}
      </Btn>
    </form>,
  );
}
