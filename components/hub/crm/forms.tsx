"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { inputCls, labelCls, textareaCls } from "@/components/brand/styles";
import { addNote, deletePerson, savePerson } from "@/lib/hub/crm-actions";
import { LIMITS, type Kind, type Person } from "@/lib/hub/crm/model";
import type { FormState } from "@/lib/hub/actions";

function Messages({ state }: { state: FormState }) {
  return (
    <>
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
    </>
  );
}

/** Adds a lead or client (no `person`) or edits one. Uncontrolled fields: a failed save keeps what was typed because the form is not reset. */
export function PersonForm({ brandId, kind, person, contactsHidden = false }: { brandId: string; kind: Kind; person?: Person; contactsHidden?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePerson, {});
  const who = kind === "lead" ? "lead" : "client";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="brandId" value={brandId} />
      {person ? <input type="hidden" name="id" value={person.id} /> : <input type="hidden" name="kind" value={kind} />}
      <Messages state={state} />
      {contactsHidden && (
        <p id="c-hidden" className="text-small text-ink-500">
          Email and phone are hidden for your role, so they stay as they are when you save. Ask a manager if you need to see them.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className={labelCls}>
            Name
          </label>
          <input id="c-name" name="name" defaultValue={person?.name} maxLength={LIMITS.name} required autoComplete="off" className={inputCls} />
        </div>
        <div>
          <label htmlFor="c-company" className={labelCls}>
            Company
          </label>
          <input id="c-company" name="company" defaultValue={person?.company} maxLength={LIMITS.company} autoComplete="off" className={inputCls} />
        </div>
        <div>
          <label htmlFor="c-email" className={labelCls}>
            Email
          </label>
          {contactsHidden ? (
            <input id="c-email" type="text" value={person?.email ?? ""} readOnly aria-describedby="c-hidden" className={`${inputCls} text-ink-500`} />
          ) : (
            <input id="c-email" name="email" type="email" defaultValue={person?.email} maxLength={LIMITS.email} autoComplete="off" className={inputCls} />
          )}
        </div>
        <div>
          <label htmlFor="c-phone" className={labelCls}>
            Phone or WhatsApp
          </label>
          {contactsHidden ? (
            <input id="c-phone" type="text" value={person?.phone ?? ""} readOnly aria-describedby="c-hidden" className={`${inputCls} text-ink-500`} />
          ) : (
            <input id="c-phone" name="phone" type="tel" defaultValue={person?.phone} maxLength={LIMITS.phone} autoComplete="off" className={inputCls} />
          )}
        </div>
        <div>
          <label htmlFor="c-source" className={labelCls}>
            Where they came from
          </label>
          <input id="c-source" name="source" defaultValue={person?.source} maxLength={LIMITS.source} placeholder="Instagram, referral, event…" autoComplete="off" className={inputCls} />
        </div>
        <div>
          <label htmlFor="c-value" className={labelCls}>
            {kind === "lead" ? "What they may be worth" : "What they pay"}
          </label>
          <input id="c-value" name="value" inputMode="decimal" defaultValue={person?.value ?? ""} autoComplete="off" className={inputCls} />
        </div>
        <div>
          <label htmlFor="c-follow" className={labelCls}>
            Next follow-up
          </label>
          <input id="c-follow" name="next_follow_up" type="date" defaultValue={person?.next_follow_up ?? ""} className={inputCls} />
        </div>
        <div>
          <label htmlFor="c-tags" className={labelCls}>
            Tags
          </label>
          <input id="c-tags" name="tags" defaultValue={person?.tags?.join(", ") ?? ""} maxLength={300} placeholder="webinar nov, jakarta" autoComplete="off" className={inputCls} />
          <p className="mt-1 text-caption text-ink-500">Separate tags with commas. Use them to find a group and email only them.</p>
        </div>
      </div>
      <div>
        <label htmlFor="c-summary" className={labelCls}>
          About this {who}
        </label>
        <textarea id="c-summary" name="summary" defaultValue={person?.summary} maxLength={LIMITS.summary} rows={4} placeholder="What they need, who decides, anything worth knowing." className={textareaCls} />
      </div>
      <Btn type="submit" variant="primary" size="lg" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {person ? "Save changes" : `Add ${who}`}
      </Btn>
    </form>
  );
}

/** A new note on the person's log. The box clears once the note is saved. */
export function NoteForm({ brandId, id }: { brandId: string; id: string }) {
  const [body, setBody] = useState("");
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await addNote(prev, fd);
    if (r.message) setBody("");
    return r;
  }, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="id" value={id} />
      <Messages state={state} />
      <label htmlFor="c-note" className="sr-only">
        New note
      </label>
      <textarea id="c-note" name="body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={LIMITS.note} rows={3} required placeholder="Called, sent the quote, they will decide on Friday…" className={textareaCls} />
      <Btn type="submit" variant="secondary" size="md" disabled={pending || !body.trim()}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Add note
      </Btn>
    </form>
  );
}

/** Deleting asks first, in place, and says what goes. */
export function DeletePerson({ brandId, id, name, notes }: { brandId: string; id: string; name: string; notes: number }) {
  return (
    <details>
      <summary className="hit-44 inline-flex min-h-11 cursor-pointer items-center text-small font-semibold text-ink-500 hover:text-ink-800">Delete</summary>
      <form action={deletePerson} className="mt-2 space-y-3 rounded-field bg-paper-100 p-4">
        <input type="hidden" name="brandId" value={brandId} />
        <input type="hidden" name="id" value={id} />
        <p className="text-small text-ink-800">
          Deletes {name}
          {notes > 0 ? ` and ${notes} ${notes === 1 ? "note" : "notes"}` : ""}. This cannot be undone. To keep them but stop following up, move them to Lost or Left instead.
        </p>
        <Btn type="submit" variant="danger" size="sm">
          Delete {name.length > 30 ? `${name.slice(0, 29)}…` : name}
        </Btn>
      </form>
    </details>
  );
}
