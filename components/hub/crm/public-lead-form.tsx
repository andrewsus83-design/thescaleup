"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { inputCls, labelCls, textareaCls } from "@/components/brand/styles";
import { submitLead } from "@/lib/hub/crm-form-actions";
import { FORM_LIMITS, type Mode } from "@/lib/hub/crm/forms";
import type { FormState } from "@/lib/hub/actions";

export type PublicFields = { email_mode: Mode; phone_mode: Mode; ask_company: boolean; ask_message: boolean; consent_text: string };

/** The form a visitor fills in. No sign-in. The hidden "website" field is for scripts: a person never sees it. */
export function PublicLeadForm({ token, stamp, fields }: { token: string; stamp: string; fields: PublicFields }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitLead, {});
  if (state.message) {
    return (
      <div className="flex items-start gap-3 rounded-bubble bg-paper-100 p-5" role="status">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-ink-800" aria-hidden />
        <p className="text-body text-ink-800 [overflow-wrap:anywhere]">{state.message}</p>
      </div>
    );
  }
  const optional = (m: Mode) => (m === "optional" ? " (optional)" : "");
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="t" value={stamp} />
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Leave this empty
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {state.error && (
        <Alert tone="bad" role="alert">
          {state.error}
        </Alert>
      )}
      <div>
        <label htmlFor="lf-name" className={labelCls}>
          Your name
        </label>
        <input id="lf-name" name="name" required maxLength={FORM_LIMITS.person} autoComplete="name" className={inputCls} />
      </div>
      {fields.email_mode !== "off" && (
        <div>
          <label htmlFor="lf-email" className={labelCls}>
            Email{optional(fields.email_mode)}
          </label>
          <input id="lf-email" name="email" type="email" required={fields.email_mode === "required"} maxLength={254} autoComplete="email" className={inputCls} />
        </div>
      )}
      {fields.phone_mode !== "off" && (
        <div>
          <label htmlFor="lf-phone" className={labelCls}>
            Phone or WhatsApp{optional(fields.phone_mode)}
          </label>
          <input id="lf-phone" name="phone" type="tel" required={fields.phone_mode === "required"} maxLength={40} autoComplete="tel" className={inputCls} />
        </div>
      )}
      {fields.ask_company && (
        <div>
          <label htmlFor="lf-company" className={labelCls}>
            Company (optional)
          </label>
          <input id="lf-company" name="company" maxLength={FORM_LIMITS.company} autoComplete="organization" className={inputCls} />
        </div>
      )}
      {fields.ask_message && (
        <div>
          <label htmlFor="lf-message" className={labelCls}>
            Message (optional)
          </label>
          <textarea id="lf-message" name="message" maxLength={FORM_LIMITS.message} rows={4} className={textareaCls} />
        </div>
      )}
      {fields.consent_text && (
        <label className="flex cursor-pointer items-start gap-3 text-small text-ink-800">
          <input type="checkbox" name="consent" value="1" required className="mt-0.5 size-5 shrink-0 accent-ink-800" />
          <span className="[overflow-wrap:anywhere]">{fields.consent_text}</span>
        </label>
      )}
      <Btn type="submit" variant="primary" size="lg" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Send
      </Btn>
    </form>
  );
}
