import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, PageHeader } from "@/components/brand/primitives";
import { HubBar } from "@/components/hub/frame";
import { NewBrandForm } from "@/components/hub/forms";
import { requireHubUser } from "@/lib/hub/session";

export const metadata: Metadata = { title: "Add brand" };
export const dynamic = "force-dynamic";

export default async function NewBrandPage() {
  const user = await requireHubUser("/hub/new");
  if (!user.isOwner) notFound();
  return (
    <>
      <HubBar email={user.email} isOwner />
      <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8">
        <Link href="/hub" className="mb-6 inline-flex items-center gap-2 text-small font-semibold text-ink-500 hover:text-ink-800">
          <ArrowLeft className="size-4" aria-hidden />
          All brands
        </Link>
        <PageHeader title="Add brand" description="You create the brand, then invite its founder. The founder invites their own team." />
        <Card>
          <NewBrandForm />
        </Card>
      </main>
    </>
  );
}
