"use client";

import { useActionState, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Alert, Btn, Chip } from "@/components/brand/primitives";
import { hintCls, inputCls } from "@/components/brand/styles";
import type { FormState } from "@/lib/hub/actions";
import { recordAllIncoming, recordIncoming, setIncomingAside, syncGateway } from "@/lib/hub/finance-incoming-actions";
import { CATEGORIES, LIMITS } from "@/lib/hub/finance/model";

const selectCls = `${inputCls} appearance-auto`;
const Spin = ({ on }: { on: boolean }) => (on ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null);

function Notes({ state }: { state: FormState }) {
  if (!state.error && !state.message) return null;
  return (
    <Alert tone={state.error ? "bad" : "ok"} role={state.error ? "alert" : "status"}>
      {state.error ?? state.message}
    </Alert>
  );
}

/** Reads new payments from one gateway. Nothing reaches the books here: the payments only join the list to review. */
export function SyncForm({ brandId, source, label, more }: { brandId: string; source: string; label: string; more: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(syncGateway, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="source" value={source} />
      <Btn type="submit" variant="primary" size="md" disabled={pending} className="w-full">
        {pending ? <Spin on /> : <RefreshCw className="size-4" aria-hidden />}
        {pending ? `Reading from ${label}` : more ? "Read the older payments" : "Get new payments"}
      </Btn>
      <div aria-live="polite">
        <Notes state={state} />
      </div>
    </form>
  );
}

export type MatchOption = { id: string; label: string; sure: boolean };

/**
 * The decision for one payment: it is the payment of an invoice with exactly the same amount, or it is plain money in. When the
 * payment's own reference names an invoice, that invoice is chosen to start with; otherwise nothing is chosen and the person picks.
 */
export function DecideForm({ brandId, incomingId, matches }: { brandId: string; incomingId: string; matches: MatchOption[] }) {
  const sure = matches.find((m) => m.sure);
  const [as, setAs] = useState(sure ? sure.id : matches.length > 0 ? "" : "in");
  const [category, setCategory] = useState("Sales");
  const [recorded, record, recording] = useActionState<FormState, FormData>(recordIncoming, {});
  const [aside, setAside, settingAside] = useActionState<FormState, FormData>(setIncomingAside, {});
  const busy = recording || settingAside;
  const error = recorded.error ?? aside.error;
  return (
    <div className="mt-3 space-y-3">
      <form action={record} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="brandId" value={brandId} />
        <input type="hidden" name="incomingId" value={incomingId} />
        <div className="min-w-0 flex-1 basis-56">
          <label htmlFor={`as-${incomingId}`} className="mb-1 block text-caption font-semibold text-ink-800">
            What is this payment?
          </label>
          <select id={`as-${incomingId}`} name="as" value={as} onChange={(e) => setAs(e.target.value)} required className={`${selectCls} h-12`}>
            {matches.length > 0 && !sure && (
              <option value="" disabled>
                Choose one
              </option>
            )}
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                Payment of {m.label}
              </option>
            ))}
            <option value="in">Money in, not an invoice</option>
          </select>
        </div>
        {as === "in" && (
          <div className="min-w-0 flex-1 basis-40">
            <label htmlFor={`cat-${incomingId}`} className="mb-1 block text-caption font-semibold text-ink-800">
              Category
            </label>
            <input id={`cat-${incomingId}`} name="category" list={`cats-${incomingId}`} value={category} onChange={(e) => setCategory(e.target.value)} maxLength={LIMITS.category} required autoComplete="off" className={`${inputCls} h-12`} />
            <datalist id={`cats-${incomingId}`}>
              {CATEGORIES.in.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        )}
        <Btn type="submit" variant="primary" size="md" disabled={busy || as === ""} className="w-full sm:w-auto">
          <Spin on={recording} />
          Record
        </Btn>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={hintCls}>
          {matches.length > 0 ? (sure ? "The payment's reference names this invoice. Check it, then record." : "An unpaid invoice has this exact amount. Check who paid before you match it.") : "No unpaid invoice has this amount."}
        </p>
        <form action={setAside}>
          <input type="hidden" name="brandId" value={brandId} />
          <input type="hidden" name="incomingId" value={incomingId} />
          <Btn type="submit" variant="ghost" size="xs" disabled={busy}>
            Set aside
          </Btn>
        </form>
      </div>
      <p aria-live="polite" className="text-caption text-danger-ink">
        {error}
      </p>
    </div>
  );
}

/** Puts a payment that was set aside back in the list. */
export function PutBack({ brandId, incomingId }: { brandId: string; incomingId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setIncomingAside, {});
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="incomingId" value={incomingId} />
      <input type="hidden" name="to" value="new" />
      <Chip tone="neutral">Set aside</Chip>
      <Btn type="submit" variant="ghost" size="xs" disabled={pending}>
        Put back
      </Btn>
      {state.error && (
        <span role="alert" className="text-caption text-danger-ink">
          {state.error}
        </span>
      )}
    </form>
  );
}

/** Records every payment that could not be an invoice's, in one go. The ones that could be are left for a decision. */
export function RecordAllForm({ brandId, count }: { brandId: string; count: number }) {
  const [asking, setAsking] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await recordAllIncoming(prev, fd);
    if (r.message) setAsking(false);
    return r;
  }, {});
  if (count === 0) return null;
  return (
    <div className="space-y-3">
      {!asking ? (
        <Btn variant="secondary" size="sm" onClick={() => setAsking(true)} className="h-auto min-h-11 w-full whitespace-normal py-2 sm:w-auto">
          Record the {count} with no matching invoice
        </Btn>
      ) : (
        <form action={action} className="space-y-3 rounded-field bg-paper-100 p-4">
          <input type="hidden" name="brandId" value={brandId} />
          <p className="text-small text-ink-800">
            Every waiting payment that has <strong className="font-semibold">no unpaid invoice of the same amount</strong> becomes money in, with the gateway&apos;s fee as money out. Payments that could be an invoice&apos;s stay in the list for you to decide.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 basis-40">
              <label htmlFor="all-cat" className="mb-1 block text-caption font-semibold text-ink-800">
                Category for all of them
              </label>
              <input id="all-cat" name="category" defaultValue="Sales" maxLength={LIMITS.category} required autoComplete="off" className={`${inputCls} h-12`} />
            </div>
            <Btn type="submit" variant="primary" size="md" disabled={pending}>
              <Spin on={pending} />
              Record them
            </Btn>
            <Btn variant="secondary" size="md" onClick={() => setAsking(false)}>
              Not now
            </Btn>
          </div>
        </form>
      )}
      <div aria-live="polite">
        <Notes state={state} />
      </div>
    </div>
  );
}
