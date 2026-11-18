import type { Metadata } from "next";
import { ArrowLeftRight, BarChart3, FileText } from "lucide-react";
import { Alert, Card, PageHeader } from "@/components/brand/primitives";
import { CurrencyForm } from "@/components/hub/finance/forms";
import { SectionList } from "@/components/hub/section-list";
import { requireFunction } from "@/lib/hub/access";
import { getCurrency, listInvoices, monthTotals } from "@/lib/hub/finance/data";
import { lastDayOfMonth } from "@/lib/hub/finance/dates";
import { monthSeries, owed } from "@/lib/hub/finance/model";
import { fmtMoney } from "@/lib/hub/money";
import { atLeast } from "@/lib/hub/permissions";
import { hubTz, monthKey, monthLabel, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Finance" };
export const dynamic = "force-dynamic";

export default async function FinancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, access } = await requireFunction(slug, "finance");
  const canEdit = atLeast(access.finance, "edit");
  const today = todayIn(hubTz());
  const month = monthKey(today);
  const [currency, totals, invoices] = await Promise.all([getCurrency(brand.id), monthTotals(brand.id, `${month}-01`, lastDayOfMonth(month)), listInvoices(brand.id)]);
  const now = totals ? monthSeries(totals, month, month)[0] : null;
  const o = owed(invoices.open, today);
  const base = `/hub/b/${slug}/finance`;
  const tiles: [string, string][] = now
    ? [
        ["Money in", fmtMoney(now.in, currency)],
        ["Money out", fmtMoney(now.out, currency)],
        [now.net >= 0 ? "Left over" : "Short by", fmtMoney(Math.abs(now.net), currency)],
      ]
    : [];

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Finance" description="Simple books: what came in, what went out, and who still owes you." />

      <section aria-labelledby="fin-now" className="mb-8">
        <h2 id="fin-now" className="mb-3 font-title text-h3 text-ink-800">
          {monthLabel(month)} so far
        </h2>
        {now ? (
          <Card>
            <dl className="grid gap-4 sm:grid-cols-3">
              {tiles.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-small text-ink-500">{label}</dt>
                  <dd className="font-title text-h3 text-ink-800">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-small text-ink-600">
              {o.unpaidCount === 0
                ? "No invoices are waiting to be paid."
                : `${o.unpaidCount} invoice${o.unpaidCount === 1 ? "" : "s"} not paid yet, ${fmtMoney(o.unpaid, currency)} in total${o.overdueCount > 0 ? `. ${o.overdueCount} of them ${o.overdueCount === 1 ? "is" : "are"} past the due date (${fmtMoney(o.overdue, currency)}).` : "."}`}
              {invoices.openMore ? " Only the first 500 unpaid invoices are counted here." : ""}
            </p>
          </Card>
        ) : (
          <Alert tone="warn" role="alert">
            The totals could not be read just now, so no numbers are shown. Reload the page. If this stays, the Finance tables may not be set up yet.
          </Alert>
        )}
      </section>

      <SectionList
        items={[
          { key: "entries", title: "Money in and out", hint: "Add and review every amount that came in or went out", icon: ArrowLeftRight, href: `${base}/entries` },
          { key: "invoices", title: "Invoices", hint: "Who owes you, what is overdue, and what was paid", icon: FileText, href: `${base}/invoices` },
          { key: "report", title: "Monthly report", hint: "In, out and what is left, month by month and by category", icon: BarChart3, href: `${base}/report` },
        ]}
      />

      {canEdit && (
        <section aria-labelledby="fin-set" className="mt-10">
          <h2 id="fin-set" className="mb-3 font-title text-h3 text-ink-800">
            Settings
          </h2>
          <Card>
            <CurrencyForm brandId={brand.id} currency={currency} />
          </Card>
        </section>
      )}
      <p className="mt-6 text-small text-ink-500">This is a cash book for running the business. It is not formal accounting and it does not work out tax: your accountant&apos;s books stay the record for that.</p>
    </div>
  );
}
