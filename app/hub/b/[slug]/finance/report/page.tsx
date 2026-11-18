import type { Metadata } from "next";
import Link from "next/link";
import { Alert, PageHeader } from "@/components/brand/primitives";
import { groupTitleCls, listCls, rowHeadCls, tableCls, tableWrapCls, tbodyCls, tdCls, thCls, theadCls } from "@/components/brand/styles";
import { cn } from "@/lib/utils";
import { BackLink } from "@/components/hub/back-link";
import { requireFunction } from "@/lib/hub/access";
import { getCurrency, monthTotals } from "@/lib/hub/finance/data";
import { lastDayOfMonth } from "@/lib/hub/finance/dates";
import { byCategory, monthSeries, type CategorySum } from "@/lib/hub/finance/model";
import { fmtMoney } from "@/lib/hub/money";
import { hubTz, isMonthKey, monthKey, monthLabel, shiftMonth, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Monthly report" };
export const dynamic = "force-dynamic";

function Cats({ title, rows, currency }: { title: string; rows: CategorySum[]; currency: string }) {
  return (
    <section aria-label={title}>
      <h3 className={cn(groupTitleCls, "mb-2")}>{title}</h3>
      {rows.length === 0 ? (
        <p className="text-small text-ink-500">Nothing this month.</p>
      ) : (
        <ul className={listCls}>
          {rows.map((r) => (
            <li key={r.category} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-small">
              <span className="text-ink-800">{r.category}</span>
              <span className="font-mono text-ink-800">
                {fmtMoney(r.total, currency)} <span className="text-ink-500">({r.share}%)</span>
              </span>
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
      <div className="mx-auto w-full max-w-3xl">
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
    <div className="mx-auto w-full max-w-3xl">
      <BackLink href={base}>Finance</BackLink>
      <PageHeader title="Monthly report" description="The last twelve months: what came in, what went out, and what was left." />

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
      <p className="mt-3 text-small text-ink-500">Left over is money in minus money out by the date each amount was entered for. An invoice counts on the day it was paid, not the day it was sent.</p>

      <section aria-labelledby="rep-month" className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="rep-month" className="font-title text-h3 text-ink-800">
            {monthLabel(month)} by category
          </h2>
          <Link href={`${base}/entries?m=${month}`} className="text-small font-semibold text-brand-700 underline underline-offset-4">
            Open this month&apos;s entries
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <Cats title="Money in" rows={byCategory(totals, month, "in")} currency={currency} />
          <Cats title="Money out" rows={byCategory(totals, month, "out")} currency={currency} />
        </div>
      </section>
    </div>
  );
}
