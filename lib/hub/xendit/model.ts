// Pure rules for bringing a brand's Xendit payments into Finance. No I/O and no secrets, so the browser can import it and the
// rules are easy to test. The hub only READS from Xendit here: it lists payments that succeeded, and a person decides what each
// one is (plain money in, or the payment of an invoice). Nothing is created or changed in Xendit.
//
// What is kept from a payment: its id, when, how much, the fee, the channel (e.g. ID_BCA) and the merchant's own reference.
// What is never kept: the payer's account number (`account_identifier`) or anything else about the payer.

import { dayIn } from "../tasks/dates";

export const XENDIT_BASE = "https://api.xendit.co";
export const PAGE_SIZE = 50;
/** Pages read in one press of "Get new payments": 20 pages is 1,000 payments. More than that carries on with the next press. */
export const MAX_PAGES = 20;
/** How far back the first sync looks, and how much every later sync looks back again (a payment can be confirmed late). */
export const FIRST_WINDOW_DAYS = 31;
export const OVERLAP_HOURS = 72;

export type Incoming = {
  externalId: string;
  occurredAt: string;
  day: string;
  amount: number;
  fee: number;
  currency: string;
  channel: string;
  reference: string;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
/** An amount from Xendit (a number in currency units) as hundredths. null when it is not a sane amount. */
const cents = (v: unknown): number | null => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1e12) return null;
  return Math.round(v * 100);
};

/**
 * One transaction from Xendit as a payment to review, or null when it is not one: only money that came IN from a payment that
 * SUCCEEDED counts. Refunds, payouts, withdrawals to the bank, top-ups and failed or pending payments are left out.
 * The fee is what Xendit kept: the amount minus the net amount, when both are in the same currency.
 */
export function parseTransaction(raw: unknown, tz: string): Incoming | null {
  if (!isObj(raw)) return null;
  if (raw.type !== "PAYMENT" || raw.status !== "SUCCESS" || raw.cashflow !== "MONEY_IN") return null;
  const externalId = str(raw.id, 120);
  const currency = str(raw.currency, 8).toUpperCase();
  const amount = cents(raw.amount);
  const created = typeof raw.created === "string" ? new Date(raw.created) : null;
  if (!/^[A-Za-z0-9_.:-]{6,120}$/.test(externalId) || !/^[A-Z]{3}$/.test(currency) || !amount || !created || Number.isNaN(created.getTime())) return null;

  let fee = 0;
  const net = cents(raw.net_amount);
  const netCurrency = str(raw.net_amount_currency, 8).toUpperCase() || currency;
  if (net !== null && netCurrency === currency && net <= amount) fee = amount - net;
  else if (isObj(raw.fee)) {
    // No usable net amount: add up what Xendit says it charged.
    const parts = [raw.fee.xendit_fee, raw.fee.value_added_tax, raw.fee.xendit_withholding_tax, raw.fee.third_party_withholding_tax].map((p) => cents(p) ?? 0);
    const sum = parts.reduce((a, b) => a + b, 0);
    if (sum <= amount) fee = sum;
  }
  return { externalId, occurredAt: created.toISOString(), day: dayIn(tz, created), amount, fee, currency, channel: str(raw.channel_code, 40) || str(raw.channel_category, 40), reference: str(raw.reference_id, 120) };
}

export type Page = { payments: Incoming[]; seen: number; lastId: string | null; oldest: string | null; hasMore: boolean };

/** One page of Xendit's answer. `seen` counts every row Xendit sent, `payments` only the ones that are payments to review. */
export function parsePage(json: unknown, tz: string): Page | null {
  if (!isObj(json) || !Array.isArray(json.data)) return null;
  const payments: Incoming[] = [];
  let lastId: string | null = null;
  let oldest: string | null = null;
  for (const row of json.data) {
    if (isObj(row)) {
      if (typeof row.id === "string" && /^[A-Za-z0-9_.:-]{6,120}$/.test(row.id)) lastId = row.id;
      if (typeof row.created === "string" && !Number.isNaN(Date.parse(row.created)) && (oldest === null || row.created < oldest)) oldest = new Date(row.created).toISOString();
    }
    const p = parseTransaction(row, tz);
    if (p) payments.push(p);
  }
  return { payments, seen: json.data.length, lastId, oldest, hasMore: json.has_more === true };
}

/** The address of one page. Only payments that succeeded are asked for; Xendit is asked again for what it sent, so both are checked here too. */
export function pageQuery(sinceIso: string, untilIso: string, afterId: string | null): string {
  const q = new URLSearchParams({ types: "PAYMENT", statuses: "SUCCESS", "created[gte]": sinceIso, "created[lte]": untilIso, limit: String(PAGE_SIZE) });
  if (afterId) q.set("after_id", afterId);
  return `/transactions?${q}`;
}

export type SyncState = { lastSyncedAt: string | null; pendingUntil: string | null; pendingStarted: string | null };
export type Window = { since: string; until: string; started: string };

/**
 * The stretch of time one press reads. A first sync goes back 31 days. A later one starts 72 hours before the last finished sync,
 * because Xendit can confirm a payment late (the same payment is never stored twice). A sync that stopped at the page limit carries
 * on from where it stopped: Xendit lists newest first, so "where it stopped" is the oldest payment it reached.
 */
export function syncWindow(state: SyncState, now: Date): Window {
  const since = state.lastSyncedAt ? new Date(new Date(state.lastSyncedAt).getTime() - OVERLAP_HOURS * 3_600_000) : new Date(now.getTime() - FIRST_WINDOW_DAYS * 86_400_000);
  if (state.pendingUntil && state.pendingStarted) return { since: since.toISOString(), until: state.pendingUntil, started: state.pendingStarted };
  return { since: since.toISOString(), until: now.toISOString(), started: now.toISOString() };
}

/** What to remember after a press. Finished: the sync is complete up to when it started. Not finished: carry on from the oldest payment reached. */
export function nextState(state: SyncState, w: Window, finished: boolean, oldestReached: string | null): SyncState {
  if (finished) return { lastSyncedAt: w.started, pendingUntil: null, pendingStarted: null };
  // Nothing readable came back, so there is no place to carry on from: leave things as they were and let the next press try again.
  if (!oldestReached) return state;
  return { lastSyncedAt: state.lastSyncedAt, pendingUntil: oldestReached, pendingStarted: w.started };
}

// ---------------------------------------------------------------------------------------------- matching a payment to an invoice
export type OpenInvoice = { id: string; number: string; client: string; amount: number };
export type Match = { invoice: OpenInvoice; sure: boolean };

/**
 * Unpaid invoices this payment could be for: the same amount, to the cent. `sure` is true only when the payment's own reference also
 * names the invoice number. An amount alone is never proof (two clients can owe the same), so a person always confirms.
 */
export function matchesFor(p: Pick<Incoming, "amount" | "reference">, invoices: readonly OpenInvoice[]): Match[] {
  const ref = p.reference.toLowerCase();
  return invoices
    .filter((i) => i.amount === p.amount)
    .map((invoice) => ({ invoice, sure: ref !== "" && invoice.number.trim() !== "" && ref.includes(invoice.number.trim().toLowerCase()) }))
    .sort((a, b) => Number(b.sure) - Number(a.sure) || a.invoice.number.localeCompare(b.invoice.number));
}

/** A line for the entry's note: where the money came from, without anything about the payer. */
export function describe(p: Pick<Incoming, "channel" | "reference">): string {
  return ["Xendit", p.channel, p.reference].filter(Boolean).join(", ").slice(0, 300);
}

/** Whether a saved key is for Xendit's test mode. Test payments are not real money, so the page says so. */
export const isTestKey = (key: string) => key.startsWith("xnd_development_");
export const looksLikeKey = (key: string) => /^xnd_(production|development)_[\x21-\x7e]{10,480}$/.test(key);

export const FEE_CATEGORY = "Payment fees";
export const DEFAULT_CATEGORY = "Sales";
