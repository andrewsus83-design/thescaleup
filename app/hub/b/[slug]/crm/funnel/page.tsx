import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/brand/primitives";
import { pillCls, tileCls } from "@/components/brand/styles";
import { CrmNav, crmBase } from "@/components/hub/crm/parts";
import { Stat } from "@/components/hub/products/parts";
import { requireFunction } from "@/lib/hub/access";
import { getStages, getSummary, listStageLog } from "@/lib/hub/crm/data";
import { daysAgoIso, funnelStats, type Kind } from "@/lib/hub/crm/model";
import { hubTz, todayIn } from "@/lib/hub/tasks/dates";
import { fmtNum } from "@/lib/hub/products/model";
import { canManageTeam } from "@/lib/hub/rules";
import { BarChart3 } from "lucide-react";

export const metadata: Metadata = { title: "CRM · Funnel" };
export const dynamic = "force-dynamic";

const PERIODS = [
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
  { id: "365", label: "Last year", days: 365 },
  { id: "all", label: "All time", days: null },
] as const;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CrmFunnelPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand, actor } = await requireFunction(slug, "crm");
  const kind: Kind = one(sp.kind) === "client" ? "client" : "lead";
  const period = PERIODS.find((p) => p.id === one(sp.period)) ?? PERIODS[1];
  const since = period.days ? daysAgoIso(period.days) : null;
  const [stages, log, sum] = await Promise.all([getStages(brand.id), listStageLog(brand.id, since), getSummary(brand.id, kind, todayIn(hubTz()))]);
  // Who is where now comes from the database's count per stage, so it covers everyone however long the list is.
  const now = Object.entries(sum.byStage).flatMap(([stage, n]) => Array.from({ length: n }, () => ({ kind, stage })));
  const stats = funnelStats(stages, kind, log, now);
  const max = Math.max(1, ...stats.rows.map((r) => r.entered));
  const noun = kind === "lead" ? "leads" : "clients";
  const href = (k: Kind, p: string) => `${crmBase(slug)}/funnel?kind=${k}&period=${p}`;

  return (
    <>
      <PageHeader title="CRM" description="How many people reach each stage, where they stay and how long they stay there." />
      <CrmNav slug={slug} active="funnel" manager={canManageTeam(actor)} />
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Funnel of">
        <Link href={href("lead", period.id)} aria-pressed={kind === "lead"} className={pillCls(kind === "lead")}>
          Leads
        </Link>
        <Link href={href("client", period.id)} aria-pressed={kind === "client"} className={pillCls(kind === "client")}>
          Clients
        </Link>
      </div>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Period">
        {PERIODS.map((p) => (
          <Link key={p.id} href={href(kind, p.id)} aria-pressed={p.id === period.id} className={pillCls(p.id === period.id)}>
            {p.label}
          </Link>
        ))}
      </div>

      {stats.rows.every((r) => r.entered === 0) ? (
        <EmptyState icon={<BarChart3 className="size-6" aria-hidden />} title="Nothing to count yet" hint={`No ${noun} entered a stage in this period. Add people or move them between stages and the numbers appear here.`} />
      ) : (
        <>
          <dl className={`${tileCls} mb-6 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3`}>
            <Stat label={kind === "lead" ? "Leads who came in" : "Clients who started"} value={fmtNum(stats.started)} />
            {kind === "lead" && <Stat label="Became clients" value={fmtNum(stats.converted)} />}
            {kind === "lead" && <Stat label="Win rate" value={stats.started > 0 ? `${Math.round((stats.converted / stats.started) * 1000) / 10}%` : "–"} />}
          </dl>
          <ul className="space-y-3">
            {stats.rows.map((r) => (
              <li key={r.key} className="rounded-bubble border border-hairline bg-paper-0 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-body font-semibold text-ink-800">{r.label}</span>
                  <span className="font-mono text-h3 font-medium text-ink-800">{fmtNum(r.entered)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-paper-200" role="img" aria-label={`${r.entered} of ${stats.started} reached ${r.label}`}>
                  <div className="h-2 rounded-full bg-(--acc-fill)" style={{ width: `${Math.round((r.entered / max) * 100)}%` }} />
                </div>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-small text-ink-500">
                  {r.reached !== null && r.key !== stats.rows.find((x) => x.open)?.key && <span>{r.reached}% of those who came in</span>}
                  <span>{fmtNum(r.now)} in it now</span>
                  {r.avgDays !== null && <span>stay {r.avgDays} {r.avgDays === 1 ? "day" : "days"} on average</span>}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-small text-ink-500">Each person is counted once per stage. Stay times cover moves made in this period.</p>
        </>
      )}
    </>
  );
}
