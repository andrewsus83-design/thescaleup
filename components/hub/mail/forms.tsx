"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Check, Copy, CornerUpLeft, Loader2, Trash2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { labelCls } from "@/components/brand/styles";
import { compactField } from "@/components/hub/tasks/parts";
import type { FormState } from "@/lib/hub/actions";
import { addAddress, addDomain, checkDomain, removeAddress, removeDomain, sendMail } from "@/lib/hub/mail-actions";
import { cn } from "@/lib/utils";
import { AttachPicker } from "./attach";

function Notice({ state }: { state: FormState }) {
  if (state.error)
    return (
      <Alert tone="bad" role="alert">
        {state.error}
      </Alert>
    );
  if (state.message)
    return (
      <Alert tone="ok" role="status">
        {state.message}
      </Alert>
    );
  return null;
}

const Spin = ({ label }: { label: string }) => <Loader2 className="size-4 animate-spin" aria-label={label} />;

/** Copies one DNS value. The button says what happened, for people who cannot see the icon change. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked: the value is selectable on screen */
        }
      }}
      className="hit-44 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-caption font-semibold text-ink-500 hover:text-ink-800"
      aria-label={`Copy ${label}`}
    >
      {done ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

// ---------------------------------------------------------------------------------------------- Settings → Mailbox
export function AddDomainForm({ brandId }: { brandId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addDomain, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.message) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-4">
      <input type="hidden" name="brandId" value={brandId} />
      <Notice state={state} />
      <div>
        <label htmlFor="md-domain" className={labelCls}>
          Domain
        </label>
        <input id="md-domain" name="domain" required maxLength={253} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="mail.brand.com" className={cn(compactField, "h-12 w-full")} />
        <p className="mt-2 text-caption text-ink-500">
          A domain that is already in Resend is linked as it is, not created again. To receive mail, Resend needs an MX record on this exact domain, so use a subdomain such as mail.brand.com if the domain already has mailboxes (Google Workspace, for example).
        </p>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-small text-ink-800">
        <input type="checkbox" name="receiving" defaultChecked className="size-5 accent-ink-800" />
        Also receive mail on this domain
      </label>
      <Btn type="submit" variant="primary" disabled={pending}>
        {pending ? <Spin label="Adding" /> : "Add domain"}
      </Btn>
    </form>
  );
}

export function DomainActions({ brandId, domainId, verified, linked }: { brandId: string; domainId: string; verified: boolean; linked: boolean }) {
  const [check, checkAction, checking] = useActionState<FormState, FormData>(checkDomain, {});
  const [rm, rmAction, removing] = useActionState<FormState, FormData>(removeDomain, {});
  return (
    <div className="space-y-3">
      <Notice state={check} />
      <Notice state={rm} />
      <div className="flex flex-wrap items-center gap-3">
        <form action={checkAction}>
          <input type="hidden" name="brandId" value={brandId} />
          <input type="hidden" name="domainId" value={domainId} />
          <Btn type="submit" variant={verified ? "secondary" : "primary"} size="sm" disabled={checking}>
            {checking ? <Spin label="Checking" /> : "Check DNS"}
          </Btn>
        </form>
        <details className="group">
          <summary className="hit-44 inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full px-3 text-small font-semibold text-ink-500 hover:text-ink-800 [&::-webkit-details-marker]:hidden">
            <Trash2 className="size-4" aria-hidden />
            {linked ? "Unlink" : "Remove"}
          </summary>
          <form action={rmAction} className="mt-3 flex flex-wrap items-center gap-3 rounded-field bg-paper-100 p-4">
            <input type="hidden" name="brandId" value={brandId} />
            <input type="hidden" name="domainId" value={domainId} />
            <p className="text-small text-ink-800">
              {linked ? "Its addresses stop working here. The domain itself stays in Resend, so other projects keep sending. Past conversations are kept." : "Its addresses stop working. Past conversations are kept."}
            </p>
            <Btn type="submit" variant="danger" size="sm" disabled={removing}>
              {removing ? <Spin label={linked ? "Unlinking" : "Removing"} /> : linked ? "Unlink domain" : "Remove domain"}
            </Btn>
          </form>
        </details>
      </div>
    </div>
  );
}

export function AddAddressForm({ brandId, domains }: { brandId: string; domains: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addAddress, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.message) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-4">
      <input type="hidden" name="brandId" value={brandId} />
      <Notice state={state} />
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <label className="block">
          <span className={labelCls}>Address</span>
          <input name="local" required maxLength={64} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="hello" className={cn(compactField, "h-12 w-full")} />
        </label>
        <span aria-hidden className="hidden pt-9 text-body text-ink-500 sm:block">
          @
        </span>
        <label className="block">
          <span className={labelCls}>Domain</span>
          <select name="domainId" required defaultValue={domains[0]?.id} className={cn(compactField, "h-12 w-full")}>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>Name people see</span>
        <input name="name" maxLength={80} placeholder="Brand Support" className={cn(compactField, "h-12 w-full")} />
      </label>
      <Btn type="submit" variant="primary" disabled={pending}>
        {pending ? <Spin label="Adding" /> : "Add address"}
      </Btn>
    </form>
  );
}

export function RemoveAddressButton({ brandId, addressId, email }: { brandId: string; addressId: string; email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(removeAddress, {});
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="addressId" value={addressId} />
      <Btn type="submit" variant="ghost" size="sm" disabled={pending} aria-label={`Remove ${email}`}>
        {pending ? <Spin label="Removing" /> : "Remove"}
      </Btn>
      {state.error && <span className="text-caption text-danger">{state.error}</span>}
    </form>
  );
}

// ---------------------------------------------------------------------------------------------- Mail
type FromOption = { id: string; email: string; name: string | null };

const rowCls = "flex items-center gap-3 border-b border-hairline focus-within:border-ink-800";
const rowLabel = "w-16 shrink-0 text-small text-ink-500";
const rowInput = "h-12 min-w-0 flex-1 bg-transparent text-body text-ink-800 outline-none placeholder:text-ink-500";

/**
 * Gmail's writing window: a dark "New message" bar, From / To / Subject on lines with only an underline, a large message area and
 * Send underneath. As a reply (threadId set) the server picks the recipients and the subject, so only the message shows.
 */
export function Composer({ brandId, from, threadId, replyTo, onCancel, canAttach, attachHint }: { brandId: string; from?: FromOption[]; threadId?: string; replyTo?: string; onCancel?: () => void; canAttach?: boolean; attachHint?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendMail, {});
  const [showCc, setShowCc] = useState(false);
  const [uploading, setUploading] = useState(false);
  const id = useId();
  const reply = Boolean(threadId);
  return (
    <form action={action} className="overflow-hidden rounded-bubble border border-hairline bg-paper-0">
      <input type="hidden" name="brandId" value={brandId} />
      {threadId && <input type="hidden" name="threadId" value={threadId} />}
      {!reply && <div className="bg-ink-800 px-5 py-3 text-small font-semibold text-paper-100">New message</div>}
      <div className="px-5">
        {!reply && from && (
          <div className={rowCls}>
            <label htmlFor={`${id}-from`} className={rowLabel}>
              From
            </label>
            {from.length === 1 ? (
              <>
                <input type="hidden" name="addressId" value={from[0].id} />
                <p id={`${id}-from`} className="flex h-12 min-w-0 flex-1 items-center truncate text-body text-ink-800">
                  {from[0].name ? `${from[0].name} <${from[0].email}>` : from[0].email}
                </p>
              </>
            ) : (
              <select id={`${id}-from`} name="addressId" required defaultValue={from[0]?.id} className={cn(rowInput, "cursor-pointer")}>
                {from.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ? `${a.name} <${a.email}>` : a.email}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        <div className={rowCls}>
          <label htmlFor={`${id}-to`} className={rowLabel}>
            To
          </label>
          {reply ? (
            <p id={`${id}-to`} className="flex h-12 min-w-0 flex-1 items-center truncate text-body text-ink-800">
              {replyTo}
            </p>
          ) : (
            <input id={`${id}-to`} name="to" required autoCapitalize="none" spellCheck={false} placeholder="name@company.com, another@company.com" className={rowInput} />
          )}
          {!showCc && (
            <button type="button" onClick={() => setShowCc(true)} className="hit-44 min-h-11 shrink-0 rounded-full px-3 text-small font-semibold text-ink-500 hover:text-ink-800">
              Cc
            </button>
          )}
        </div>
        {showCc && (
          <div className={rowCls}>
            <label htmlFor={`${id}-cc`} className={rowLabel}>
              Cc
            </label>
            <input id={`${id}-cc`} name="cc" autoCapitalize="none" spellCheck={false} placeholder="name@company.com" autoFocus className={rowInput} />
          </div>
        )}
        {!reply && (
          <div className={rowCls}>
            <label htmlFor={`${id}-subject`} className={rowLabel}>
              Subject
            </label>
            <input id={`${id}-subject`} name="subject" required maxLength={200} className={rowInput} />
          </div>
        )}
      </div>
      {(state.error || state.message) && (
        <div className="px-5 pt-4">
          <Notice state={state} />
        </div>
      )}
      <textarea
        name="body"
        required
        rows={reply ? 6 : 14}
        maxLength={50000}
        autoFocus={reply}
        aria-label={reply ? "Your reply" : "Message"}
        className="block w-full resize-y bg-transparent px-5 py-4 text-body text-ink-800 outline-none placeholder:text-ink-500 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-inset"
      />
      {canAttach ? <AttachPicker brandId={brandId} onBusy={setUploading} /> : <p className="px-5 pb-4 text-caption text-ink-500">Attachments are not turned on yet. {attachHint ?? "The founder or the agency can set up file storage."}</p>}
      <div className="flex flex-wrap items-center gap-3 border-t border-hairline px-5 py-3">
        <Btn type="submit" variant="primary" disabled={pending || uploading}>
          {pending ? <Spin label="Sending" /> : "Send"}
        </Btn>
        {uploading && <span className="text-caption text-ink-500">Waiting for the files to finish uploading.</span>}
        {onCancel && (
          <Btn variant="secondary" onClick={onCancel}>
            Discard
          </Btn>
        )}
      </div>
    </form>
  );
}

/** Under the last message: a Reply button that opens the writing area in place, like Gmail. */
export function ReplyBox({ brandId, threadId, replyTo, canAttach, attachHint }: { brandId: string; threadId: string; replyTo?: string; canAttach?: boolean; attachHint?: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Btn variant="secondary" onClick={() => setOpen(true)}>
        <CornerUpLeft className="size-4" aria-hidden />
        Reply
      </Btn>
    );
  return <Composer brandId={brandId} threadId={threadId} replyTo={replyTo} canAttach={canAttach} attachHint={attachHint} onCancel={() => setOpen(false)} />;
}

/** The sender's own formatting, in a sandbox: no scripts, no forms, no access to this page, and no remote images or fonts (they would tell the sender the mail was opened). */
export function HtmlFrame({ html }: { html: string }) {
  const doc = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><base target="_blank"><style>body{margin:12px;font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;word-wrap:break-word}img{max-width:100%;height:auto}</style>${html}`;
  return (
    <>
      <p className="mt-2 text-caption text-ink-500">Images and links in the original are turned off.</p>
      <iframe title="Original message" sandbox="" referrerPolicy="no-referrer" srcDoc={doc} className="mt-2 h-80 w-full rounded-field border border-hairline bg-white" />
    </>
  );
}
