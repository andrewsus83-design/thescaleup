import type { Metadata } from "next";
import { Card } from "@/components/brand/primitives";
import { groupTitleCls } from "@/components/brand/styles";
import { CurrencyForm } from "@/components/hub/finance/forms";
import { FinanceHomeView } from "@/components/hub/finance/home-view";
import { requireFunction } from "@/lib/hub/access";
import { getCurrency, getPlan, listEntries, listInvoices, monthTotals } from "@/lib/hub/finance/data";
import { lastDayOfMonth } from "@/lib/hub/finance/dates";
import { monthProgress, monthSeries, owed, planTotals, planVsActual } from "@/lib/hub/finance/model";
import { atLeast } from "@/lib/hub/permissions";
import { hubTz, monthKey, shiftMonth, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Finance" };
export const dynamic = "force-dynamic";

export default async function FinancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, access } = await requireFunction(slug, "finance");
  const canEdit = atLeast(access.finance, "edit");
  const today = todayIn(hubTz());
  const month = monthKey(today);
  const first = shiftMonth(month, -5);
  const [currency, totals, invoices, plan, list] = await Promise.all([
    getCurrency(brand.id),
    monthTotals(brand.id, `${first}-01`, lastDayOfMonth(month)),
    listInvoices(brand.id),
    getPlan(brand.id),
    listEntries(brand.id, `${month}-01`, lastDayOfMonth(month)),
  ]);
  const series = totals ? monthSeries(totals, first, month) : [];

  return (
    <FinanceHomeView
      data={{
        base: `/hub/b/${slug}/finance`,
        month,
        currency,
        sum: totals ? series[series.length - 1] : null,
        series,
        plan: plan.length > 0 ? planTotals(plan) : null,
        spending: totals ? planVsActual(plan, totals, month, "out") : [],
        progress: monthProgress(month, today),
        owed: owed(invoices.open, today),
        owedMore: invoices.openMore,
        recent: list.entries.slice(0, 6),
        canEdit,
      }}
    >
      {canEdit && (
        <section aria-labelledby="fin-set" className="pt-4">
          <Card small>
            <h2 id="fin-set" className={`${groupTitleCls} mb-4`}>
              Settings
            </h2>
            <CurrencyForm brandId={brand.id} currency={currency} />
          </Card>
        </section>
      )}
      <p className="text-small text-ink-500">This is a cash book for running the business. It is not formal accounting and it does not work out tax: your accountant&apos;s books stay the record for that.</p>
    </FinanceHomeView>
  );
}
