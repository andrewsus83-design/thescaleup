import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Search, X } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/brand/primitives";
import { btnCls, iconBtnCls, pillCls } from "@/components/brand/styles";
import { HiddenFromAi, TypeChip, wikiBase } from "@/components/hub/wiki/parts";
import { requireFunction } from "@/lib/hub/access";
import { atLeast } from "@/lib/hub/permissions";
import { searchTerm } from "@/lib/hub/mail/model";
import { listPages, listTags, type WikiCard } from "@/lib/hub/wiki/data";
import { MAX, TYPES, TYPE_INFO, flatten, isType, type PageType } from "@/lib/hub/wiki/model";

export const metadata: Metadata = { title: "Wiki" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function href(base: string, f: { q?: string; type?: PageType; tag?: string }) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.type) p.set("type", f.type);
  if (f.tag) p.set("tag", f.tag);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

function Row({ slug, page, depth = 0 }: { slug: string; page: WikiCard; depth?: number }) {
  return (
    <li style={depth ? { paddingLeft: `${Math.min(depth, 5) * 1.25}rem` } : undefined}>
      <Link href={`${wikiBase(slug)}/${page.slug}`} className="block rounded-field px-4 py-3 hover:bg-paper-100 focus-visible:shadow-focus focus-visible:outline-none">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-body font-semibold text-ink-800">{page.title}</span>
          <TypeChip type={page.type} />
          {!page.ai_readable && <HiddenFromAi />}
        </span>
        {page.summary && <span className="mt-1 block text-small text-ink-500">{page.summary}</span>}
      </Link>
    </li>
  );
}

export default async function WikiPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand, access } = await requireFunction(slug, "wiki");
  const canEdit = atLeast(access.wiki, "edit");
  const q = searchTerm(one(sp.q));
  const rawType = one(sp.type);
  const type = isType(rawType) ? rawType : undefined;
  const tag = (one(sp.tag) ?? "").toLowerCase().trim().slice(0, MAX.tag) || undefined;
  const filtered = Boolean(q || type || tag);
  const base = wikiBase(slug);

  const [pages, tags] = await Promise.all([listPages(brand.id, { q: q || undefined, type, tag }), listTags(brand.id)]);
  const byId = new Map(pages.map((p) => [p.id, p]));
  const tree = filtered ? [] : flatten(pages).map((n) => ({ page: byId.get(n.id)!, depth: n.depth }));

  return (
    <>
      <PageHeader
        title="Wiki"
        description="What the company knows: the brand, how we work, training and research. Private to your team."
        action={
          canEdit && (
            <span className="flex flex-wrap items-center gap-2">
              <Link href={`${base}/build`} className={btnCls("secondary", "md")}>
                Build with AI
              </Link>
              <Link href={`${base}/new`} className={btnCls("primary", "md")}>
                New page
              </Link>
            </span>
          )
        }
      />
      <form role="search" method="get" action={base} className="relative mb-4">
        {type && <input type="hidden" name="type" value={type} />}
        {tag && <input type="hidden" name="tag" value={tag} />}
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-500" aria-hidden />
        <input
          type="search"
          name="q"
          defaultValue={q}
          maxLength={MAX.query}
          autoComplete="off"
          aria-label="Search the Wiki"
          placeholder="Search the Wiki"
          className="block h-12 w-full rounded-full border-control border-transparent bg-paper-0 pr-12 pl-12 text-body text-ink-800 outline-none placeholder:text-ink-500 focus-visible:border-ink-800 focus-visible:shadow-focus"
        />
        {filtered && (
          <Link href={base} aria-label="Clear the search and filters" className={iconBtnCls("quiet", "absolute top-1/2 right-1 size-10 -translate-y-1/2")}>
            <X className="size-4" aria-hidden />
          </Link>
        )}
      </form>

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter by type">
        <Link href={href(base, { q, tag })} aria-pressed={!type} className={pillCls(!type)}>
          All
        </Link>
        {TYPES.map((t) => (
          <Link key={t} href={href(base, { q, type: t, tag })} aria-pressed={type === t} className={pillCls(type === t)}>
            {TYPE_INFO[t].label}
          </Link>
        ))}
      </div>
      {tags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by tag">
          {tags.map((t) => (
            <Link key={t.tag} href={href(base, { q, type, tag: tag === t.tag ? undefined : t.tag })} aria-pressed={tag === t.tag} className={pillCls(tag === t.tag)}>
              {t.tag}
              <span className="font-mono text-micro opacity-70">{t.count}</span>
            </Link>
          ))}
        </div>
      )}

      {q && <p className="mb-3 text-small text-ink-500">Results for “{q}”: titles first, then words in the text.</p>}

      {pages.length === 0 ? (
        filtered ? (
          <EmptyState icon={<Search className="size-6" aria-hidden />} title="No pages match" hint="Try fewer words, or clear the filters." />
        ) : (
          <EmptyState icon={<BookOpen className="size-6" aria-hidden />} title="The Wiki is empty" hint={canEdit ? "Start with how the brand sounds, what you sell, or how a task is done. Every page can sit under another." : "Nothing has been written here yet."}>
            {canEdit && (
              <Link href={`${base}/new`} className={btnCls("primary", "md")}>
                Write the first page
              </Link>
            )}
          </EmptyState>
        )
      ) : (
        <ul className="rounded-card border border-hairline bg-paper-0 p-2 shadow-raised">
          {filtered ? pages.map((p) => <Row key={p.id} slug={slug} page={p} />) : tree.map(({ page, depth }) => <Row key={page.id} slug={slug} page={page} depth={depth} />)}
        </ul>
      )}
    </>
  );
}
