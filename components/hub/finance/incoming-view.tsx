import Link from "next/link";
import { CreditCard } from "lucide-react";
import { Alert, Chip, EmptyState, PageHeader } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { BackLink } from "@/components/hub/back-link";
import { fmtMoney } from "@/lib/hub/money";
import { fmtDay } from "@/lib/hub/tasks/dates";
import type { IncomingRow } from "@/lib/hub/finance/data";
import { matchesFor, type OpenInvoice } from "@/lib/hub/xendit/model";
import { DecideForm, PutBack, RecordAllForm, SyncForm } from "./incoming";
import { IconBubble, Panel } from "./views";

export type FinanceIncoming = {
  base: string;
  settingsHref: string;
  brandId: string;
  currency: string;
  connected: boolean;
  /** A test-mode key only sees test payments. */
  testMode: boolean;
  canEdit: boolean;
  canConnect: boolean;
  lastRead: string | null;
  /** A read stopped at its page limit: there are older payments still to read. */
  more: boolean;
  /** null when the list could not be read (the database step may not have run). */
  list: { waiting: IncomingRow[]; waitingCount: number; decided: IncomingRow[] } | null;
  invoices: OpenInvoice[];
};

const when = (p: IncomingRow) => `${fmtDay(p.day)}${p.channel ? `, ${p.channel.replace(/^ID_/, "").replace(/_/g, " ")}` : ""}${p.reference ? `, ${p.reference}` : ""}`;

/** Payments read from Xendit: the ones waiting for a decision, the source and its button beside them, and the latest decisions. */
export function FinanceIncomingView({ data }: { data: FinanceIncoming }) {
  const { base, settingsHref, brandId, currency, connected, testMode, canEdit, canConnect, lastRead, more, list, invoices } = data;
  const waiting = list?.waiting ?? [];
  const unmatched = waiting.filter((p) => matchesFor(p, invoices).length === 0).length;

  return (
    <div>
      <BackLink href={base}>Finance</BackLink>
      <PageHeader title="Payments to review" description="Payments read from your payment gateway. Nothing is in the books until you say what each one is." />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:sticky lg:top-6 lg:order-2">
          <section aria-label="Xendit" className="rounded-card bg-ink-800 p-6 text-paper-100 shadow-raised">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="label-caps text-(--acc-tint)">Xendit</p>
              {connected ? <Chip tone={testMode ? "warn" : "ok"}>{testMode ? "Test mode" : "Connected"}</Chip> : <Chip tone="neutral">Not connected</Chip>}
            </div>
            {connected ? (
              <>
                <p className="mt-3 text-small font-normal text-ink-300">{lastRead ? `Last read ${lastRead}.` : "Not read yet. The first read goes back 31 days."} The hub only reads from Xendit.</p>
                {testMode && <p className="mt-2 text-small font-normal text-brand-300">This is a test-mode key, so these are test payments, not real money.</p>}
                {canEdit && (
                  <div className="mt-5">
                    <SyncForm brandId={brandId} more={more} />
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="mt-3 text-small font-normal text-ink-300">{canConnect ? "Connect this brand's own Xendit account with a read-only key. A step-by-step guide is on the settings page." : "The founder or the agency connects Xendit in Settings, Payments."}</p>
                {canConnect && (
                  <Link href={settingsHref} className={btnCls("primary", "md", "mt-5 w-full")}>
                    Connect Xendit
                  </Link>
                )}
              </>
            )}
          </section>
          {connected && canConnect && (
            <p className="px-2 text-caption text-ink-500">
              The key and the guide are in{" "}
              <Link href={settingsHref} className="font-semibold text-brand-700 underline underline-offset-4">
                Settings, Payments
              </Link>
              .
            </p>
          )}
        </div>

        <div className="space-y-4 lg:order-1 lg:col-span-2">
          {list === null ? (
            <Alert tone="warn" role="alert">
              The list could not be read just now. Reload the page. If this stays, the database step for payments may not have been run yet.
            </Alert>
          ) : (
            <>
              <Panel
                id="inc-wait"
                title="Waiting for a decision"
                hint={list.waitingCount === 0 ? undefined : `${list.waitingCount} payment${list.waitingCount === 1 ? "" : "s"}${list.waitingCount > waiting.length ? `, the newest ${waiting.length} shown` : ""}`}
              >
                {waiting.length === 0 ? (
                  <EmptyState
                    icon={<CreditCard className="size-6" aria-hidden />}
                    title="Nothing to review"
                    hint={connected ? (canEdit ? "Press Get new payments to read what came in since the last time." : "New payments show up here once someone reads them from Xendit.") : "Connect Xendit, then the payments you received show up here."}
                  />
                ) : (
                  <>
                    {canEdit && unmatched > 1 && (
                      <div className="mb-5">
                        <RecordAllForm brandId={brandId} count={unmatched} />
                      </div>
                    )}
                    <ul className="-my-4 divide-y divide-ink-100">
                      {waiting.map((p) => {
                        const matches = matchesFor(p, invoices).map((m) => ({ id: m.invoice.id, label: `${m.invoice.number}, ${m.invoice.client}`, sure: m.sure }));
                        return (
                          <li key={p.id} className="py-4">
                            <div className="flex items-start gap-4">
                              <IconBubble icon={CreditCard} />
                              <div className="min-w-0 flex-1">
                                {/* On a phone the amount sits under the description, so neither is squeezed. */}
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                                  <p className="min-w-0 break-words text-body font-semibold text-ink-800">{when(p)}</p>
                                  <p className="shrink-0 whitespace-nowrap font-mono text-small font-medium text-success-ink">+{fmtMoney(p.amount, currency)}</p>
                                </div>
                                <p className="mt-1 text-caption text-ink-500">{p.fee > 0 ? `Xendit kept ${fmtMoney(p.fee, currency)} as its fee. It is recorded as money out.` : "No fee on this payment."}</p>
                              </div>
                            </div>
                            {/* The form takes the full width on a phone, and lines up with the text from tablet up. */}
                            {canEdit && (
                              <div className="sm:pl-15">
                                <DecideForm brandId={brandId} incomingId={p.id} matches={matches} />
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </Panel>

              {list.decided.length > 0 && (
                <Panel id="inc-done" title="Latest decisions">
                  <ul className="-my-3 divide-y divide-ink-100">
                    {list.decided.map((p) => (
                      <li key={p.id} className="flex items-center gap-4 py-3">
                        <IconBubble icon={CreditCard} quiet />
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-small font-semibold text-ink-800">{when(p)}</p>
                          <p className="font-mono text-caption text-ink-600">{fmtMoney(p.amount, currency)}</p>
                        </div>
                        {p.status === "ignored" ? canEdit ? <PutBack brandId={brandId} incomingId={p.id} /> : <Chip tone="neutral">Set aside</Chip> : <Chip tone="ok">{p.invoiceId ? "Invoice paid" : "Money in"}</Chip>}
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </>
          )}
          <p className="px-2 text-caption text-ink-500">Only payments that succeeded are read. Refunds and withdrawals to your bank are not brought in, so enter those by hand.</p>
        </div>
      </div>
    </div>
  );
}
