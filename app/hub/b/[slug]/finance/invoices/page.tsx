import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { Card, Chip, EmptyState, PageHeader } from "@/components/brand/primitives";
import { BackLink } from "@/components/hub/back-link";
import { InvoiceActions, InvoiceForm } from "@/components/hub/finance/forms";
import { requireFunction } from "@/lib/hub/access";
import { getCurrency, listInvoices, recentNumbers } from "@/lib/hub/finance/data";
import { isOverdue, nextNumber, owed, type Invoice } from "@/lib/hub/finance/model";
import { fmtMoney } from "@/lib/hub/money";
import { atLeast } from "@/lib/hub/permissions";
import { diffDays, fmtDay, hubTz, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

const day = (iso: string) => `${fmtDay(iso)} ${iso.slice(0, 4)}`;

export default async function InvoicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, access } = await requireFunction(slug, "finance");
  const canEdit = atLeast(access.finance, "edit");
  const today = todayIn(hubTz());
  const [currency, invoices, numbers] = await Promise.all([getCurrency(brand.id), listInvoices(brand.id), canEdit ? recentNumbers(brand.id) : Promise.resolve([])]);
  const o = owed(invoices.open, today);
  const suggested = nextNumber(numbers, today.slice(0, 4));

  const Row = ({ inv }: { inv: Invoice }) => {
    const late = isOverdue(inv, today);
    const lateDays = late ? diffDays(today, inv.due) : 0;
    return (
      <li className="px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-body font-semibold text-ink-800">{inv.client}</p>
          <p className="font-mono text-body font-medium text-ink-800">{fmtMoney(inv.amount, currency)}</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-small text-ink-500">
            {inv.number}, dated {day(inv.issued)}
            {inv.status === "paid" && inv.paidOn ? `, paid ${day(inv.paidOn)}` : `, due ${day(inv.due)}`}
            {inv.note ? `, ${inv.note}` : ""}
          </p>
          {inv.status === "paid" ? <Chip tone="ok">Paid</Chip> : inv.status === "void" ? <Chip tone="neutral">Void</Chip> : late ? <Chip tone="bad">{lateDays} day{lateDays === 1 ? "" : "s"} late</Chip> : <Chip tone="warn">Not paid</Chip>}
        </div>
        {canEdit && <InvoiceActions brandId={brand.id} invoiceId={inv.id} status={inv.status} issued={inv.issued} today={today} />}
      </li>
    );
  };
  const listCls = "divide-y divide-ink-100 overflow-hidden rounded-field border-control border-ink-200";

  return (
    <div className="mx-auto w-full max-w-2xl">
      <BackLink href={`/hub/b/${slug}/finance`}>Finance</BackLink>
      <PageHeader title="Invoices" description="Keep track of the invoices you sent: who owes you, what is late, and what was paid." />

      <div className="space-y-10">
        <section aria-labelledby="inv-open">
          <h2 id="inv-open" className="mb-1 font-title text-h3 text-ink-800">
            Not paid yet
          </h2>
          <p className="mb-3 text-small text-ink-600">
            {o.unpaidCount === 0 ? "Nothing is waiting to be paid." : `${fmtMoney(o.unpaid, currency)} in ${o.unpaidCount} invoice${o.unpaidCount === 1 ? "" : "s"}${o.overdueCount > 0 ? `, of which ${fmtMoney(o.overdue, currency)} is past the due date.` : "."}`}
            {invoices.openMore ? " Only the first 500 are listed and counted." : ""}
          </p>
          {invoices.open.length === 0 ? (
            <EmptyState icon={<FileText className="size-6" aria-hidden />} title="No open invoices" hint={canEdit ? "Add an invoice below when you send one. It stays here until it is paid." : "Invoices that are waiting to be paid show up here."} />
          ) : (
            <ul className={listCls}>
              {invoices.open.map((inv) => (
                <Row key={inv.id} inv={inv} />
              ))}
            </ul>
          )}
        </section>

        {canEdit && (
          <section aria-labelledby="inv-add">
            <h2 id="inv-add" className="mb-3 font-title text-h3 text-ink-800">
              Add an invoice
            </h2>
            <Card>
              <InvoiceForm key={suggested} brandId={brand.id} today={today} currency={currency} suggestedNumber={suggested} />
              <p className="mt-4 text-small text-ink-500">This records an invoice you already sent. The hub does not create or send the invoice document yet.</p>
            </Card>
          </section>
        )}

        {invoices.settled.length > 0 && (
          <section aria-labelledby="inv-done">
            <h2 id="inv-done" className="mb-3 font-title text-h3 text-ink-800">
              Paid and void
            </h2>
            <ul className={listCls}>
              {invoices.settled.map((inv) => (
                <Row key={inv.id} inv={inv} />
              ))}
            </ul>
            {invoices.more && <p className="mt-3 text-small text-ink-500">Showing the most recent ones. Older paid invoices still count in the monthly report.</p>}
          </section>
        )}
      </div>
    </div>
  );
}
