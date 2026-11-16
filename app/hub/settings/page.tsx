import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, PageHeader } from "@/components/brand/primitives";
import { HubBar } from "@/components/hub/frame";
import { KeysSection } from "@/components/hub/keys-section";
import { requireHubUser } from "@/lib/hub/session";

export const metadata: Metadata = { title: "Workspace keys" };
export const dynamic = "force-dynamic";

export default async function WorkspaceKeysPage() {
  const user = await requireHubUser("/hub/settings");
  if (!user.isOwner) notFound();
  return (
    <>
      <HubBar email={user.email} isOwner />
      <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8">
        <Link href="/hub" className="mb-6 inline-flex items-center gap-2 text-small font-semibold text-ink-500 hover:text-ink-800">
          <ArrowLeft className="size-4" aria-hidden />
          All brands
        </Link>
        <PageHeader title="Workspace keys" description="The agency's default keys. AI keys here are used by any brand that has no key of its own. Keys are encrypted and cannot be read back." />
        <Card>
          <KeysSection brandId={null} />
        </Card>
      </main>
    </>
  );
}
