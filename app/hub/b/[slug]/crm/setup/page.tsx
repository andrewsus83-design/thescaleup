import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand/primitives";
import { cardCls } from "@/components/brand/styles";
import { CrmNav } from "@/components/hub/crm/parts";
import { StageEditor } from "@/components/hub/crm/stage-editor";
import { requireFunction } from "@/lib/hub/access";
import { getStages } from "@/lib/hub/crm/data";
import { atLeast } from "@/lib/hub/permissions";
import { canManageTeam } from "@/lib/hub/rules";

export const metadata: Metadata = { title: "CRM · Setup" };
export const dynamic = "force-dynamic";

export default async function CrmSetupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor, access } = await requireFunction(slug, "crm");
  if (!canManageTeam(actor) || !atLeast(access.crm, "edit")) notFound();
  const stages = await getStages(brand.id);
  return (
    <>
      <PageHeader title="CRM" description="Set the stages the way this brand sells. Everyone sees them in the lists, the board and the funnel." />
      <CrmNav slug={slug} active="setup" manager />
      <div className={cardCls()}>
        <StageEditor brandId={brand.id} stages={stages} />
      </div>
    </>
  );
}
