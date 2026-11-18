"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { inputCls, labelCls, pillCls } from "@/components/brand/styles";
import type { FormState } from "@/lib/hub/actions";
import { addEntry, addInvoice, deleteEntry, saveCurrency, setInvoiceStatus } from "@/lib/hub/finance-actions";
import { CATEGORIES, KIND_LABEL, LIMITS, type EntryKind, type InvoiceStatus } from "@/lib/hub/finance/model";
import { CURRENCIES } from "@/lib/hub/money";

const selectCls = `${inputCls} appearance-auto`;

function Notes({ state }: { state: FormState }) {
  return (
    <div aria-live="polite">
      {state.error && (
        <Alert tone="bad" role="alert">
          {state.error}
        </Alert>
      )}
      {state.message && (
        <Alert tone="ok" role="status">
          {state.message}
        </Alert>
      )}
    </div>
  );
}
const Spin = ({ on }: { on: boolean }) => (on ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null);
const AMOUNT_HINT = "Type it like 1.500.000 or 1,500,000.";

/** Add money in or money out. The date and the kind stay after a save, so several entries of one day go in quickly. */
export function EntryForm({ brandId, today, currency, initialKind = "out" }: { brandId: string; today: string; currency: string; initialKind?: EntryKind }) {
  const [kind, setKind] = useState<EntryKind>(initialKind);
  const [v, setV] = useState({ day: today, amount: "", category: "", note: "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((old) => ({ ...old, [k]: e.target.value }));
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await addEntry(prev, fd);
    if (r.message) setV((old) => ({ ...old, amount: "", note: "" }));
    return r;
  }, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="kind" value={kind} />
      <Notes state={state} />
      <div role="radiogroup" aria-label="Kind of entry" className="flex flex-wrap gap-2">
        {(["out", "in"] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => { setKind(k); setV((old) => ({ ...old, category: "" })); }} className={pillCls(kind === k)}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <div>
          <label htmlFor="fe-amount" className={labelCls}>
            Amount ({currency})
          </label>
          <input id="fe-amount" name="amount" inputMode="decimal" value={v.amount} onChange={set("amount")} required autoComplete="off" className={inputCls} aria-describedby="fe-amount-hint" />
          <p id="fe-amount-hint" className="mt-2 text-caption text-ink-500">
            {AMOUNT_HINT}
          </p>
        </div>
        <div>
          <label htmlFor="fe-day" className={labelCls}>
            Date
          </label>
          <input id="fe-day" name="day" type="date" value={v.day} onChange={set("day")} required className={inputCls} />
        </div>
        <div>
          <label htmlFor="fe-cat" className={labelCls}>
            Category
          </label>
          <input id="fe-cat" name="category" list="fe-cats" value={v.category} onChange={set("category")} maxLength={LIMITS.category} required autoComplete="off" placeholder="Choose or type your own" className={inputCls} />
          <datalist id="fe-cats">
            {CATEGORIES[kind].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="fe-note" className={labelCls}>
            Note (optional)
          </label>
          <input id="fe-note" name="note" value={v.note} onChange={set("note")} maxLength={LIMITS.note} autoComplete="off" placeholder="What it was for" className={inputCls} />
        </div>
      </div>
      <Btn type="submit" variant="primary" size="md" disabled={pending}>
        <Spin on={pending} />
        Add {kind === "in" ? "money in" : "money out"}
      </Btn>
    </form>
  );
}

/** Deleting asks once more, in place: an entry cannot be brought back. */
export function DeleteEntry({ brandId, entryId, label }: { brandId: string; entryId: string; label: string }) {
  const [asking, setAsking] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(deleteEntry, {});
  if (!asking)
    return (
      <Btn type="button" variant="ghost" size="xs" onClick={() => setAsking(true)} aria-label={`Delete ${label}`}>
        Delete
      </Btn>
    );
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="entryId" value={entryId} />
      <span className="text-caption text-ink-600" role="status">
        {state.error ?? "Delete this entry for good?"}
      </span>
      <Btn type="submit" variant="danger" size="xs" disabled={pending}>
        Delete
      </Btn>
      <Btn type="button" variant="secondary" size="xs" onClick={() => setAsking(false)}>
        Keep
      </Btn>
    </form>
  );
}

export function InvoiceForm({ brandId, today, currency, suggestedNumber }: { brandId: string; today: string; currency: string; suggestedNumber: string }) {
  const blank = { number: suggestedNumber, client: "", issued: today, due: today, amount: "", note: "" };
  const [v, setV] = useState(blank);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) => setV((old) => ({ ...old, [k]: e.target.value }));
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await addInvoice(prev, fd);
    // The number is cleared too: the page reloads with the next suggestion (the form is keyed on it).
    if (r.message) setV((old) => ({ ...blank, issued: old.issued, due: old.due, number: "" }));
    return r;
  }, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="brandId" value={brandId} />
      <Notes state={state} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <div>
          <label htmlFor="fi-number" className={labelCls}>
            Invoice number
          </label>
          <input id="fi-number" name="number" value={v.number} onChange={set("number")} maxLength={LIMITS.number} required autoComplete="off" className={inputCls} />
        </div>
        <div>
          <label htmlFor="fi-client" className={labelCls}>
            Who it is for
          </label>
          <input id="fi-client" name="client" value={v.client} onChange={set("client")} maxLength={LIMITS.client} required autoComplete="off" className={inputCls} />
        </div>
        <div>
          <label htmlFor="fi-amount" className={labelCls}>
            Amount ({currency})
          </label>
          <input id="fi-amount" name="amount" inputMode="decimal" value={v.amount} onChange={set("amount")} required autoComplete="off" className={inputCls} aria-describedby="fi-amount-hint" />
          <p id="fi-amount-hint" className="mt-2 text-caption text-ink-500">
            {AMOUNT_HINT}
          </p>
        </div>
        <div>
          <label htmlFor="fi-note" className={labelCls}>
            Note (optional)
          </label>
          <input id="fi-note" name="note" value={v.note} onChange={set("note")} maxLength={LIMITS.note} autoComplete="off" className={inputCls} />
        </div>
        <div>
          <label htmlFor="fi-issued" className={labelCls}>
            Invoice date
          </label>
          <input id="fi-issued" name="issued" type="date" value={v.issued} onChange={(e) => setV((old) => ({ ...old, issued: e.target.value, due: old.due >= e.target.value ? old.due : e.target.value }))} required className={inputCls} />
        </div>
        <div>
          <label htmlFor="fi-due" className={labelCls}>
            Due date
          </label>
          <input id="fi-due" name="due" type="date" value={v.due} min={v.issued || undefined} onChange={set("due")} required className={inputCls} />
        </div>
      </div>
      <Btn type="submit" variant="primary" size="md" disabled={pending}>
        <Spin on={pending} />
        Add invoice
      </Btn>
    </form>
  );
}

/** What can be done with one invoice, by its status. Marking it paid asks for the payment date first. */
export function InvoiceActions({ brandId, invoiceId, status, issued, today }: { brandId: string; invoiceId: string; status: InvoiceStatus; issued: string; today: string }) {
  const [paying, setPaying] = useState(false);
  const [paidOn, setPaidOn] = useState(today);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await setInvoiceStatus(prev, fd);
    if (r.message) setPaying(false);
    return r;
  }, {});
  const hidden = (
    <>
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="invoiceId" value={invoiceId} />
    </>
  );
  return (
    <div className="mt-3">
      {status === "unpaid" && paying ? (
        <form action={action} className="flex flex-wrap items-end gap-2">
          {hidden}
          <input type="hidden" name="to" value="paid" />
          <div>
            <label htmlFor={`paid-${invoiceId}`} className="mb-1 block text-caption font-semibold text-ink-800">
              Paid on
            </label>
            <input id={`paid-${invoiceId}`} name="paidOn" type="date" value={paidOn} min={issued} max={today} onChange={(e) => setPaidOn(e.target.value)} required className={`${inputCls} h-11 w-44`} />
          </div>
          <Btn type="submit" variant="primary" size="sm" disabled={pending}>
            <Spin on={pending} />
            Confirm paid
          </Btn>
          <Btn type="button" variant="secondary" size="sm" onClick={() => setPaying(false)}>
            Not yet
          </Btn>
        </form>
      ) : (
        <form action={action} className="flex flex-wrap gap-2">
          {hidden}
          {status === "unpaid" && (
            <>
              <Btn type="button" variant="primary" size="sm" onClick={() => setPaying(true)}>
                Mark as paid
              </Btn>
              <Btn type="submit" name="to" value="void" variant="ghost" size="sm" disabled={pending}>
                Void
              </Btn>
            </>
          )}
          {status === "paid" && (
            <Btn type="submit" name="to" value="unpaid" variant="ghost" size="sm" disabled={pending}>
              Mark as not paid
            </Btn>
          )}
          {status === "void" && (
            <Btn type="submit" name="to" value="unpaid" variant="ghost" size="sm" disabled={pending}>
              Open again
            </Btn>
          )}
        </form>
      )}
      <p aria-live="polite" className={`mt-2 text-caption ${state.error ? "text-danger" : "text-success-ink"}`}>
        {state.error ?? state.message}
      </p>
    </div>
  );
}

export function CurrencyForm({ brandId, currency }: { brandId: string; currency: string }) {
  const [value, setValue] = useState(currency);
  const [state, action, pending] = useActionState<FormState, FormData>(saveCurrency, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="brandId" value={brandId} />
      <Notes state={state} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="fin-cur" className={labelCls}>
            Currency of the books
          </label>
          <select id="fin-cur" name="currency" value={value} onChange={(e) => setValue(e.target.value)} className={`${selectCls} w-40`}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <Btn type="submit" variant="secondary" size="lg" disabled={pending || value === currency}>
          <Spin on={pending} />
          Save currency
        </Btn>
      </div>
      <p className="text-caption text-ink-500">The books are kept in one currency. Changing it does not convert amounts already entered.</p>
    </form>
  );
}
