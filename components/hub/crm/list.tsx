import Link from "next/link";
import { BriefcaseBusiness, Search, Upload, X } from "lucide-react";
import { Alert, EmptyState, PageHeader } from "@/components/brand/primitives";
import { btnCls, iconBtnCls, pillCls, tileCls } from "@/components/brand/styles";
import { CrmNav, FollowChip, StageChip, crmBase, listPath } from "@/components/hub/crm/parts";
import { Stat } from "@/components/hub/products/parts";
import { getStages, listPeople } from "@/lib/hub/crm/data";
import { filterPeople, followState, followUpsDue, isStageFor, stagesOf, summarize, type Kind } from "@/lib/hub/crm/model";
import { searchTerm } from "@/lib/hub/mail/model";
import { fmtNum } from "@/lib/hub/products/model";
import { hubTz, todayIn } from "@/lib/hub/tasks/dates";

const PER_PAGE = 50;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

type F = { q?: string; stage?: string; due?: boolean; page?: number };
function href(base: string, f: F) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.stage) p.set("stage", f.stage);
  if (f.due) p.set("due", "1");
  if (f.page && f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

/** The Leads and Clients lists are one page with a different kind. */
export async function CrmList({ slug, brandId, kind, canEdit, manager, sp }: { slug: string; brandId: string; kind: Kind; canEdit: boolean; manager: boolean; sp: Record<string, string | string[] | undefined> }) {
  const today = todayIn(hubTz());
  const base = listPath(slug, kind);
  const [{ items, total }, stages] = await Promise.all([listPeople(brandId, kind), getStages(brandId)]);
  const noun = kind === "lead" ? "lead" : "client";
  const nouns = kind === "lead" ? "leads" : "clients";

  const q = searchTerm(one(sp.q));
  const rawStage = one(sp.stage);
  const stage: F["stage"] = rawStage === "open" ? "open" : isStageFor(stages, kind, rawStage) ? rawStage : undefined;
  const due = one(sp.due) === "1";
  const filtered = Boolean(q || stage || due);
  const rows = filterPeople(items, { q, stage, due }, today, stages);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(one(sp.page))) || 1));
  const shown = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const sum = summarize(items, stages);
  const dueCount = followUpsDue(items, today, stages);
  const cur: F = { q, stage, due };

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
              <Link href={`${crmBase(slug)}/new?kind=${kind}`} className={btnCls("primary", "md")}>
                Add {noun}
              </Link>
            </div>
          )
        }
      />
      <CrmNav slug={slug} active={kind === "lead" ? "leads" : "clients"} manager={manager} />

      {items.length === 0 ? (
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
            </div>
          )}
        </EmptyState>
      ) : (
        <>
          {total > items.length && (
            <Alert tone="warn" className="mb-4">
              Showing the {fmtNum(items.length)} most recently changed of {fmtNum(total)} {nouns}.
            </Alert>
          )}
          <dl className={`${tileCls} mb-6 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3`}>
            <Stat label={kind === "lead" ? "Open leads" : "Clients with the brand"} value={fmtNum(sum.open)} />
            <Stat label={kind === "lead" ? "Open lead value" : "Client value"} value={fmtNum(sum.openValue)} />
            <Stat label="Follow-ups due" value={fmtNum(dueCount)} />
          </dl>

          <form role="search" method="get" action={base} className="relative mb-4">
            {stage && <input type="hidden" name="stage" value={stage} />}
            {due && <input type="hidden" name="due" value="1" />}
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-500" aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={q}
              maxLength={80}
              autoComplete="off"
              aria-label="Search by name, company, email, phone or source"
              placeholder="Search by name, company or source"
              className="block h-14 w-full rounded-full border-control border-transparent bg-paper-0 pr-12 pl-12 text-body text-ink-800 outline-none placeholder:text-ink-500 focus-visible:border-ink-800 focus-visible:shadow-focus"
            />
            {filtered && (
              <Link href={base} aria-label="Clear the search and filters" className={iconBtnCls("quiet", "absolute top-1/2 right-1.5 -translate-y-1/2")}>
                <X className="size-4" aria-hidden />
              </Link>
            )}
          </form>

          <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter">
            <Link href={href(base, { ...cur, stage: undefined, due: false })} aria-pressed={!stage && !due} className={pillCls(!stage && !due)}>
              All
            </Link>
            <Link href={href(base, { ...cur, due: !due })} aria-pressed={due} className={pillCls(due)}>
              Follow up now
              <span className="font-mono text-micro opacity-70">{dueCount}</span>
            </Link>
            {stagesOf(stages, kind).map((s) => (
              <Link key={s.key} href={href(base, { ...cur, stage: stage === s.key ? undefined : s.key })} aria-pressed={stage === s.key} className={pillCls(stage === s.key)}>
                {s.label}
                <span className="font-mono text-micro opacity-70">{sum.byStage[s.key] ?? 0}</span>
              </Link>
            ))}
          </div>

          {rows.length === 0 ? (
            <EmptyState icon={<Search className="size-6" aria-hidden />} title={`No ${nouns} match`} hint="Try fewer words, or clear the filters." />
          ) : (
            <>
              <p className="mb-3 text-small text-ink-500">
                {fmtNum(rows.length)} {rows.length === 1 ? noun : nouns}. People to follow up come first.
              </p>
              <ul className="divide-y divide-hairline rounded-bubble border border-hairline bg-paper-0">
                {shown.map((p) => (
                  <li key={p.id}>
                    <Link href={`${crmBase(slug)}/${p.id}`} className="flex items-start gap-4 px-5 py-4 hover:bg-paper-100 focus-visible:shadow-focus focus-visible:outline-none">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-semibold text-ink-800">{p.name}</span>
                        {(p.company || p.source) && <span className="mt-0.5 block truncate text-small text-ink-500">{[p.company, p.source].filter(Boolean).join(" · ")}</span>}
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          <StageChip stages={stages} stage={p.stage} />
                          <FollowChip state={followState(p, today, stages)} date={p.next_follow_up} />
                        </span>
                      </span>
                      {p.value !== null && p.value > 0 && <span className="shrink-0 font-mono text-body font-medium text-ink-800">{fmtNum(p.value)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
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
