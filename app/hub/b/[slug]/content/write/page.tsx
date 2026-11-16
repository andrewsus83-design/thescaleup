import type { Metadata } from "next";
import Link from "next/link";
import { Alert, PageHeader } from "@/components/brand/primitives";
import { ContentNav } from "@/components/hub/content/nav";
import { WriteForm } from "@/components/hub/content/forms";
import { requireFunction } from "@/lib/hub/access";
import { canManageTeam } from "@/lib/hub/rules";
import { hasAiKey } from "@/lib/hub/tasks/data";

export const metadata: Metadata = { title: "Write with AI" };
export const dynamic = "force-dynamic";

export default async function WritePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor } = await requireFunction(slug, "content", "edit");
  const ready = await hasAiKey(brand.id);
  return (
    <>
      <PageHeader title="Write with AI" description="Pick what you need, give the facts, and get a draft in this brand's voice." />
      <ContentNav slug={slug} active="write" canEdit />
      <div className="max-w-3xl">
        {ready ? (
          <WriteForm brandId={brand.id} />
        ) : (
          <Alert tone="info">
            AI is not set up for this brand yet.{" "}
            {canManageTeam(actor) ? (
              <Link href={`/hub/b/${slug}/settings/integrations`} className="font-semibold underline underline-offset-2">
                Add an Anthropic key in Settings
              </Link>
            ) : (
              "Ask the founder to add an Anthropic key in Settings."
            )}
          </Alert>
        )}
      </div>
    </>
  );
}
