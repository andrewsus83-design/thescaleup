"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "./actions";
import { getInvoice } from "./finance/data";
import { checkPaidOn, parseEntryInput, parseInvoiceInput, parsePlanInput } from "./finance/model";
import { isCurrency } from "./money";
import { atLeast } from "./permissions";
import { audit } from "./session";
import { str, taskContext, UUID, type Ctx } from "./tasks/context";
import { hubTz, todayIn } from "./tasks/dates";

// Every change in Finance needs "Can edit" on Finance. Each one is written to the audit log, without amounts.

async function financeContext(brandId: unknown): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const c = await taskContext(brandId, "finance");
  if (!c.ok) return c;
  if (!atLeast(c.ctx.level, "edit")) return { ok: false, error: "You can see Finance here but not change it." };
  return c;
}
const fresh = (ctx: Ctx) => revalidatePath(`/hub/b/${ctx.slug}/finance`, "layout");
const fail = (what: string, message: string): FormState => {
  console.error(`[finance] ${what} failed:`, message);
  return { error: "Could not save that. Try again." };
};

export async function saveCurrency(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await financeContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const currency = str(fd, "currency");
  if (!isCurrency(currency)) return { error: "Choose the currency." };
  const { error } = await ctx.admin.from("fin_settings").upsert({ brand_id: ctx.brandId, currency, updated_at: new Date().toISOString(), updated_by: ctx.user.id }, { onConflict: "brand_id" });
  if (error) return fail("saveCurrency", error.message);
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "finance.currency", meta: { currency } });
  fresh(ctx);
  // The amounts are not converted: the brand keeps its books in one currency and this only says which.
  return { message: "Saved. Amounts already entered keep their numbers; only the currency shown changes." };
}

export async function addEntry(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await financeContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const parsed = parseEntryInput({ kind: str(fd, "kind"), day: str(fd, "day"), amount: str(fd, "amount"), category: str(fd, "category"), note: str(fd, "note") }, todayIn(hubTz()));
  if (!parsed.ok) return { error: parsed.error };
  const e = parsed.value;
  const { data, error } = await ctx.admin.from("fin_entries").insert({ brand_id: ctx.brandId, kind: e.kind, day: e.day, amount_cents: e.amount, category: e.category, note: e.note, created_by: ctx.user.id }).select("id");
  if (error) return fail("addEntry", error.message);
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "finance.entry.add", target: data?.[0]?.id as string | undefined, meta: { kind: e.kind } });
  fresh(ctx);
  return { message: e.kind === "in" ? "Money in added." : "Money out added." };
}

export async function deleteEntry(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await financeContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const id = str(fd, "entryId");
  if (!UUID.test(id)) return { error: "Unknown entry." };
  const { data: row } = await ctx.admin.from("fin_entries").select("id, invoice_id").eq("brand_id", ctx.brandId).eq("id", id).maybeSingle();
  if (!row) return { error: "Unknown entry." };
  // An invoice's payment goes away by marking the invoice unpaid, so the two can never disagree.
  if (row.invoice_id) return { error: "This is an invoice payment. Open Invoices and mark that invoice as not paid." };
  const { error } = await ctx.admin.from("fin_entries").delete().eq("brand_id", ctx.brandId).eq("id", id).is("invoice_id", null);
  if (error) return fail("deleteEntry", error.message);
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "finance.entry.delete", target: id });
  fresh(ctx);
  return { message: "Deleted." };
}

export async function addInvoice(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await financeContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const parsed = parseInvoiceInput({ number: str(fd, "number"), client: str(fd, "client"), issued: str(fd, "issued"), due: str(fd, "due"), amount: str(fd, "amount"), note: str(fd, "note") }, todayIn(hubTz()));
  if (!parsed.ok) return { error: parsed.error };
  const v = parsed.value;
  const { data, error } = await ctx.admin.from("fin_invoices").insert({ brand_id: ctx.brandId, number: v.number, client: v.client, issued: v.issued, due: v.due, amount_cents: v.amount, note: v.note, created_by: ctx.user.id }).select("id");
  if (error) {
    if (error.code === "23505") return { error: `Invoice number ${v.number} is already used.` };
    return fail("addInvoice", error.message);
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "finance.invoice.add", target: data?.[0]?.id as string | undefined });
  fresh(ctx);
  return { message: `Invoice ${v.number} added as not paid.` };
}

/**
 * Paid, not paid, or void. Marking an invoice paid adds one money-in entry on the payment date; marking it not paid again removes
 * that entry. A paid invoice cannot be voided: mark it not paid first, so the money is taken back out on purpose.
 */
export async function setInvoiceStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await financeContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const id = str(fd, "invoiceId");
  const to = str(fd, "to");
  const inv = UUID.test(id) ? await getInvoice(ctx.brandId, id) : null;
  if (!inv) return { error: "Unknown invoice." };
  if (inv.status === to) return { message: "Nothing to change." };

  if (to === "paid") {
    if (inv.status !== "unpaid") return { error: "A void invoice cannot be paid. Add it again as a new invoice." };
    const paid = checkPaidOn(str(fd, "paidOn"), inv.issued, todayIn(hubTz()));
    if (!paid.ok) return { error: paid.error };
    // One step in the database changes the invoice and adds the money-in entry together, so they cannot disagree.
    const { data, error } = await ctx.admin.rpc("fin_pay_invoice", { p_brand: ctx.brandId, p_invoice: inv.id, p_paid_on: paid.value, p_user: ctx.user.id });
    if (error) return fail("payInvoice", error.message);
    if (data !== "ok") return { error: data === "paid" ? "This invoice is already marked as paid." : "This invoice changed in the meantime. Reload and try again." };
    await audit({ actor: ctx.user, brandId: ctx.brandId, action: "finance.invoice.paid", target: inv.id });
    fresh(ctx);
    return { message: `Invoice ${inv.number} marked as paid. The money is in Money in and out.` };
  }

  if (to === "unpaid") {
    const { data, error } = await ctx.admin.rpc("fin_unpay_invoice", { p_brand: ctx.brandId, p_invoice: inv.id });
    if (error) return fail("unpayInvoice", error.message);
    if (data !== "ok") return { error: "This invoice changed in the meantime. Reload and try again." };
    await audit({ actor: ctx.user, brandId: ctx.brandId, action: "finance.invoice.unpaid", target: inv.id });
    fresh(ctx);
    return { message: inv.status === "paid" ? `Invoice ${inv.number} is not paid again. Its payment was removed.` : `Invoice ${inv.number} is open again.` };
  }

  if (to === "void") {
    if (inv.status === "paid") return { error: "Mark this invoice as not paid first. Then it can be voided." };
    const up = await ctx.admin.from("fin_invoices").update({ status: "void" }).eq("brand_id", ctx.brandId).eq("id", inv.id).eq("status", "unpaid");
    if (up.error) return fail("voidInvoice", up.error.message);
    await audit({ actor: ctx.user, brandId: ctx.brandId, action: "finance.invoice.void", target: inv.id });
    fresh(ctx);
    return { message: `Invoice ${inv.number} voided. It no longer counts as owed.` };
  }
  return { error: "Unknown change." };
}

/** Replaces the monthly plan with the lines on the form, all at once. */
export async function savePlan(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await financeContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const parsed = parsePlanInput(str(fd, "lines"));
  if (!parsed.ok) return { error: parsed.error };
  const rows = parsed.value.map((l) => ({ kind: l.kind, category: l.category, amount_cents: l.amount }));
  const { error } = await ctx.admin.rpc("fin_save_plan", { p_brand: ctx.brandId, p_rows: rows, p_user: ctx.user.id });
  if (error) return fail("savePlan", error.message);
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "finance.plan.save", meta: { lines: rows.length } });
  fresh(ctx);
  return { message: rows.length === 0 ? "Plan cleared." : `Plan saved with ${rows.length} line${rows.length === 1 ? "" : "s"}.` };
}

/** Deletes an invoice for good. Only a void one: an unpaid invoice is money owed and a paid one is money in the books. */
export async function deleteInvoice(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await financeContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const id = str(fd, "invoiceId");
  const inv = UUID.test(id) ? await getInvoice(ctx.brandId, id) : null;
  if (!inv) return { error: "Unknown invoice." };
  if (inv.status !== "void") return { error: inv.status === "paid" ? "A paid invoice cannot be deleted. Mark it as not paid, void it, then delete it." : "Void this invoice first. Then it can be deleted." };
  const { data, error } = await ctx.admin.from("fin_invoices").delete().eq("brand_id", ctx.brandId).eq("id", inv.id).eq("status", "void").select("id");
  if (error) return fail("deleteInvoice", error.message);
  if (!data?.length) return { error: "This invoice changed in the meantime. Reload and try again." };
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "finance.invoice.delete", target: inv.number });
  fresh(ctx);
  return { message: `Invoice ${inv.number} deleted.` };
}
