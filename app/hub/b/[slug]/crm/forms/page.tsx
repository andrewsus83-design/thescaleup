import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Chip, EmptyState, PageHeader } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { CrmNav, crmBase } from "@/components/hub/crm/parts";
import { requireFunction } from "@/lib/hub/access";
import { listForms } from "@/lib/hub/crm/form-data";
import { formPath } from "@/lib/hub/crm/forms";
import { publicOrigin } from "@/lib/hub/email/secret";
import { atLeast } from "@/lib/hub/permissions";
import { canManageTeam } from "@/lib/hub/rules";
import { fmtNum } from "@/lib/hub/products/model";

export const metadata: Metadata = { title: "CRM · Forms" };
export const dynamic = "force-dynamic";

export default async function CrmFormsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor, access } = await requireFunction(slug, "crm");
  if (!canManageTeam(actor) || !atLeast(access.crm, "edit")) notFound();
  const forms = await listForms(brand.id);
  const origin = publicOrigin();
  return (
    <>
      <PageHeader
        title="CRM"
        description="Share a link, or put a form on your website. Whoever fills it in becomes a lead, with the tags and source you set."
        action={
          <Link href={`${crmBase(slug)}/forms/new`} className={btnCls("primary", "md")}>
            New form
          </Link>
        }
      />
      <CrmNav slug={slug} active="forms" manager />
      {forms.length === 0 ? (
        <EmptyState icon={<ClipboardList className="size-6" aria-hidden />} title="No forms yet" hint="Make a form for a campaign, an event or your website. Each one can add its own tags, so you know where people came from and can email just them.">
          <Link href={`${crmBase(slug)}/forms/new`} className={btnCls("primary", "md")}>
            Make a form
          </Link>
        </EmptyState>
      ) : (
        <ul className="divide-y divide-hairline rounded-bubble border border-hairline bg-paper-0">
          {forms.map((f) => (
            <li key={f.id}>
              <Link href={`${crmBase(slug)}/forms/${f.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-paper-100 focus-visible:shadow-focus focus-visible:outline-none">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold text-ink-800">{f.name}</span>
                  <span className="block truncate text-small text-ink-500">
                    {origin.replace(/^https?:\/\//, "")}
                    {formPath(f.token)}
                  </span>
                </span>
                {f.tags.length > 0 && <span className="max-w-48 truncate text-small text-ink-500">{f.tags.join(", ")}</span>}
                <span className="text-small text-ink-500">{fmtNum(f.recent)} in 30 days</span>
                <Chip tone={f.enabled ? "ok" : "neutral"}>{f.enabled ? "Taking answers" : "Paused"}</Chip>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
