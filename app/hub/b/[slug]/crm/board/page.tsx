import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";
import { Alert, EmptyState, PageHeader } from "@/components/brand/primitives";
import { btnCls, pillCls } from "@/components/brand/styles";
import { StageSelect } from "@/components/hub/crm/stage-select";
import { CrmNav, FollowChip, crmBase, listPath } from "@/components/hub/crm/parts";
import { requireFunction } from "@/lib/hub/access";
import { getStages, listPeople } from "@/lib/hub/crm/data";
import { filterPeople, followState, stagesOf, type Kind } from "@/lib/hub/crm/model";
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
  const [{ items, total }, stages] = await Promise.all([listPeople(brand.id, kind), getStages(brand.id)]);
  const columns = stagesOf(stages, kind);
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

      {items.length === 0 ? (
        <EmptyState icon={<BriefcaseBusiness className="size-6" aria-hidden />} title={`No ${noun}s yet`} hint={canEdit ? `Add a ${noun} and they appear in the first column.` : "Nothing has been added yet."} />
      ) : (
        <>
          {total > items.length && (
            <Alert tone="warn" className="mb-4">
              The board shows the {fmtNum(items.length)} most recently changed of {fmtNum(total)} {noun}s.
            </Alert>
          )}
          <div className="-mx-6 flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-6 pb-4 sm:mx-0 sm:px-0">
            {columns.map((col) => {
              const people = filterPeople(items, { q: "", stage: col.key }, today, stages);
              const value = people.reduce((n, p) => n + (p.value ?? 0), 0);
              return (
                <section key={col.key} aria-label={col.label} className="w-72 shrink-0 snap-start rounded-card bg-paper-0 p-3 shadow-raised">
                  <header className="flex items-baseline justify-between gap-2 px-2 pt-1 pb-3">
                    <h2 className="font-title text-body font-bold text-ink-800">{col.label}</h2>
                    <span className="font-mono text-caption text-ink-500">
                      {people.length}
                      {value > 0 ? ` · ${fmtNum(Math.round(value))}` : ""}
                    </span>
                  </header>
                  {people.length === 0 ? (
                    <p className="rounded-bubble border-control border-dashed border-ink-200 px-3 py-6 text-center text-small text-ink-500">Nobody here</p>
                  ) : (
                    <ul className="space-y-3">
                      {people.slice(0, PER_COLUMN).map((p) => (
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
                  {people.length > PER_COLUMN && (
                    <Link href={`${listPath(slug, kind)}?stage=${col.key}`} className={`${btnCls("ghost", "sm")} mt-2`}>
                      See all {people.length}
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
