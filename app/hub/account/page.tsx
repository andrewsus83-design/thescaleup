import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, PageHeader } from "@/components/brand/primitives";
import { HubBar } from "@/components/hub/frame";
import { PasswordForm } from "@/components/hub/password-form";
import { requireHubUser } from "@/lib/hub/session";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireHubUser("/hub/account");
  return (
    <>
      <HubBar email={user.email} isOwner={user.isOwner} />
      <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8">
        <Link href="/hub" className="mb-6 inline-flex items-center gap-2 text-small font-semibold text-ink-500 hover:text-ink-800">
          <ArrowLeft className="size-4" aria-hidden />
          All brands
        </Link>
        <PageHeader title="Account" description={`Signed in as ${user.email}. Set a password to sign in without waiting for an email code.`} />
        <Card>
          <h2 className="mb-6 font-title text-h3 text-ink-800">Password</h2>
          <PasswordForm />
        </Card>
      </main>
    </>
  );
}
