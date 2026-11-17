import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Alert, PageHeader } from "@/components/brand/primitives";
import { btnCls, cardCls } from "@/components/brand/styles";
import { FinderForm } from "@/components/hub/crm/lead-finder";
import { CrmNav, crmBase, stamp } from "@/components/hub/crm/parts";
import { requireFunction } from "@/lib/hub/access";
import { listSearches } from "@/lib/hub/leads/data";
import { fmtNum } from "@/lib/hub/products/model";
import { canManageTeam } from "@/lib/hub/rules";
import { hubTz } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "CRM · Find leads" };
export const dynamic = "force-dynamic";
// The search and the check of each business's website run inside this page's action.
export const maxDuration = 120;

export default async function FindLeadsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor } = await requireFunction(slug, "crm", "edit");
  const { ready, rows } = await listSearches(brand.id);
  const tz = hubTz();
  return (
    <>
      <PageHeader
        title="Find leads with AI"
        description="Describe the kind of business you want. The AI searches the public web and names businesses; the app opens each one's own website to check it and read the contact details it publishes. You choose which become leads."
        action={
          <Link href={crmBase(slug)} className={btnCls("secondary", "md")}>
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Link>
        }
      />
      <CrmNav slug={slug} active="leads" manager={canManageTeam(actor)} />
      {!ready && (
        <div className="mb-6">
          <Alert tone="warn" title="One database step is missing">
            The leads finder needs 20261117410000_lead_finder.sql to be run first. Ask the person who runs the database updates.
          </Alert>
        </div>
      )}
      <div className="space-y-8">
        <div className={cardCls()}>
          <FinderForm brandId={brand.id} />
          <p className="mt-6 text-caption text-ink-500">
            It does not read LinkedIn, Instagram, Facebook, TikTok or X. Businesses found this way have not agreed to get your email: reach out one to one, and confirm consent before adding them to a campaign or sequence. Each search uses up to 5 web searches on your Anthropic account.
          </p>
        </div>
        {rows.length > 0 && (
          <section aria-labelledby="recent">
            <h2 id="recent" className="mb-3 flex items-center gap-2 text-h3 font-semibold text-ink-800">
              <Sparkles className="size-5 text-ink-500" aria-hidden />
              Recent searches
            </h2>
            <ul className="divide-y divide-hairline rounded-bubble border border-hairline bg-paper-0">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link href={`${crmBase(slug)}/find/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-paper-100 focus-visible:shadow-focus focus-visible:outline-none">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-semibold text-ink-800">{r.brief.what || "Search"}</span>
                      <span className="block truncate text-small text-ink-500">
                        {r.brief.where ? `${r.brief.where} · ` : ""}
                        {stamp(r.created_at, tz)}
                      </span>
                    </span>
                    <span className="text-small text-ink-500">
                      {fmtNum(r.found)} found
                      {r.fresh > 0 ? `, ${fmtNum(r.fresh)} waiting` : ""}
                      {r.added > 0 ? `, ${fmtNum(r.added)} added` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
