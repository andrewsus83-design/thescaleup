import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/brand/primitives";
import { btnCls, cardCls } from "@/components/brand/styles";
import { PersonForm } from "@/components/hub/crm/forms";
import { listPath } from "@/components/hub/crm/parts";
import { requireFunction } from "@/lib/hub/access";
import { isKind } from "@/lib/hub/crm/model";

export const metadata: Metadata = { title: "CRM · Add" };
export const dynamic = "force-dynamic";

export default async function NewPersonPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand } = await requireFunction(slug, "crm", "edit");
  const raw = Array.isArray(sp.kind) ? sp.kind[0] : sp.kind;
  const kind = isKind(raw) ? raw : "lead";
  return (
    <>
      <PageHeader
        title={kind === "lead" ? "Add a lead" : "Add a client"}
        description="Only the name is needed. You can fill in the rest later."
        action={
          <Link href={listPath(slug, kind)} className={btnCls("secondary", "md")}>
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Link>
        }
      />
      <div className={cardCls()}>
        <PersonForm brandId={brand.id} kind={kind} />
      </div>
    </>
  );
}
