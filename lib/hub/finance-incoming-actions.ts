"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "./actions";
import { getCurrency, getSourceState, listIncoming, listInvoices } from "./finance/data";
import { LIMITS } from "./finance/model";
import { atLeast } from "./permissions";
import { allow } from "./ratelimit";
import { getBrandKey } from "./secrets";
import { audit } from "./session";
import { str, taskContext, UUID, type Ctx } from "./tasks/context";
import { hubTz } from "./tasks/dates";
import { FETCH_PROBLEM, listPayments } from "./xendit/api";
import { DEFAULT_CATEGORY, matchesFor, nextState, syncWindow, type Incoming } from "./xendit/model";

// Payments read from a brand's own Xendit account. Reading is all the hub does at Xendit. What a payment becomes in the books is
// decided by a person with "Can edit" on Finance, one payment at a time or all the unmatched ones at once.

async function financeEdit(brandId: unknown): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const c = await taskContext(brandId, "finance");
  if (!c.ok) return c;
  if (!atLeast(c.ctx.level, "edit")) return { ok: false, error: "You can see Finance here but not change it." };
  return c;
}
const fresh = (ctx: Ctx) => revalidatePath(`/hub/b/${ctx.slug}/finance`, "layout");
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Reads new payments from Xendit into the waiting list. Stores each payment once, however often it is read. */
export async function syncXendit(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await financeEdit(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  if (!allow(`xendit-sync:${ctx.brandId}`, 30)) return { error: "That is a lot of reads in one hour. Try again later." };
  const key = await getBrandKey(ctx.brandId, "xendit", false);
  if (!key) return { error: "Xendit is not connected for this brand yet. Connect it in Settings, Payments." };

  const [currency, state] = await Promise.all([getCurrency(ctx.brandId), getSourceState(ctx.brandId, "xendit")]);
  const w = syncWindow(state, new Date());
  const got = await listPayments(key, w.since, w.until, hubTz());

  // The books are kept in one currency: a payment in another one is left out, and counted so the person knows.
  const mine = got.payments.filter((p) => p.currency === currency);
  const other = got.payments.length - mine.length;
  let added = 0;
  for (let i = 0; i < mine.length; i += 200) {
    const rows = mine.slice(i, i + 200).map((p: Incoming) => ({ brand_id: ctx.brandId, source: "xendit", external_id: p.externalId, occurred_at: p.occurredAt, day: p.day, amount_cents: p.amount, fee_cents: p.fee, currency: p.currency, channel: p.channel, reference: p.reference }));
    const { data, error } = await ctx.admin.from("fin_incoming").upsert(rows, { onConflict: "brand_id,source,external_id", ignoreDuplicates: true }).select("id");
    if (error) {
      console.error("[finance] xendit store failed:", error.message);
      return { error: "The payments were read but could not be saved. Nothing was changed. Try again." };
    }
    added += data?.length ?? 0;
  }

  const next = nextState(state, w, got.ok && got.finished, got.oldest);
  const save = await ctx.admin.from("fin_source_state").upsert({ brand_id: ctx.brandId, source: "xendit", last_synced_at: next.lastSyncedAt, pending_until: next.pendingUntil, pending_started: next.pendingStarted, updated_at: new Date().toISOString() }, { onConflict: "brand_id,source" });
  if (save.error) console.error("[finance] xendit state failed:", save.error.message);
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "finance.xendit.sync", meta: { added, ok: got.ok } });
  fresh(ctx);

  const found = added === 0 ? "No new payments." : `${plural(added, "new payment", "new payments")} to review.`;
  const skipped = other > 0 ? ` ${plural(other, "payment was", "payments were")} left out because ${other === 1 ? "it is" : "they are"} not in ${currency}.` : "";
  if (!got.ok) return { error: `${FETCH_PROBLEM[got.reason]}${added > 0 ? ` Before that, ${plural(added, "payment was", "payments were")} brought in.` : ""}` };
  return { message: `${found}${skipped}${got.finished ? "" : " There are more, older ones to read: press the button again."}` };
}

const RECORD_ERROR: Record<string, string> = {
  missing: "That payment is no longer in the list. Reload the page.",
  recorded: "That payment was already recorded.",
  ignored: "That payment was set aside. Put it back first.",
  no_invoice: "That invoice is not there any more. Reload the page.",
  invoice_paid: "That invoice is already marked as paid. Choose another, or record the payment as plain money in.",
  invoice_void: "That invoice is void. Choose another, or record the payment as plain money in.",
  amount_differs: "The payment and that invoice are not for the same amount, so they were not matched.",
  no_category: "Type a category for this money in.",
};

/** One payment becomes either the payment of an invoice, or plain money in. */
export async function recordIncoming(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await financeEdit(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const id = str(fd, "incomingId");
  const as = str(fd, "as");
  if (!UUID.test(id)) return { error: RECORD_ERROR.missing };
  const invoice = as && as !== "in" ? as : null;
  if (invoice && !UUID.test(invoice)) return { error: RECORD_ERROR.no_invoice };
  const category = str(fd, "category").replace(/\s+/g, " ").trim().slice(0, LIMITS.category) || DEFAULT_CATEGORY;
  const { data, error } = await ctx.admin.rpc("fin_record_incoming", { p_brand: ctx.brandId, p_incoming: id, p_category: category, p_invoice: invoice, p_user: ctx.user.id });
  if (error) {
    console.error("[finance] record incoming failed:", error.message);
    return { error: "Could not record that. Nothing was changed. Try again." };
  }
  if (data !== "ok") return { error: RECORD_ERROR[String(data)] ?? "Could not record that. Nothing was changed." };
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: invoice ? "finance.incoming.match" : "finance.incoming.record", target: id });
  fresh(ctx);
  return { message: invoice ? "Recorded. The invoice is marked as paid." : "Recorded as money in." };
}

/** Sets a payment aside (it is not the brand's income, or it is already in the books), or puts it back in the list. */
export async function setIncomingAside(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await financeEdit(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const id = str(fd, "incomingId");
  const back = str(fd, "to") === "new";
  if (!UUID.test(id)) return { error: RECORD_ERROR.missing };
  const { data, error } = await ctx.admin
    .from("fin_incoming")
    .update(back ? { status: "new", decided_by: null, decided_at: null } : { status: "ignored", decided_by: ctx.user.id, decided_at: new Date().toISOString() })
    .eq("brand_id", ctx.brandId)
    .eq("id", id)
    .eq("status", back ? "ignored" : "new")
    .select("id");
  if (error) return { error: "Could not change that. Try again." };
  if (!data?.length) return { error: "That payment changed in the meantime. Reload the page." };
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: back ? "finance.incoming.restore" : "finance.incoming.ignore", target: id });
  fresh(ctx);
  return { message: back ? "Put back in the list." : "Set aside. It is not in the books." };
}

/**
 * Records every waiting payment that has NO unpaid invoice of the same amount, as plain money in. A payment that could be an
 * invoice's is left for a person: recording it as plain money in and later marking the invoice paid would count the money twice.
 */
export async function recordAllIncoming(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await financeEdit(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  if (!allow(`incoming-all:${ctx.brandId}`, 20)) return { error: "That is a lot in one hour. Try again later." };
  const category = str(fd, "category").replace(/\s+/g, " ").trim().slice(0, LIMITS.category) || DEFAULT_CATEGORY;
  const [list, invoices] = await Promise.all([listIncoming(ctx.brandId), listInvoices(ctx.brandId)]);
  if (!list) return { error: "The list could not be read. Try again." };
  // With more unpaid invoices than were loaded, "no invoice matches" cannot be known for sure: do nothing in bulk.
  if (invoices.openMore) return { error: "There are too many unpaid invoices to check every payment against. Record these one by one." };
  const open = invoices.open.map((i) => ({ id: i.id, number: i.number, client: i.client, amount: i.amount }));
  let done = 0;
  let kept = 0;
  for (const p of list.waiting) {
    if (matchesFor(p, open).length > 0) {
      kept++;
      continue;
    }
    const { data, error } = await ctx.admin.rpc("fin_record_incoming", { p_brand: ctx.brandId, p_incoming: p.id, p_category: category, p_invoice: null, p_user: ctx.user.id });
    if (error) {
      console.error("[finance] record all failed:", error.message);
      break;
    }
    if (data === "ok") done++;
  }
  if (done > 0) await audit({ actor: ctx.user, brandId: ctx.brandId, action: "finance.incoming.record_all", meta: { recorded: done } });
  fresh(ctx);
  const rest = list.waitingCount - list.waiting.length;
  return { message: `${plural(done, "payment", "payments")} recorded as ${category}.${kept > 0 ? ` ${plural(kept, "payment has", "payments have")} the same amount as an unpaid invoice and ${kept === 1 ? "waits" : "wait"} for your decision.` : ""}${rest > 0 ? ` ${rest} more are waiting: press again.` : ""}` };
}
