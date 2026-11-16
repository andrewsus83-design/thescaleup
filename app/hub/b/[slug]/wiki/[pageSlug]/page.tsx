import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chip } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { Markdown } from "@/components/hub/wiki/markdown";
import { Crumbs, HiddenFromAi, TagLinks, TypeChip, whoIs, wikiBase } from "@/components/hub/wiki/parts";
import { requireFunction } from "@/lib/hub/access";
import { atLeast } from "@/lib/hub/permissions";
import { listMembers } from "@/lib/hub/tasks/data";
import { fmtStamp, hubTz, todayIn } from "@/lib/hub/tasks/dates";
import { getPageBySlug, listChildren, listNodes } from "@/lib/hub/wiki/data";
import { trail } from "@/lib/hub/wiki/model";

export const metadata: Metadata = { title: "Wiki" };
export const dynamic = "force-dynamic";

export default async function WikiArticle({ params }: { params: Promise<{ slug: string; pageSlug: string }> }) {
  const { slug, pageSlug } = await params;
  const { brand, access } = await requireFunction(slug, "wiki");
  const page = await getPageBySlug(brand.id, pageSlug);
  if (!page) notFound();
  const canEdit = atLeast(access.wiki, "edit");
  const tz = hubTz();
  const [nodes, kids, members] = await Promise.all([listNodes(brand.id), listChildren(brand.id, page.id), listMembers(brand.id)]);
  const base = wikiBase(slug);
  return (
    <article className="mx-auto w-full max-w-3xl">
      <Crumbs slug={slug} trail={trail(nodes, page.id)} />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-title text-balance text-h2 text-ink-800">{page.title}</h1>
          {page.summary && <p className="mt-2 text-pretty text-body text-ink-500">{page.summary}</p>}
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-2">
            <Link href={`${base}/${page.slug}/edit`} className={btnCls("secondary", "sm")}>
              Edit
            </Link>
            <Link href={`${base}/new?parent=${page.id}`} className={btnCls("secondary", "sm")}>
              Add subpage
            </Link>
          </div>
        )}
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <TypeChip type={page.type} />
        {page.ai_readable ? <Chip tone="ok">AI may read this</Chip> : <HiddenFromAi />}
      </div>
      <Markdown text={page.body} />
      {page.tags.length > 0 && (
        <div className="mt-8">
          <TagLinks slug={slug} tags={page.tags} />
        </div>
      )}
      {kids.length > 0 && (
        <section className="mt-10" aria-labelledby="wk-sub">
          <h2 id="wk-sub" className="mb-3 font-title text-h4 text-ink-800">
            Subpages
          </h2>
          <ul className="rounded-card border border-hairline bg-paper-0 p-2 shadow-raised">
            {kids.map((k) => (
              <li key={k.id}>
                <Link href={`${base}/${k.slug}`} className="block rounded-field px-4 py-3 hover:bg-paper-100 focus-visible:shadow-focus focus-visible:outline-none">
                  <span className="text-body font-semibold text-ink-800">{k.title}</span>
                  {k.summary && <span className="mt-1 block text-small text-ink-500">{k.summary}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-10 border-t border-hairline pt-4 text-caption text-ink-500">
        Last changed {fmtStamp(page.updated_at, tz, todayIn(tz))} by {whoIs(members, page.updated_by)}.
        {canEdit && (
          <>
            {" "}
            <Link href={`${base}/${page.slug}/history`} className="font-semibold text-brand-700 underline underline-offset-4">
              See earlier versions
            </Link>
          </>
        )}
      </p>
    </article>
  );
}
