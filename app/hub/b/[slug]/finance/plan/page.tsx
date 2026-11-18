import type { Metadata } from "next";
import { FinancePlanView } from "@/components/hub/finance/plan-view";
import { PlanForm } from "@/components/hub/finance/plan-form";
import { requireFunction } from "@/lib/hub/access";
import { getCurrency, getPlan, monthTotals } from "@/lib/hub/finance/data";
import { lastDayOfMonth } from "@/lib/hub/finance/dates";
import { monthProgress, monthSeries, planTotals, planVsActual } from "@/lib/hub/finance/model";
import { atLeast } from "@/lib/hub/permissions";
import { hubTz, isMonthKey, monthKey, shiftMonth, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Monthly plan" };
export const dynamic = "force-dynamic";

export default async function PlanPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ m?: string | string[] }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand, access } = await requireFunction(slug, "finance");
  const canEdit = atLeast(access.finance, "edit");
  const today = todayIn(hubTz());
  const thisMonth = monthKey(today);
  const asked = Array.isArray(sp.m) ? sp.m[0] : sp.m;
  const month = isMonthKey(asked) && asked <= thisMonth && asked >= shiftMonth(thisMonth, -36) ? asked : thisMonth;
  const [currency, plan, totals] = await Promise.all([getCurrency(brand.id), getPlan(brand.id), monthTotals(brand.id, `${month}-01`, lastDayOfMonth(month))]);

  return (
    <FinancePlanView
      data={{
        base: `/hub/b/${slug}/finance`,
        month,
        prev: shiftMonth(month, -1),
        next: month < thisMonth ? shiftMonth(month, 1) : null,
        currency,
        totals: planTotals(plan),
        actual: totals ? monthSeries(totals, month, month)[0] : null,
        outRows: totals ? planVsActual(plan, totals, month, "out") : [],
        inRows: totals ? planVsActual(plan, totals, month, "in") : [],
        hasPlan: plan.length > 0,
        progress: monthProgress(month, today),
      }}
    >
      {/* Keyed on the saved plan, so the form starts again from what was saved after a save. */}
      {canEdit ? <PlanForm key={JSON.stringify(plan)} brandId={brand.id} plan={plan} currency={currency} /> : null}
    </FinancePlanView>
  );
}
