import Link from "next/link";
import { BriefcaseBusiness, Download, Mail, Search, Sparkles, Upload, X } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/brand/primitives";
import { btnCls, iconBtnCls, pillCls, tileCls } from "@/components/brand/styles";
import { CrmNav, crmBase, listPath } from "@/components/hub/crm/parts";
import { PeopleTable } from "@/components/hub/crm/people-table";
import { Stat } from "@/components/hub/products/parts";
import { findPeople, getStages, getSummary, listTags } from "@/lib/hub/crm/data";
import { followState, isStageFor, parseTags, stagesOf, type Kind } from "@/lib/hub/crm/model";
import { searchTerm } from "@/lib/hub/mail/model";
import { fmtNum } from "@/lib/hub/products/model";
import { hubTz, todayIn } from "@/lib/hub/tasks/dates";

const PER_PAGE = 50;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

type F = { q?: string; stage?: string; due?: boolean; tag?: string; page?: number };
function href(base: string, f: F) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.stage) p.set("stage", f.stage);
  if (f.due) p.set("due", "1");
  if (f.tag) p.set("tag", f.tag);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

/** The Leads and Clients lists are one page with a different kind. Search, filters, counts and paging are done by the database, so a list of thousands is searched whole. */
export async function CrmList({ slug, brandId, kind, canEdit, manager, contacts, sp }: { slug: string; brandId: string; kind: Kind; canEdit: boolean; manager: boolean; contacts: boolean; sp: Record<string, string | string[] | undefined> }) {
  const today = todayIn(hubTz());
  const base = listPath(slug, kind);
  const noun = kind === "lead" ? "lead" : "client";
  const nouns = kind === "lead" ? "leads" : "clients";

  const [stages, sum, tagList] = await Promise.all([getStages(brandId), getSummary(brandId, kind, today), listTags(brandId)]);
  const q = searchTerm(one(sp.q));
  const rawStage = one(sp.stage);
  const stage = rawStage === "open" ? "open" : isStageFor(stages, kind, rawStage) ? rawStage! : "";
  const due = one(sp.due) === "1";
  const tag = parseTags(one(sp.tag) ?? "")[0] ?? "";
  const filtered = Boolean(q || stage || due || tag);
  const cur: F = { q, stage, due, tag };
  const filter = { q, stage, due, tag, importId: null, contacts };

  const wanted = Math.max(1, Math.floor(Number(one(sp.page))) || 1);
  let { items, total } = await findPeople(brandId, kind, filter, today, wanted, PER_PAGE);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(pages, wanted);
  if (page !== wanted) ({ items, total } = await findPeople(brandId, kind, filter, today, page, PER_PAGE));
  const rows = items.map((p) => {
    const state = followState(p, today, stages);
    return { id: p.id, name: p.name, company: p.company, source: p.source, stage: p.stage, value: p.value, follow: state, followDate: p.next_follow_up, tags: p.tags };
  });
  const exportHref = `${crmBase(slug)}/export?${new URLSearchParams({ kind, ...(q ? { q } : {}), ...(stage ? { stage } : {}), ...(due ? { due: "1" } : {}), ...(tag ? { tag } : {}) }).toString()}`;

  return (
    <>
      <PageHeader
        title="CRM"
        description="Leads who may buy, and clients who already do. Each has a stage, a next follow-up and a log of notes."
        action={
          canEdit && (
            <div className="flex flex-wrap gap-2">
              <Link href={`${crmBase(slug)}/import?kind=${kind}`} className={btnCls("secondary", "md")}>
                <Upload className="size-4" aria-hidden />
                Import
              </Link>
              {kind === "lead" && (
                <Link href={`${crmBase(slug)}/find`} className={btnCls("secondary", "md")}>
                  <Sparkles className="size-4" aria-hidden />
                  Find leads
                </Link>
              )}
              <Link href={`${crmBase(slug)}/new?kind=${kind}`} className={btnCls("primary", "md")}>
                Add {noun}
              </Link>
            </div>
          )
        }
      />
      <CrmNav slug={slug} active={kind === "lead" ? "leads" : "clients"} manager={manager} />

      {sum.total === 0 ? (
        <EmptyState
          icon={<BriefcaseBusiness className="size-6" aria-hidden />}
          title={`No ${nouns} yet`}
          hint={canEdit ? (kind === "lead" ? "Add the people who asked about the brand. Move them along as they reply, and convert them to a client when they buy." : "Add the people who already buy, or convert a lead when they do.") : "Nothing has been added yet."}
        >
          {canEdit && (
            <div className="flex flex-wrap justify-center gap-2">
              <Link href={`${crmBase(slug)}/new?kind=${kind}`} className={btnCls("primary", "md")}>
                Add {noun}
              </Link>
              <Link href={`${crmBase(slug)}/import?kind=${kind}`} className={btnCls("secondary", "md")}>
                <Upload className="size-4" aria-hidden />
                Import from a file
              </Link>
              {kind === "lead" && (
                <Link href={`${crmBase(slug)}/find`} className={btnCls("secondary", "md")}>
                  <Sparkles className="size-4" aria-hidden />
                  Find leads with AI
                </Link>
              )}
            </div>
          )}
        </EmptyState>
      ) : (
        <>
          <dl className={`${tileCls} mb-6 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4`}>
            <Stat label={kind === "lead" ? "Leads" : "Clients"} value={fmtNum(sum.total)} />
            <Stat label={kind === "lead" ? "Open leads" : "Clients with the brand"} value={fmtNum(sum.open)} />
            <Stat label={kind === "lead" ? "Open lead value" : "Client value"} value={fmtNum(sum.openValue)} />
            <Stat label="Follow-ups due" value={fmtNum(sum.due)} />
          </dl>

          <form role="search" method="get" action={base} className="relative mb-4">
            {stage && <input type="hidden" name="stage" value={stage} />}
            {due && <input type="hidden" name="due" value="1" />}
            {tag && <input type="hidden" name="tag" value={tag} />}
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-500" aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={q}
              maxLength={80}
              autoComplete="off"
              aria-label="Search by name, company, email, phone or source"
              placeholder="Search by name, company, email, phone or source"
              className="block h-14 w-full rounded-full border-control border-transparent bg-paper-0 pr-12 pl-12 text-body text-ink-800 outline-none placeholder:text-ink-500 focus-visible:border-ink-800 focus-visible:shadow-focus"
            />
            {filtered && (
              <Link href={base} aria-label="Clear the search and filters" className={iconBtnCls("quiet", "absolute top-1/2 right-1.5 -translate-y-1/2")}>
                <X className="size-4" aria-hidden />
              </Link>
            )}
          </form>

          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter by stage">
            <Link href={href(base, { ...cur, stage: undefined, due: false })} aria-pressed={!stage && !due} className={pillCls(!stage && !due)}>
              All
            </Link>
            <Link href={href(base, { ...cur, due: !due })} aria-pressed={due} className={pillCls(due)}>
              Follow up now
              <span className="font-mono text-micro opacity-70">{sum.due}</span>
            </Link>
            {stagesOf(stages, kind).map((s) => (
              <Link key={s.key} href={href(base, { ...cur, stage: stage === s.key ? undefined : s.key })} aria-pressed={stage === s.key} className={pillCls(stage === s.key)}>
                {s.label}
                <span className="font-mono text-micro opacity-70">{sum.byStage[s.key] ?? 0}</span>
              </Link>
            ))}
          </div>
          {tagList.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by tag">
              {tagList.slice(0, 12).map((t) => (
                <Link key={t.tag} href={href(base, { ...cur, tag: tag === t.tag ? undefined : t.tag })} aria-pressed={tag === t.tag} className={pillCls(tag === t.tag)}>
                  {t.tag}
                  <span className="font-mono text-micro opacity-70">{t.n}</span>
                </Link>
              ))}
              {tag && !tagList.slice(0, 12).some((t) => t.tag === tag) && (
                <Link href={href(base, { ...cur, tag: undefined })} aria-pressed className={pillCls(true)}>
                  {tag}
                </Link>
              )}
            </div>
          )}

          {total === 0 ? (
            <EmptyState icon={<Search className="size-6" aria-hidden />} title={`No ${nouns} match`} hint="Try fewer words, or clear the filters." />
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-small text-ink-500">
                  {fmtNum(total)} {total === 1 ? noun : nouns}
                  {filtered ? " match" : ""}. People to follow up come first.
                </p>
                <div className="flex flex-wrap gap-2">
                  {tag && canEdit && (
                    <Link href={`/hub/b/${slug}/mail/campaigns/new?${new URLSearchParams({ tag, kind }).toString()}`} className={btnCls("secondary", "sm")}>
                      <Mail className="size-4" aria-hidden />
                      Email people tagged {tag}
                    </Link>
                  )}
                  {manager && (
                    <a href={exportHref} className={btnCls("secondary", "sm")}>
                      <Download className="size-4" aria-hidden />
                      Download CSV
                    </a>
                  )}
                </div>
              </div>
              <PeopleTable rows={rows} brandId={brandId} slug={slug} kind={kind} stages={stages} total={total} filter={{ q, stage, due, tag }} canEdit={canEdit} manager={manager} />
              {pages > 1 && (
                <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3">
                  {page > 1 ? (
                    <Link href={href(base, { ...cur, page: page - 1 })} className={btnCls("secondary", "sm")}>
                      Previous
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span className="text-small text-ink-500">
                    Page {page} of {pages}
                  </span>
                  {page < pages ? (
                    <Link href={href(base, { ...cur, page: page + 1 })} className={btnCls("secondary", "sm")}>
                      Next
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
