"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { inputCls, labelCls, textareaCls } from "@/components/brand/styles";
import { compactField } from "@/components/hub/tasks/parts";
import { saveLeadForm } from "@/lib/hub/crm-form-admin-actions";
import { DEFAULT_CONSENT, DEFAULT_THANKS, FORM_LIMITS, type LeadForm } from "@/lib/hub/crm/forms";
import type { FormState } from "@/lib/hub/actions";

const MODE_CHOICES = [
  ["required", "Required"],
  ["optional", "Optional"],
  ["off", "Do not ask"],
] as const;

/** Makes or edits a lead form. Uncontrolled fields, so a failed save keeps what was typed. */
export function FormEditor({ brandId, form }: { brandId: string; form?: LeadForm }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveLeadForm, {});
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="brandId" value={brandId} />
      {form && <input type="hidden" name="id" value={form.id} />}
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

      <section className="space-y-4" aria-label="What people see">
        <h2 className="text-body font-semibold text-ink-800">What people see</h2>
        <div>
          <label htmlFor="f-name" className={labelCls}>
            Form name (only your team sees this)
          </label>
          <input id="f-name" name="name" defaultValue={form?.name} maxLength={FORM_LIMITS.name} required autoComplete="off" placeholder="Webinar November" className={inputCls} />
        </div>
        <div>
          <label htmlFor="f-title" className={labelCls}>
            Heading on the form
          </label>
          <input id="f-title" name="title" defaultValue={form?.title} maxLength={FORM_LIMITS.title} autoComplete="off" placeholder="Leave empty to use the form name" className={inputCls} />
        </div>
        <div>
          <label htmlFor="f-intro" className={labelCls}>
            A few words above the fields
          </label>
          <textarea id="f-intro" name="intro" defaultValue={form?.intro} maxLength={FORM_LIMITS.intro} rows={3} placeholder="Tell us a little about what you need and we will reply within a day." className={textareaCls} />
        </div>
        <div>
          <label htmlFor="f-thanks" className={labelCls}>
            Message after sending
          </label>
          <input id="f-thanks" name="thanks" defaultValue={form?.thanks} maxLength={FORM_LIMITS.thanks} autoComplete="off" placeholder={DEFAULT_THANKS} className={inputCls} />
        </div>
      </section>

      <section className="space-y-4" aria-label="What to ask">
        <h2 className="text-body font-semibold text-ink-800">What to ask</h2>
        <p className="text-small text-ink-500">Their name is always asked. Ask for at least an email or a phone number so you can reach them.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="f-email" className={labelCls}>
              Email
            </label>
            <select id="f-email" name="email_mode" defaultValue={form?.email_mode ?? "required"} className={`${compactField} h-14 w-full rounded-field`}>
              {MODE_CHOICES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-phone" className={labelCls}>
              Phone or WhatsApp
            </label>
            <select id="f-phone" name="phone_mode" defaultValue={form?.phone_mode ?? "optional"} className={`${compactField} h-14 w-full rounded-field`}>
              {MODE_CHOICES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body text-ink-800">
          <input type="checkbox" name="ask_company" value="1" defaultChecked={form?.ask_company ?? false} className="size-5 accent-ink-800" />
          Ask for their company
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body text-ink-800">
          <input type="checkbox" name="ask_message" value="1" defaultChecked={form?.ask_message ?? true} className="size-5 accent-ink-800" />
          Let them write a message
        </label>
        <div>
          <label htmlFor="f-consent" className={labelCls}>
            Tick box
          </label>
          <input id="f-consent" name="consent_text" defaultValue={form ? form.consent_text : DEFAULT_CONSENT} maxLength={FORM_LIMITS.consent} autoComplete="off" className={inputCls} />
          <p className="mt-1 text-caption text-ink-500">People must tick this before they can send. Say what they agree to, for example that you may email them. Leave empty for no tick box. What they ticked is saved in their note.</p>
        </div>
      </section>

      <section className="space-y-4" aria-label="What happens next">
        <h2 className="text-body font-semibold text-ink-800">What happens when someone sends it</h2>
        <p className="text-small text-ink-500">They become a lead in your first lead stage, and anything you set for that stage (a follow-up date, a task) runs. Someone already in your CRM, found by email or phone, is not added twice or changed: they get a note and move to the top.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="f-tags" className={labelCls}>
              Tags to add
            </label>
            <input id="f-tags" name="tags" defaultValue={form?.tags.join(", ") ?? ""} maxLength={300} autoComplete="off" placeholder="webinar nov, website" className={inputCls} />
          </div>
          <div>
            <label htmlFor="f-source" className={labelCls}>
              Where they came from
            </label>
            <input id="f-source" name="source" defaultValue={form?.source} maxLength={FORM_LIMITS.source} autoComplete="off" placeholder="Leave empty to use the form name" className={inputCls} />
          </div>
        </div>
      </section>

      {form && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body text-ink-800">
          <input type="checkbox" name="enabled" value="1" defaultChecked={form.enabled} className="size-5 accent-ink-800" />
          <input type="hidden" name="enabled" value="0" />
          Taking answers (untick to pause the form)
        </label>
      )}

      <Btn type="submit" variant="primary" size="lg" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {form ? "Save changes" : "Make the form"}
      </Btn>
    </form>
  );
}
