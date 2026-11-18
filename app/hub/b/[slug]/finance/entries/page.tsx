import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { Alert, Card, Chip, EmptyState, PageHeader, Stat, StatGrid } from "@/components/brand/primitives";
import { btnCls, groupTitleCls } from "@/components/brand/styles";
import { BackLink } from "@/components/hub/back-link";
import { DeleteEntry, EntryForm } from "@/components/hub/finance/forms";
import { EntryRow } from "@/components/hub/finance/views";
import { requireFunction } from "@/lib/hub/access";
import { getCurrency, listEntries, monthTotals } from "@/lib/hub/finance/data";
import { lastDayOfMonth } from "@/lib/hub/finance/dates";
import { LIMITS, monthSeries } from "@/lib/hub/finance/model";
import { fmtMoney } from "@/lib/hub/money";
import { atLeast } from "@/lib/hub/permissions";
import { fmtDay, hubTz, isMonthKey, monthKey, monthLabel, shiftMonth, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Money in and out" };
export const dynamic = "force-dynamic";

export default async function EntriesPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ m?: string | string[]; add?: string | string[] }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { brand, access } = await requireFunction(slug, "finance");
  const canEdit = atLeast(access.finance, "edit");
  const today = todayIn(hubTz());
  const thisMonth = monthKey(today);
  const asked = Array.isArray(sp.m) ? sp.m[0] : sp.m;
  const month = isMonthKey(asked) && asked >= shiftMonth(thisMonth, -120) && asked <= shiftMonth(thisMonth, 12) ? asked : thisMonth;
  const from = `${month}-01`;
  const to = lastDayOfMonth(month);
  const [currency, list, totals] = await Promise.all([getCurrency(brand.id), listEntries(brand.id, from, to), monthTotals(brand.id, from, to)]);
  const sum = totals ? monthSeries(totals, month, month)[0] : null;
  const href = (m: string) => `/hub/b/${slug}/finance/entries?m=${m}`;
  const add = (Array.isArray(sp.add) ? sp.add[0] : sp.add) === "in" ? "in" : "out";

  return (
    <div>
      <BackLink href={`/hub/b/${slug}/finance`}>Finance</BackLink>
      <PageHeader title="Money in and out" description="Every amount that came in or went out, by month." />

      {/* On a desktop the form stays on the left while the month's list scrolls on the right. On a phone the form comes first. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        {canEdit && (
          <section id="add" aria-labelledby="add-title" className="scroll-mt-6 lg:sticky lg:top-6">
            <Card small>
              <h2 id="add-title" className={`${groupTitleCls} mb-4`}>
                Add an amount
              </h2>
              <EntryForm key={add} brandId={brand.id} today={today} currency={currency} initialKind={add} />
            </Card>
          </section>
        )}

        <section aria-label={`Entries in ${monthLabel(month)}`} className={canEdit ? "lg:col-span-2" : "lg:col-span-3"}>
          <Card small>
            <nav aria-label="Month" className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className={groupTitleCls}>{monthLabel(month)}</h2>
              <div className="flex gap-2">
                <Link href={href(shiftMonth(month, -1))} className={btnCls("secondary", "xs")}>
                  Earlier
                </Link>
                <Link href={href(shiftMonth(month, 1))} className={btnCls("secondary", "xs")}>
                  Later
                </Link>
              </div>
            </nav>

            {sum ? (
              <StatGrid className="mb-5 rounded-field bg-paper-100 p-5">
                <Stat label="Money in" value={<span className="text-h4">{fmtMoney(sum.in, currency)}</span>} />
                <Stat label="Money out" value={<span className="text-h4">{fmtMoney(sum.out, currency)}</span>} />
                <Stat label={sum.net >= 0 ? "Left over" : "Short by"} value={<span className="text-h4">{fmtMoney(Math.abs(sum.net), currency)}</span>} tone={sum.net < 0 ? "bad" : undefined} hint={`From ${sum.entries} entr${sum.entries === 1 ? "y" : "ies"}`} />
              </StatGrid>
            ) : (
              <Alert tone="warn" role="alert" className="mb-5">
                The month&apos;s totals could not be read just now. The entries below are still right.
              </Alert>
            )}

            {list.entries.length === 0 ? (
              <EmptyState icon={<ArrowLeftRight className="size-6" aria-hidden />} title={`Nothing in ${monthLabel(month)}`} hint={canEdit ? "Add the first amount with the form." : "Nobody has added an amount for this month yet."} />
            ) : (
              <ul className="-my-3 divide-y divide-ink-100">
                {list.entries.map((e) => (
                  <EntryRow key={e.id} entry={e} currency={currency}>
                    {e.invoiceId ? <Chip tone="info">Invoice payment</Chip> : canEdit ? <DeleteEntry brandId={brand.id} entryId={e.id} label={`${e.category}, ${fmtMoney(e.amount, currency)}, ${fmtDay(e.day)}`} /> : null}
                  </EntryRow>
                ))}
              </ul>
            )}
            {list.more && <p className="mt-5 text-small text-ink-500">Showing the newest {LIMITS.list} entries of this month. The totals above count all of them.</p>}
          </Card>
        </section>
      </div>
    </div>
  );
}
