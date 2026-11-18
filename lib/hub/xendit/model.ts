// Xendit's own part of reading payments into Finance: its address, its pages and what one of its transactions means. No I/O and no secrets, so the browser can import it and the
// rules are easy to test. The hub only READS from Xendit here: it lists payments that succeeded, and a person decides what each
// one is (plain money in, or the payment of an invoice). Nothing is created or changed in Xendit.
//
// What is kept from a payment: its id, when, how much, the fee, the channel (e.g. ID_BCA) and the merchant's own reference.
// What is never kept: the payer's account number (`account_identifier`) or anything else about the payer.

import type { Incoming } from "../payments/model";
import { dayIn } from "../tasks/dates";

// The rules every gateway shares live in payments/model. They are passed on from here so older imports keep working.
export { DEFAULT_CATEGORY, FEE_CATEGORY, FIRST_WINDOW_DAYS, matchesFor, nextState, OVERLAP_HOURS, syncWindow } from "../payments/model";
export type { Incoming, Match, OpenInvoice, SyncState, Window } from "../payments/model";

export const XENDIT_BASE = "https://api.xendit.co";
export const PAGE_SIZE = 50;
/** Pages read in one press of "Get new payments": 20 pages is 1,000 payments. More than that carries on with the next press. */
export const MAX_PAGES = 20;
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

/** Whether a saved key is for Xendit's test mode. Test payments are not real money, so the page says so. */
export const isTestKey = (key: string) => key.startsWith("xnd_development_");
export const looksLikeKey = (key: string) => /^xnd_(production|development)_[\x21-\x7e]{10,480}$/.test(key);
