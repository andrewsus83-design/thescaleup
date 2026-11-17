import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Btn, PageHeader } from "@/components/brand/primitives";
import { btnCls, cardCls } from "@/components/brand/styles";
import { CopyText } from "@/components/hub/copy-text";
import { FormEditor } from "@/components/hub/crm/form-editor";
import { CrmNav, crmBase } from "@/components/hub/crm/parts";
import { requireFunction } from "@/lib/hub/access";
import { deleteLeadForm } from "@/lib/hub/crm-form-admin-actions";
import { getForm } from "@/lib/hub/crm/form-data";
import { formPath } from "@/lib/hub/crm/forms";
import { publicOrigin } from "@/lib/hub/email/secret";
import { atLeast } from "@/lib/hub/permissions";
import { canManageTeam } from "@/lib/hub/rules";
import { UUID } from "@/lib/hub/tasks/context";

export const metadata: Metadata = { title: "CRM · Form" };
export const dynamic = "force-dynamic";

export default async function FormPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { brand, actor, access } = await requireFunction(slug, "crm");
  if (!canManageTeam(actor) || !atLeast(access.crm, "edit") || !UUID.test(id)) notFound();
  const form = await getForm(brand.id, id);
  if (!form) notFound();
  const url = `${publicOrigin()}${formPath(form.token)}`;
  const embed = `<iframe src="${url}" title="${form.name.replace(/"/g, "&quot;")}" width="100%" height="640" style="border:0"></iframe>`;
  return (
    <>
      <PageHeader
        title={form.name}
        description={form.enabled ? "Taking answers." : "Paused: the link shows a notice and nothing is saved."}
        action={
          <Link href={`${crmBase(slug)}/forms`} className={btnCls("secondary", "md")}>
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Link>
        }
      />
      <CrmNav slug={slug} active="forms" manager />
      <div className="space-y-6">
        <section className={cardCls()} aria-label="Share this form">
          <h2 className="mb-3 text-body font-semibold text-ink-800">Share this form</h2>
          <CopyText text={url} label="Copy the form link" button="Copy link" />
          <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 text-small font-semibold text-ink-800 underline underline-offset-4">
            Open the form
            <ExternalLink className="size-4" aria-hidden />
          </a>
          <h3 className="mt-5 mb-2 text-small font-semibold text-ink-800">Put it on your website</h3>
          <p className="mb-3 text-small text-ink-500">Paste this where the form should appear.</p>
          <CopyText text={embed} label="Copy the embed code" button="Copy code" />
        </section>
        <section className={cardCls()} aria-label="Settings">
          <FormEditor brandId={brand.id} form={form} />
        </section>
        <details>
          <summary className="hit-44 inline-flex min-h-11 cursor-pointer items-center text-small font-semibold text-ink-500 hover:text-ink-800">Delete this form</summary>
          <form action={deleteLeadForm} className="mt-2 space-y-3 rounded-field bg-paper-100 p-4">
            <input type="hidden" name="brandId" value={brand.id} />
            <input type="hidden" name="id" value={form.id} />
            <p className="text-small text-ink-800">Deletes the form and its link stops working. The people it brought in stay in your CRM. This cannot be undone. To stop answers for a while, pause it instead.</p>
            <Btn type="submit" variant="danger" size="sm">
              Delete {form.name.length > 30 ? `${form.name.slice(0, 29)}…` : form.name}
            </Btn>
          </form>
        </details>
      </div>
    </>
  );
}
