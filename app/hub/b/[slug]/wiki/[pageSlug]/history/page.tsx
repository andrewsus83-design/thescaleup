import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Btn, EmptyState, PageHeader } from "@/components/brand/primitives";
import { whoIs, wikiBase } from "@/components/hub/wiki/parts";
import { requireFunction } from "@/lib/hub/access";
import { listMembers } from "@/lib/hub/tasks/data";
import { fmtStamp, hubTz, todayIn } from "@/lib/hub/tasks/dates";
import { restoreVersion } from "@/lib/hub/wiki-actions";
import { getPageBySlug, listVersions } from "@/lib/hub/wiki/data";

export const metadata: Metadata = { title: "Earlier versions" };
export const dynamic = "force-dynamic";

// Only people who can edit see earlier versions: an old text may hold what was taken out on purpose.
export default async function WikiHistory({ params }: { params: Promise<{ slug: string; pageSlug: string }> }) {
  const { slug, pageSlug } = await params;
  const { brand } = await requireFunction(slug, "wiki", "edit");
  const page = await getPageBySlug(brand.id, pageSlug);
  if (!page) notFound();
  const [versions, members] = await Promise.all([listVersions(brand.id, page.id), listMembers(brand.id)]);
  const tz = hubTz();
  const today = todayIn(tz);
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Earlier versions"
        description={`Every time “${page.title}” changes, the text it had before is kept here. Restoring one keeps the current text as a version too.`}
        action={
          <Link href={`${wikiBase(slug)}/${page.slug}`} className="text-small font-semibold text-brand-700 underline underline-offset-4">
            Back to the page
          </Link>
        }
      />
      {versions.length === 0 ? (
        <EmptyState title="No earlier versions yet" hint="They appear after the page is changed for the first time." />
      ) : (
        <ul className="space-y-3">
          {versions.map((v) => (
            <li key={v.id} className="rounded-field bg-paper-0 p-4 shadow-raised">
              <details>
                <summary className="hit-44 flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-body font-semibold text-ink-800">{v.title}</span>
                  <span className="text-small text-ink-500">
                    {fmtStamp(v.edited_at, tz, today)} · {whoIs(members, v.edited_by)}
                  </span>
                </summary>
                {v.summary && <p className="mt-2 text-small text-ink-500">{v.summary}</p>}
                <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-field bg-paper-100 p-4 font-mono text-small text-ink-800">{v.body || "(no text)"}</pre>
                <form action={restoreVersion} className="mt-3">
                  <input type="hidden" name="brandId" value={brand.id} />
                  <input type="hidden" name="pageId" value={page.id} />
                  <input type="hidden" name="versionId" value={v.id} />
                  <Btn type="submit" variant="secondary" size="sm">
                    Restore this version
                  </Btn>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
