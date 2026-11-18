import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Bar, PageHeader } from "@/components/brand/primitives";
import { rowHeadCls, tableCls, tableWrapCls, tbodyCls, tdCls, thCls, theadCls } from "@/components/brand/styles";
import { cn } from "@/lib/utils";
import { BackLink } from "@/components/hub/back-link";
import { requireFunction } from "@/lib/hub/access";
import { getCurrency, monthTotals } from "@/lib/hub/finance/data";
import { lastDayOfMonth } from "@/lib/hub/finance/dates";
import { MonthBars, MoreLink, Panel } from "@/components/hub/finance/views";
import { byCategory, monthSeries, type CategorySum } from "@/lib/hub/finance/model";
import { fmtMoney } from "@/lib/hub/money";
import { hubTz, isMonthKey, monthKey, monthLabel, shiftMonth, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Monthly report" };
export const dynamic = "force-dynamic";

function Cats({ title, rows, currency }: { title: string; rows: CategorySum[]; currency: string }) {
  return (
    <section aria-label={title}>
      <h3 className="label-caps mb-3 text-ink-500">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-small font-normal text-ink-500">Nothing this month.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.category}>
              <div className="mb-2 flex items-baseline justify-between gap-4 text-small">
                <span className="min-w-0 truncate font-semibold text-ink-800">{r.category}</span>
                <span className="shrink-0 whitespace-nowrap font-mono text-ink-800">
                  {fmtMoney(r.total, currency)} <span className="text-ink-500">{r.share}%</span>
                </span>
              </div>
              <Bar value={r.share} tone={title === "Money in" ? "ok" : "neutral"} label={`${r.category}: ${r.share}% of ${title.toLowerCase()}`} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function ReportPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ m?: string | string[] }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand } = await requireFunction(slug, "finance");
  const thisMonth = monthKey(todayIn(hubTz()));
  const first = shiftMonth(thisMonth, -11);
  const asked = Array.isArray(sp.m) ? sp.m[0] : sp.m;
  const month = isMonthKey(asked) && asked >= first && asked <= thisMonth ? asked : thisMonth;
  const [currency, totals] = await Promise.all([getCurrency(brand.id), monthTotals(brand.id, `${first}-01`, lastDayOfMonth(thisMonth))]);
  const base = `/hub/b/${slug}/finance`;

  if (!totals)
    return (
      <div>
        <BackLink href={base}>Finance</BackLink>
        <PageHeader title="Monthly report" />
        <Alert tone="warn" role="alert">
          The totals could not be read just now, so no report is shown. Reload the page. If this stays, the Finance tables may not be set up yet.
        </Alert>
      </div>
    );

  const series = monthSeries(totals, first, thisMonth);
  const year = series.reduce((a, s) => ({ in: a.in + s.in, out: a.out + s.out, net: a.net + s.net }), { in: 0, out: 0, net: 0 });
  const money = (n: number) => fmtMoney(n, currency);
  return (
    <div>
      <BackLink href={base}>Finance</BackLink>
      <PageHeader title="Monthly report" description="The last twelve months: what came in, what went out, and what was left." />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel id="rep-bars" title="Twelve months at a glance">
            <MonthBars series={series} currency={currency} />
          </Panel>
          <Panel id="rep-table" title="Month by month" hint="Choose a month to see its categories.">

      <div className={tableWrapCls}>
        <table className={tableCls}>
          <caption className="sr-only">Money in, out and left over for the last twelve months</caption>
          <thead className={theadCls}>
            <tr>
              {["Month", "Money in", "Money out", "Left over"].map((h, i) => (
                <th key={h} scope="col" className={thCls(i > 0)}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={tbodyCls}>
            {[...series].reverse().map((s) => (
              <tr key={s.month} className={s.month === month ? "bg-paper-100" : undefined}>
                <th scope="row" className={rowHeadCls}>
                  <Link href={`${base}/report?m=${s.month}`} aria-current={s.month === month ? "true" : undefined} className="underline underline-offset-4">
                    {monthLabel(s.month)}
                  </Link>
                </th>
                <td className={tdCls(true)}>{money(s.in)}</td>
                <td className={tdCls(true)}>{money(s.out)}</td>
                <td className={cn(tdCls(true), "font-medium", s.net < 0 && "text-danger-ink")}>
                  {s.net < 0 ? "−" : ""}
                  {money(Math.abs(s.net))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-control border-ink-200 bg-paper-100">
            <tr>
              <th scope="row" className={rowHeadCls}>
                Twelve months
              </th>
              <td className={cn(tdCls(true), "font-medium")}>{money(year.in)}</td>
              <td className={cn(tdCls(true), "font-medium")}>{money(year.out)}</td>
              <td className={cn(tdCls(true), "font-medium", year.net < 0 && "text-danger-ink")}>
                {year.net < 0 ? "−" : ""}
                {money(Math.abs(year.net))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
            <p className="mt-4 text-caption text-ink-500">Left over is money in minus money out by the date each amount was entered for. An invoice counts on the day it was paid, not the day it was sent.</p>
          </Panel>
        </div>

        <Panel id="rep-month" title={`${monthLabel(month)} by category`} action={<MoreLink href={`${base}/entries?m=${month}`}>Entries</MoreLink>} className="lg:sticky lg:top-6">
          <div className="space-y-6">
            <Cats title="Money in" rows={byCategory(totals, month, "in")} currency={currency} />
            <Cats title="Money out" rows={byCategory(totals, month, "out")} currency={currency} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
