import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/brand/primitives";
import { btnCls, pillCls } from "@/components/brand/styles";
import { StageSelect } from "@/components/hub/crm/stage-select";
import { CrmNav, FollowChip, crmBase, listPath } from "@/components/hub/crm/parts";
import { requireFunction } from "@/lib/hub/access";
import { NO_FILTER, findPeople, getStages, getSummary } from "@/lib/hub/crm/data";
import { followState, stagesOf, type Kind } from "@/lib/hub/crm/model";
import { atLeast } from "@/lib/hub/permissions";
import { fmtNum } from "@/lib/hub/products/model";
import { canManageTeam } from "@/lib/hub/rules";
import { hubTz, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "CRM · Board" };
export const dynamic = "force-dynamic";

const PER_COLUMN = 25;

export default async function CrmBoardPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand, actor, access } = await requireFunction(slug, "crm");
  const canEdit = atLeast(access.crm, "edit");
  const raw = Array.isArray(sp.kind) ? sp.kind[0] : sp.kind;
  const kind: Kind = raw === "client" ? "client" : "lead";
  const today = todayIn(hubTz());
  const [stages, sum] = await Promise.all([getStages(brand.id), getSummary(brand.id, kind, today)]);
  const columns = stagesOf(stages, kind);
  // Each column asks for its own first cards, so a long list is never cut off before it is split into columns.
  const loaded = await Promise.all(columns.map((c) => (sum.byStage[c.key] ? findPeople(brand.id, kind, { ...NO_FILTER, stage: c.key }, today, 1, PER_COLUMN).then((r) => r.items) : Promise.resolve([]))));
  const options = columns.map((s) => ({ key: s.key, label: s.label }));
  const noun = kind === "lead" ? "lead" : "client";
  const base = `${crmBase(slug)}/board`;

  return (
    <>
      <PageHeader
        title="CRM"
        description="Every stage as a column. Pick a new stage on a card to move that person along."
        action={
          canEdit && (
            <Link href={`${crmBase(slug)}/new?kind=${kind}`} className={btnCls("primary", "md")}>
              Add {noun}
            </Link>
          )
        }
      />
      <CrmNav slug={slug} active="board" manager={canManageTeam(actor)} />
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Board of">
        <Link href={base} aria-pressed={kind === "lead"} className={pillCls(kind === "lead")}>
          Leads
        </Link>
        <Link href={`${base}?kind=client`} aria-pressed={kind === "client"} className={pillCls(kind === "client")}>
          Clients
        </Link>
      </div>

      {sum.total === 0 ? (
        <EmptyState icon={<BriefcaseBusiness className="size-6" aria-hidden />} title={`No ${noun}s yet`} hint={canEdit ? `Add a ${noun} and they appear in the first column.` : "Nothing has been added yet."} />
      ) : (
        <>
          <div className="-mx-6 flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-6 pb-4 sm:mx-0 sm:px-0">
            {columns.map((col, ci) => {
              const people = loaded[ci] ?? [];
              const count = sum.byStage[col.key] ?? 0;
              const value = sum.byStageValue[col.key] ?? 0;
              return (
                <section key={col.key} aria-label={col.label} className="w-72 shrink-0 snap-start rounded-card bg-paper-0 p-3 shadow-raised">
                  <header className="flex items-baseline justify-between gap-2 px-2 pt-1 pb-3">
                    <h2 className="font-title text-body font-bold text-ink-800">{col.label}</h2>
                    <span className="font-mono text-caption text-ink-500">
                      {fmtNum(count)}
                      {value > 0 ? ` · ${fmtNum(Math.round(value))}` : ""}
                    </span>
                  </header>
                  {count === 0 ? (
                    <p className="rounded-bubble border-control border-dashed border-ink-200 px-3 py-6 text-center text-small text-ink-500">Nobody here</p>
                  ) : (
                    <ul className="space-y-3">
                      {people.map((p) => (
                        <li key={p.id} className="rounded-bubble bg-paper-100 p-3">
                          <Link href={`${crmBase(slug)}/${p.id}`} className="block rounded-field focus-visible:shadow-focus focus-visible:outline-none">
                            <span className="block truncate text-body font-semibold text-ink-800">{p.name}</span>
                            {p.company && <span className="block truncate text-small text-ink-500">{p.company}</span>}
                            <span className="mt-2 flex flex-wrap items-center gap-1.5">
                              <FollowChip state={followState(p, today, stages)} date={p.next_follow_up} />
                              {p.value !== null && p.value > 0 && <span className="font-mono text-caption text-ink-800">{fmtNum(p.value)}</span>}
                            </span>
                          </Link>
                          {canEdit && (
                            <div className="mt-3">
                              <StageSelect brandId={brand.id} id={p.id} stage={p.stage} options={options} name={p.name} />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {count > people.length && (
                    <Link href={`${listPath(slug, kind)}?stage=${col.key}`} className={`${btnCls("ghost", "sm")} mt-2`}>
                      See all {fmtNum(count)}
                    </Link>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
