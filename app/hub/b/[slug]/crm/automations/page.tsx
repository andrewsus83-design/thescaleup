import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/brand/primitives";
import { cardCls } from "@/components/brand/styles";
import { CrmNav } from "@/components/hub/crm/parts";
import { RuleEditor } from "@/components/hub/crm/rule-editor";
import { requireFunction } from "@/lib/hub/access";
import { getRules, getStages } from "@/lib/hub/crm/data";
import { atLeast } from "@/lib/hub/permissions";
import { canManageTeam } from "@/lib/hub/rules";
import { listMembers } from "@/lib/hub/tasks/data";
import { shortName } from "@/lib/hub/tasks/model";

export const metadata: Metadata = { title: "CRM · Automations" };
export const dynamic = "force-dynamic";

export default async function CrmAutomationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor, access } = await requireFunction(slug, "crm");
  if (!canManageTeam(actor) || !atLeast(access.crm, "edit")) notFound();
  const [stages, { rules }, members] = await Promise.all([getStages(brand.id), getRules(brand.id), listMembers(brand.id)]);
  return (
    <>
      <PageHeader title="CRM" description="Let a stage do the routine work: when someone enters it, set the next follow-up and add a task." />
      <CrmNav slug={slug} active="automations" manager />
      <div className={cardCls()}>
        <RuleEditor brandId={brand.id} stages={stages} rules={rules} members={members.map((m) => ({ id: m.userId, name: shortName(m.email) }))} />
      </div>
    </>
  );
}
