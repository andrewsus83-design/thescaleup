import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, SearchX } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { Candidates } from "@/components/hub/crm/lead-finder";
import { CrmNav, crmBase, stamp } from "@/components/hub/crm/parts";
import { requireFunction } from "@/lib/hub/access";
import { getSearch } from "@/lib/hub/leads/data";
import { UUID } from "@/lib/hub/tasks/context";
import { canManageTeam } from "@/lib/hub/rules";
import { hubTz } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "CRM · Businesses found" };
export const dynamic = "force-dynamic";

export default async function FoundPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!UUID.test(id)) notFound();
  const { brand, actor } = await requireFunction(slug, "crm", "edit");
  const found = await getSearch(brand.id, id);
  if (!found) notFound();
  const { search, candidates } = found;
  const { left } = search;
  const out = [
    left.inCrm > 0 && `${left.inCrm} already in your CRM`,
    left.known > 0 && `${left.known} seen in an earlier search`,
    left.missing > 0 && `${left.missing} whose website does not exist`,
    left.notBusiness + left.repeated > 0 && `${left.notBusiness + left.repeated} that were not a business with its own site, or named twice`,
  ].filter(Boolean);
  return (
    <>
      <PageHeader
        title="Businesses found"
        description={`${search.brief.what}${search.brief.where ? `, ${search.brief.where}` : ""} · ${stamp(search.created_at, hubTz())}`}
        action={
          <Link href={`${crmBase(slug)}/find`} className={btnCls("secondary", "md")}>
            <ArrowLeft className="size-4" aria-hidden />
            All searches
          </Link>
        }
      />
      <CrmNav slug={slug} active="leads" manager={canManageTeam(actor)} />
      {candidates.length === 0 ? (
        <EmptyState icon={<SearchX className="size-6" aria-hidden />} title="Nothing new this time" hint={out.length ? `Left out: ${out.join("; ")}. Try describing the business differently, or widen the place.` : "The AI did not find a business it could confirm. Try describing the business differently, or widen the place."}>
          <Link href={`${crmBase(slug)}/find`} className={btnCls("primary", "md")}>
            Search again
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <p className="text-small text-ink-500">
            Ticked ones opened and carry the business&apos;s name. The others need a look first: open the site before you add them. Email addresses and phone numbers were read from each business&apos;s own website, not written by the AI.
            {out.length > 0 && ` Left out: ${out.join("; ")}.`}
          </p>
          <Candidates brandId={brand.id} searchId={search.id} candidates={candidates} />
        </div>
      )}
    </>
  );
}
