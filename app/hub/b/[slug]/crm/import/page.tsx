import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { ImportWizard } from "@/components/hub/crm/import-wizard";
import { listPath } from "@/components/hub/crm/parts";
import { requireFunction } from "@/lib/hub/access";
import { getStages } from "@/lib/hub/crm/data";
import { isKind } from "@/lib/hub/crm/model";

export const metadata: Metadata = { title: "CRM · Import" };
export const dynamic = "force-dynamic";

export default async function ImportPeoplePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand } = await requireFunction(slug, "crm", "edit");
  const raw = Array.isArray(sp.kind) ? sp.kind[0] : sp.kind;
  const kind = isKind(raw) ? raw : "lead";
  const stages = await getStages(brand.id);
  return (
    <>
      <PageHeader
        title="Import from a file"
        description="Bring in leads or clients from Excel or CSV: a contact list, a form export, a sheet you already keep. People who are already in the CRM are left alone."
        action={
          <Link href={listPath(slug, kind)} className={btnCls("secondary", "md")}>
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Link>
        }
      />
      <ImportWizard brandId={brand.id} slug={slug} initialKind={kind} stages={stages} />
    </>
  );
}
