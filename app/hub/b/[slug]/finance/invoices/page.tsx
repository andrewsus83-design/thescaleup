import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { Card, PageHeader } from "@/components/brand/primitives";
import { groupTitleCls } from "@/components/brand/styles";
import { BackLink } from "@/components/hub/back-link";
import { InvoiceActions, InvoiceForm } from "@/components/hub/finance/forms";
import { InvoiceList, OwedSummary } from "@/components/hub/finance/invoice-views";
import { Panel } from "@/components/hub/finance/views";
import { requireFunction } from "@/lib/hub/access";
import { getCurrency, listInvoices, recentNumbers } from "@/lib/hub/finance/data";
import { nextNumber, owed } from "@/lib/hub/finance/model";
import { atLeast } from "@/lib/hub/permissions";
import { hubTz, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

export default async function InvoicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, access } = await requireFunction(slug, "finance");
  const canEdit = atLeast(access.finance, "edit");
  const today = todayIn(hubTz());
  const [currency, invoices, numbers] = await Promise.all([getCurrency(brand.id), listInvoices(brand.id), canEdit ? recentNumbers(brand.id) : Promise.resolve([])]);
  const o = owed(invoices.open, today);
  const suggested = nextNumber(numbers, today.slice(0, 4));
  const actions = canEdit ? (inv: { id: string; status: "unpaid" | "paid" | "void"; issued: string }) => <InvoiceActions brandId={brand.id} invoiceId={inv.id} status={inv.status} issued={inv.issued} today={today} /> : undefined;

  return (
    <div>
      <BackLink href={`/hub/b/${slug}/finance`}>Finance</BackLink>
      <PageHeader title="Invoices" description="Keep track of the invoices you sent: who owes you, what is late, and what was paid." />

      {/* The lists take two thirds on a desktop; the totals and the form sit beside them. On a phone the totals come first. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:sticky lg:top-6 lg:order-2">
          <OwedSummary owed={o} currency={currency} more={invoices.openMore} />
          {canEdit && (
            <section id="add" aria-labelledby="inv-add" className="scroll-mt-6">
              <Card small>
                <h2 id="inv-add" className={`${groupTitleCls} mb-4`}>
                  Add an invoice
                </h2>
                <InvoiceForm key={suggested} brandId={brand.id} today={today} currency={currency} suggestedNumber={suggested} />
                <p className="mt-4 text-caption text-ink-500">This records an invoice you already sent. The hub does not create or send the invoice document yet.</p>
              </Card>
            </section>
          )}
        </div>

        <div className="space-y-4 lg:order-1 lg:col-span-2">
          <Panel id="inv-open" title="Not paid yet" hint={o.unpaidCount === 0 ? "Nothing is waiting to be paid." : `${o.unpaidCount} invoice${o.unpaidCount === 1 ? "" : "s"}, oldest due date first`}>
            <InvoiceList
              invoices={invoices.open}
              currency={currency}
              today={today}
              actions={actions}
              empty={{ icon: <FileText className="size-6" aria-hidden />, title: "No open invoices", hint: canEdit ? "Add an invoice when you send one. It stays here until it is paid." : "Invoices that are waiting to be paid show up here." }}
            />
          </Panel>

          {invoices.settled.length > 0 && (
            <Panel id="inv-done" title="Paid and void">
              <InvoiceList invoices={invoices.settled} currency={currency} today={today} actions={actions} />
              {invoices.more && <p className="mt-5 text-small text-ink-500">Showing the most recent ones. Older paid invoices still count in the monthly report.</p>}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
