import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isCurrency, type Currency } from "../money";
import { isEntryKind, isInvoiceStatus, LIMITS, readPlan, readTotals, type Entry, type Invoice, type PlanLine, type TotalRow } from "./model";

// Reads for Finance. Service role only: every caller has already checked the Finance access.
// Totals always come from the database's own sum (fin_month_totals), never from adding up a page of rows, so a long month cannot be undercounted.

const db = () => createSupabaseAdminClient();
const num = (v: unknown) => (typeof v === "number" ? v : Number(v));

export const getCurrency = cache(async (brandId: string): Promise<Currency> => {
  const { data } = await db().from("fin_settings").select("currency").eq("brand_id", brandId).maybeSingle();
  return isCurrency(data?.currency) ? data.currency : "IDR";
});

type EntryRow = { id: string; kind: string; day: string; amount_cents: number | string; category: string; note: string; invoice_id: string | null };

/** The newest entries from `from` to `to` (both included), at most LIMITS.list of them, and whether there are more. */
export async function listEntries(brandId: string, from: string, to: string): Promise<{ entries: Entry[]; more: boolean }> {
  const { data } = await db()
    .from("fin_entries")
    .select("id, kind, day, amount_cents, category, note, invoice_id")
    .eq("brand_id", brandId)
    .gte("day", from)
    .lte("day", to)
    .order("day", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LIMITS.list + 1);
  const rows = ((data ?? []) as EntryRow[]).filter((r) => isEntryKind(r.kind));
  return {
    entries: rows.slice(0, LIMITS.list).map((r) => ({ id: r.id, kind: r.kind as Entry["kind"], day: r.day, amount: num(r.amount_cents), category: r.category, note: r.note, invoiceId: r.invoice_id })),
    more: rows.length > LIMITS.list,
  };
}

/** Totals per month, kind and category, added up by the database. null when they could not be read: a page must then say so, never show zeros. */
export async function monthTotals(brandId: string, from: string, to: string): Promise<TotalRow[] | null> {
  const { data, error } = await db().rpc("fin_month_totals", { p_brand: brandId, p_from: from, p_to: to });
  if (error) {
    console.error("[finance] totals failed:", error.message);
    return null;
  }
  return readTotals(data);
}

type InvoiceRow = { id: string; number: string; client: string; issued: string; due: string; amount_cents: number | string; status: string; paid_on: string | null; note: string };
const INVOICE_COLS = "id, number, client, issued, due, amount_cents, status, paid_on, note";
const toInvoice = (r: InvoiceRow): Invoice => ({ id: r.id, number: r.number, client: r.client, issued: r.issued, due: r.due, amount: num(r.amount_cents), status: isInvoiceStatus(r.status) ? r.status : "unpaid", paidOn: r.paid_on, note: r.note });

/** Every unpaid invoice (oldest due date first), then the most recent paid and void ones. `more` says older settled ones exist. */
export async function listInvoices(brandId: string): Promise<{ open: Invoice[]; settled: Invoice[]; more: boolean; openMore: boolean }> {
  const [open, settled] = await Promise.all([
    db().from("fin_invoices").select(INVOICE_COLS).eq("brand_id", brandId).eq("status", "unpaid").order("due").limit(501),
    db().from("fin_invoices").select(INVOICE_COLS).eq("brand_id", brandId).neq("status", "unpaid").order("issued", { ascending: false }).limit(LIMITS.list + 1),
  ]);
  const o = ((open.data ?? []) as InvoiceRow[]).map(toInvoice);
  const s = ((settled.data ?? []) as InvoiceRow[]).map(toInvoice);
  return { open: o.slice(0, 500), settled: s.slice(0, LIMITS.list), more: s.length > LIMITS.list, openMore: o.length > 500 };
}

export async function getInvoice(brandId: string, id: string): Promise<Invoice | null> {
  const { data } = await db().from("fin_invoices").select(INVOICE_COLS).eq("brand_id", brandId).eq("id", id).maybeSingle();
  return data ? toInvoice(data as InvoiceRow) : null;
}

/** The latest invoice numbers, to suggest the next one. */
export async function recentNumbers(brandId: string): Promise<string[]> {
  const { data } = await db().from("fin_invoices").select("number").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(20);
  return (data ?? []).map((r) => r.number as string);
}

/** The brand's monthly plan. Empty when none was set, or when the plan table is not there yet. */
export async function getPlan(brandId: string): Promise<PlanLine[]> {
  const { data, error } = await db().from("fin_budgets").select("kind, category, amount_cents").eq("brand_id", brandId).limit(200);
  if (error) {
    console.error("[finance] plan failed:", error.message);
    return [];
  }
  return readPlan(data);
}
