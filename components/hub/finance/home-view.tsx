import Link from "next/link";
import { Alert, PageHeader, Stat, StatGrid } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { fmtMoney } from "@/lib/hub/money";
import { monthLabel } from "@/lib/hub/tasks/dates";
import { needsAttentionFirst, type Entry, type MonthSum, type Owed, type PlanRow, type PlanTotals } from "@/lib/hub/finance/model";
import { EntryRow, FINANCE_ICONS, MonthBars, MonthHero, MoreLink, OwedCard, Panel, PlanMeters, Shortcuts, type Shortcut } from "./views";

export type FinanceHome = {
  base: string;
  month: string;
  currency: string;
  /** null when the totals could not be read: the page then says so and shows no numbers. */
  sum: MonthSum | null;
  series: MonthSum[];
  plan: PlanTotals | null;
  /** Money-out categories against the plan, for this month. */
  spending: PlanRow[];
  progress: number;
  owed: Owed;
  owedMore: boolean;
  recent: Entry[];
  canEdit: boolean;
  /** Payments read from a gateway: how many wait for a decision, and whether a gateway is connected. */
  incoming: { waiting: number; connected: boolean };
};

/** The Finance home: the month on an Ink panel, what clients owe, shortcuts, spending against the plan, six months as bars, the latest entries. */
export function FinanceHomeView({ data, children }: { data: FinanceHome; children?: React.ReactNode }) {
  const { base, month, currency, sum, series, plan, spending, progress, owed, owedMore, recent, canEdit, incoming } = data;
  const shortcuts: Shortcut[] = [
    ...(canEdit
      ? [
          { key: "out", label: "Add money out", hint: "A cost or a payment", href: `${base}/entries?add=out#add`, icon: FINANCE_ICONS.out },
          { key: "in", label: "Add money in", hint: "A sale or other income", href: `${base}/entries?add=in#add`, icon: FINANCE_ICONS.in },
          { key: "invoice", label: "Add an invoice", hint: "Track who owes you", href: `${base}/invoices#add`, icon: FINANCE_ICONS.invoice },
        ]
      : [
          { key: "entries", label: "Money in and out", hint: "Every amount, by month", href: `${base}/entries`, icon: FINANCE_ICONS.out },
          { key: "invoices", label: "Invoices", hint: "Who owes you", href: `${base}/invoices`, icon: FINANCE_ICONS.invoice },
          { key: "report", label: "Monthly report", hint: "Twelve months", href: `${base}/report`, icon: FINANCE_ICONS.report },
        ]),
    { key: "plan", label: "Monthly plan", hint: plan ? "Plan against actual" : "Set what you expect", href: `${base}/plan`, icon: FINANCE_ICONS.plan },
  ];
  const hasPlan = plan !== null && plan.out > 0;
  const six = series.reduce((a, s) => ({ in: a.in + s.in, out: a.out + s.out, net: a.net + s.net }), { in: 0, out: 0, net: 0 });

  return (
    <div className="space-y-6">
      <PageHeader title="Finance" description="What came in, what went out, and who still owes you." />

      {sum ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <MonthHero month={month} sum={sum} plan={plan} progress={progress} currency={currency} className="lg:col-span-2" />
          <OwedCard owed={owed} currency={currency} href={`${base}/invoices`} more={owedMore} />
        </div>
      ) : (
        <Alert tone="warn" role="alert">
          The totals could not be read just now, so no numbers are shown. Reload the page. If this stays, the Finance tables may not be set up yet.
        </Alert>
      )}

      {incoming.waiting > 0 && (
        <Alert tone="info" title={`${incoming.waiting} payment${incoming.waiting === 1 ? "" : "s"} from Xendit ${incoming.waiting === 1 ? "waits" : "wait"} for your decision.`}>
          {incoming.waiting === 1 ? "It is" : "They are"} not in the books yet.{" "}
          <Link href={`${base}/incoming`} className="font-semibold text-brand-700 underline underline-offset-4">
            Review {incoming.waiting === 1 ? "it" : "them"}
          </Link>
        </Alert>
      )}

      <Shortcuts items={shortcuts} />
      <p className="px-1 text-small text-ink-500">
        {incoming.connected ? "Xendit is connected. " : "Payments can come in by themselves. "}
        <Link href={`${base}/incoming`} className="font-semibold text-brand-700 underline underline-offset-4">
          {incoming.connected ? "Payments to review" : "Connect Xendit"}
        </Link>
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          id="fin-plan"
          title={`Spending against the plan`}
          hint={hasPlan ? `${monthLabel(month)}, by category` : undefined}
          action={hasPlan ? <MoreLink href={`${base}/plan`}>Open the plan</MoreLink> : undefined}
        >
          {hasPlan ? (
            <PlanMeters rows={needsAttentionFirst(spending)} currency={currency} limit={5} />
          ) : (
            <div className="flex flex-1 flex-col items-start justify-center gap-4 rounded-field bg-paper-100 p-5">
              <p className="text-small font-normal text-ink-600">
                {canEdit ? "Set what you expect to spend each month, per category. This card then shows how much of each is used and warns before one runs over." : "No monthly plan is set yet. Whoever manages Finance can add one."}
              </p>
              {canEdit && (
                <Link href={`${base}/plan`} className={btnCls("primary", "sm")}>
                  Set the monthly plan
                </Link>
              )}
            </div>
          )}
        </Panel>

        <Panel id="fin-months" title="The last six months" action={<MoreLink href={`${base}/report`}>Monthly report</MoreLink>}>
          {series.some((s) => s.in > 0 || s.out > 0) ? (
            <>
              <MonthBars series={series} currency={currency} />
              <StatGrid className="mt-6 border-t border-hairline pt-5">
                <Stat label="In, six months" value={<span className="text-h4">{fmtMoney(six.in, currency)}</span>} />
                <Stat label="Out, six months" value={<span className="text-h4">{fmtMoney(six.out, currency)}</span>} />
                <Stat label={six.net < 0 ? "Short by" : "Left over"} value={<span className="text-h4">{fmtMoney(Math.abs(six.net), currency)}</span>} tone={six.net < 0 ? "bad" : undefined} />
              </StatGrid>
            </>
          ) : <p className="rounded-field bg-paper-100 p-5 text-small font-normal text-ink-600">Nothing has been entered in the last six months. The bars appear with the first amounts.</p>}
        </Panel>
      </div>

      <Panel id="fin-latest" title="Latest entries" hint={monthLabel(month)} action={<MoreLink href={`${base}/entries`}>All entries</MoreLink>}>
        {recent.length === 0 ? (
          <p className="rounded-field bg-paper-100 p-5 text-small font-normal text-ink-600">{canEdit ? "Nothing entered this month yet. Use the shortcuts above to add the first amount." : "Nothing has been entered this month yet."}</p>
        ) : (
          <ul className="-my-3 grid grid-cols-1 gap-x-10 divide-y divide-ink-100 lg:grid-cols-2 lg:divide-y-0">
            {recent.map((e) => (
              <EntryRow key={e.id} entry={e} currency={currency} />
            ))}
          </ul>
        )}
      </Panel>

      {children}
    </div>
  );
}
