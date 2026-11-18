import { FileText } from "lucide-react";
import { Chip, EmptyState } from "@/components/brand/primitives";
import { fmtMoney } from "@/lib/hub/money";
import { diffDays, fmtDay } from "@/lib/hub/tasks/dates";
import { isOverdue, type Invoice, type Owed } from "@/lib/hub/finance/model";
import { IconBubble } from "./views";

const day = (iso: string) => `${fmtDay(iso)} ${iso.slice(0, 4)}`;

/** What clients owe, as a small Ink panel beside the lists. */
export function OwedSummary({ owed: o, currency, more }: { owed: Owed; currency: string; more: boolean }) {
  return (
    <section aria-label="What clients owe" className="rounded-card bg-ink-800 p-6 text-paper-100 shadow-raised">
      <p className="label-caps text-(--acc-tint)">Clients owe you</p>
      <p className="mt-3 break-words font-title text-h2 font-extrabold">{fmtMoney(o.unpaid, currency)}</p>
      <p className="mt-2 text-small font-normal text-ink-300">
        {o.unpaidCount === 0 ? "Nothing is waiting to be paid." : o.overdueCount > 0 ? `${fmtMoney(o.overdue, currency)} of it is past the due date, in ${o.overdueCount} invoice${o.overdueCount === 1 ? "" : "s"}.` : "None of it is late."}
        {more ? " Only the first 500 unpaid invoices are counted." : ""}
      </p>
    </section>
  );
}

/** Invoices as rows: who, how much, the number and dates, and the status in words. `actions` draws the buttons for one invoice. */
export function InvoiceList({
  invoices,
  currency,
  today,
  actions,
  empty,
}: {
  invoices: Invoice[];
  currency: string;
  today: string;
  actions?: (inv: Invoice) => React.ReactNode;
  empty?: { icon: React.ReactNode; title: string; hint: string };
}) {
  if (invoices.length === 0) return empty ? <EmptyState icon={empty.icon} title={empty.title} hint={empty.hint} /> : null;
  return (
    <ul className="-my-4 divide-y divide-ink-100">
      {invoices.map((inv) => {
        const late = isOverdue(inv, today);
        const lateDays = late ? diffDays(today, inv.due) : 0;
        return (
          <li key={inv.id} className="flex items-start gap-4 py-4">
            <IconBubble icon={FileText} quiet={inv.status !== "unpaid"} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-4">
                <p className="min-w-0 truncate text-body font-semibold text-ink-800">{inv.client}</p>
                <p className="shrink-0 whitespace-nowrap font-mono text-small font-medium text-ink-800">{fmtMoney(inv.amount, currency)}</p>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p className="text-caption text-ink-500">
                  {inv.number}, dated {day(inv.issued)}
                  {inv.status === "paid" && inv.paidOn ? `, paid ${day(inv.paidOn)}` : `, due ${day(inv.due)}`}
                  {inv.note ? `, ${inv.note}` : ""}
                </p>
                {inv.status === "paid" ? (
                  <Chip tone="ok">Paid</Chip>
                ) : inv.status === "void" ? (
                  <Chip tone="neutral">Void</Chip>
                ) : late ? (
                  <Chip tone="bad">
                    {lateDays} day{lateDays === 1 ? "" : "s"} late
                  </Chip>
                ) : (
                  <Chip tone="warn">Not paid</Chip>
                )}
              </div>
              {actions?.(inv)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
