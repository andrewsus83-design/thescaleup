import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/brand/primitives";
import { btnCls, cardCls } from "@/components/brand/styles";
import { FormEditor } from "@/components/hub/crm/form-editor";
import { CrmNav, crmBase } from "@/components/hub/crm/parts";
import { requireFunction } from "@/lib/hub/access";
import { atLeast } from "@/lib/hub/permissions";
import { canManageTeam } from "@/lib/hub/rules";

export const metadata: Metadata = { title: "CRM · New form" };
export const dynamic = "force-dynamic";

export default async function NewFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor, access } = await requireFunction(slug, "crm");
  if (!canManageTeam(actor) || !atLeast(access.crm, "edit")) notFound();
  return (
    <>
      <PageHeader
        title="New form"
        description="Set what people see and what you ask. You get the link to share once it is made."
        action={
          <Link href={`${crmBase(slug)}/forms`} className={btnCls("secondary", "md")}>
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Link>
        }
      />
      <CrmNav slug={slug} active="forms" manager />
      <div className={cardCls()}>
        <FormEditor brandId={brand.id} />
      </div>
    </>
  );
}
