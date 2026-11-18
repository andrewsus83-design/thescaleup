import Link from "next/link";
import { Alert, PageHeader } from "@/components/brand/primitives";
import { btnCls, groupTitleCls } from "@/components/brand/styles";
import { BackLink } from "@/components/hub/back-link";
import { fmtMoney } from "@/lib/hub/money";
import { monthLabel } from "@/lib/hub/tasks/dates";
import type { MonthSum, PlanRow, PlanTotals } from "@/lib/hub/finance/model";
import { Panel, PlanMeters } from "./views";

export type FinancePlan = {
  base: string;
  month: string;
  prev: string;
  /** null on the current month: there is no later month to compare yet. */
  next: string | null;
  currency: string;
  totals: PlanTotals;
  /** null when the month's totals could not be read. */
  actual: MonthSum | null;
  outRows: PlanRow[];
  inRows: PlanRow[];
  hasPlan: boolean;
  /** How far through the month it is, 0 to 100. Under 100 the month's figures are still growing. */
  progress: number;
};

/** A plan figure beside what really happened, on the Ink strip at the top. */
function Versus({ label, plan, actual, currency, good }: { label: string; plan: number; actual: number | null; currency: string; good: "more" | "less" }) {
  const diff = actual === null ? null : actual - plan;
  const fine = diff === null || diff === 0 ? null : good === "more" ? diff > 0 : diff < 0;
  return (
    <div className="min-w-0 rounded-field bg-ink-700 p-4">
      <dt className="text-caption text-ink-300">{label}</dt>
      <dd className="mt-2 whitespace-nowrap font-title text-h4 text-paper-0">{actual === null ? "No figure" : `${actual < 0 ? "−" : ""}${fmtMoney(Math.abs(actual), currency)}`}</dd>
      <dd className="mt-1 text-caption text-ink-300">
        Plan {plan < 0 ? "−" : ""}
        {fmtMoney(Math.abs(plan), currency)}
        {diff !== null && diff !== 0 && (
          <span className={fine ? "text-(--acc-tint)" : "text-brand-300"}>
            {" "}
            ({diff > 0 ? "+" : "−"}
            {fmtMoney(Math.abs(diff), currency)})
          </span>
        )}
      </dd>
    </div>
  );
}

export function FinancePlanView({ data, children }: { data: FinancePlan; children?: React.ReactNode }) {
  const { base, month, prev, next, currency, totals, actual, outRows, inRows, hasPlan, progress } = data;
  const href = (m: string) => `${base}/plan?m=${m}`;
  return (
    <div className="space-y-6">
      <div>
        <BackLink href={base}>Finance</BackLink>
        <PageHeader title="Monthly plan" description="What you expect to bring in and to spend each month, beside what really happened." />
      </div>

      {hasPlan ? (
        <>
          <section aria-label={`${monthLabel(month)} against the plan`} className="rounded-card bg-ink-800 p-6 text-paper-100 shadow-raised sm:p-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="label-caps text-(--acc-tint)">{monthLabel(month)} against the plan</p>
              <nav aria-label="Month" className="flex gap-2">
                <Link href={href(prev)} className={btnCls("dark", "xs", "border-control border-ink-500")}>
                  Earlier
                </Link>
                {next && (
                  <Link href={href(next)} className={btnCls("dark", "xs", "border-control border-ink-500")}>
                    Later
                  </Link>
                )}
              </nav>
            </div>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              <Versus label="Money in" plan={totals.in} actual={actual ? actual.in : null} currency={currency} good="more" />
              <Versus label="Money out" plan={totals.out} actual={actual ? actual.out : null} currency={currency} good="less" />
              <Versus label="Left over" plan={totals.net} actual={actual ? actual.net : null} currency={currency} good="more" />
            </dl>
            {progress < 100 && <p className="mt-4 text-caption text-ink-300">The month is {progress}% through, so these figures are still growing. The plan is for the whole month.</p>}
          </section>

          {actual === null && (
            <Alert tone="warn" role="alert">
              This month&apos;s totals could not be read just now, so the plan is shown without what really happened. Reload the page.
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel id="plan-out" title="Money out" hint="Used of what was planned, by category">
              {outRows.length === 0 ? <p className="rounded-field bg-paper-100 p-5 text-small font-normal text-ink-600">No money out is planned or entered for this month.</p> : <PlanMeters rows={outRows} currency={currency} />}
            </Panel>
            <Panel id="plan-in" title="Money in" hint="Reached of what was planned, by category">
              {inRows.length === 0 ? <p className="rounded-field bg-paper-100 p-5 text-small font-normal text-ink-600">No money in is planned or entered for this month.</p> : <PlanMeters rows={inRows} currency={currency} />}
            </Panel>
          </div>
        </>
      ) : (
        <Alert tone="info">No plan is set yet. {children ? "Fill in the amounts below and save: the comparison with real spending appears here." : "Whoever manages Finance can set one."}</Alert>
      )}

      {children && (
        <section aria-labelledby="plan-edit" className="rounded-card border border-hairline bg-paper-0 p-6 shadow-raised sm:p-8">
          <h2 id="plan-edit" className={`${groupTitleCls} mb-1`}>
            {hasPlan ? "Change the plan" : "Set the plan"}
          </h2>
          <p className="mb-6 text-small font-normal text-ink-500">One plan, used for every month.</p>
          {children}
        </section>
      )}
    </div>
  );
}
