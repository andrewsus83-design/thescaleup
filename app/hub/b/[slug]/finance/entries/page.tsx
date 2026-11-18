import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { Alert, Card, Chip, EmptyState, PageHeader } from "@/components/brand/primitives";
import { btnCls, listCls } from "@/components/brand/styles";
import { BackLink } from "@/components/hub/back-link";
import { DeleteEntry, EntryForm } from "@/components/hub/finance/forms";
import { requireFunction } from "@/lib/hub/access";
import { getCurrency, listEntries, monthTotals } from "@/lib/hub/finance/data";
import { lastDayOfMonth } from "@/lib/hub/finance/dates";
import { LIMITS, monthSeries } from "@/lib/hub/finance/model";
import { fmtMoney } from "@/lib/hub/money";
import { atLeast } from "@/lib/hub/permissions";
import { fmtDay, hubTz, isMonthKey, monthKey, monthLabel, shiftMonth, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Money in and out" };
export const dynamic = "force-dynamic";

export default async function EntriesPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ m?: string | string[] }> }) {
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

  return (
    <div className="mx-auto w-full max-w-2xl">
      <BackLink href={`/hub/b/${slug}/finance`}>Finance</BackLink>
      <PageHeader title="Money in and out" description="Every amount that came in or went out, by month." />

      {canEdit && (
        <Card className="mb-8">
          <EntryForm brandId={brand.id} today={today} currency={currency} />
        </Card>
      )}

      <nav aria-label="Month" className="mb-4 flex flex-wrap items-center gap-3">
        <Link href={href(shiftMonth(month, -1))} className={btnCls("secondary", "sm")}>
          Earlier
        </Link>
        <p className="font-title text-h4 text-ink-800">{monthLabel(month)}</p>
        <Link href={href(shiftMonth(month, 1))} className={btnCls("secondary", "sm")}>
          Later
        </Link>
      </nav>

      {sum ? (
        <p className="mb-4 text-small text-ink-600">
          In {fmtMoney(sum.in, currency)}, out {fmtMoney(sum.out, currency)}, {sum.net >= 0 ? "left over" : "short by"} <span className="font-semibold text-ink-800">{fmtMoney(Math.abs(sum.net), currency)}</span>, from {sum.entries} entr{sum.entries === 1 ? "y" : "ies"}.
        </p>
      ) : (
        <Alert tone="warn" role="alert" className="mb-4">
          The month&apos;s totals could not be read just now. The entries below are still right.
        </Alert>
      )}

      {list.entries.length === 0 ? (
        <EmptyState icon={<ArrowLeftRight className="size-6" aria-hidden />} title={`Nothing in ${monthLabel(month)}`} hint={canEdit ? "Add the first amount with the form above." : "Nobody has added an amount for this month yet."} />
      ) : (
        <ul className={listCls}>
          {list.entries.map((e) => (
            <li key={e.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <p className="text-body font-semibold text-ink-800">{e.category}</p>
                <p className="font-mono text-body font-medium text-ink-800">
                  {e.kind === "in" ? "+" : "−"}
                  {fmtMoney(e.amount, currency)}
                </p>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <p className="text-small text-ink-500">
                  {fmtDay(e.day)}
                  {e.note ? `, ${e.note}` : ""}
                </p>
                <div className="flex items-center gap-2">
                  <Chip tone={e.kind === "in" ? "ok" : "neutral"}>{e.kind === "in" ? "In" : "Out"}</Chip>
                  {e.invoiceId ? <Chip tone="info">Invoice payment</Chip> : canEdit ? <DeleteEntry brandId={brand.id} entryId={e.id} label={`${e.category}, ${fmtMoney(e.amount, currency)}, ${fmtDay(e.day)}`} /> : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {list.more && <p className="mt-3 text-small text-ink-500">Showing the newest {LIMITS.list} entries of this month. The totals above count all of them.</p>}
    </div>
  );
}
