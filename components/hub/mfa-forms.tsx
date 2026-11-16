"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { inputCls, labelCls } from "@/components/brand/styles";
import { CopyButton } from "@/components/hub/mail/forms";
import { confirmEnrollment, startEnrollment, verifyAuthenticator, type MfaState } from "@/lib/hub/mfa-actions";
import type { FormState } from "@/lib/hub/actions";
import { cn } from "@/lib/utils";

const codeCls = cn(inputCls, "font-mono text-[20px] tracking-[0.3em]");

function Err({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <Alert tone="bad" role="alert">
      {text}
    </Alert>
  );
}

/** Every new sign-in: the 6 digits from the authenticator app. */
export function MfaChallengeForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(verifyAuthenticator, {});
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="next" value={next} />
      <Err text={state.error} />
      <div>
        <label htmlFor="mfa-code" className={labelCls}>
          Code from your authenticator app
        </label>
        <input id="mfa-code" name="code" inputMode="numeric" autoComplete="one-time-code" required autoFocus maxLength={7} placeholder="123456" aria-invalid={Boolean(state.error)} className={codeCls} />
      </div>
      <Btn type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-5 animate-spin" aria-label="Checking" /> : "Continue"}
      </Btn>
    </form>
  );
}

/** First time: get a QR code, scan it, type the first code. */
export function MfaEnroll({ next }: { next: string }) {
  const [started, start, starting] = useActionState<MfaState, FormData>(startEnrollment, {});
  const [confirmed, confirm, confirming] = useActionState<MfaState, FormData>(confirmEnrollment, {});
  // After a wrong code the confirm step answers with the same QR, so the person can retry without a new secret.
  const shown = confirmed.factorId && confirmed.qr && confirmed.secret ? confirmed : started;
  if (!shown.factorId || !shown.qr || !shown.secret) {
    return (
      <form action={start} className="space-y-6">
        <Err text={started.error ?? confirmed.error} />
        <ol className="list-decimal space-y-2 pl-5 text-body text-ink-800">
          <li>Install an authenticator app (Google Authenticator, 1Password, Authy or similar).</li>
          <li>Scan the QR code we show next.</li>
          <li>Type the 6-digit code the app shows.</li>
        </ol>
        <Btn type="submit" variant="primary" size="lg" className="w-full" disabled={starting}>
          {starting ? <Loader2 className="size-5 animate-spin" aria-label="Preparing" /> : "Set up authenticator"}
        </Btn>
      </form>
    );
  }
  const spaced = shown.secret.replace(/(.{4})/g, "$1 ").trim();
  return (
    <form action={confirm} className="space-y-6">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="factorId" value={shown.factorId} />
      <input type="hidden" name="qr" value={shown.qr} />
      <input type="hidden" name="secret" value={shown.secret} />
      <Err text={confirmed.error} />
      <div className="flex flex-col items-center gap-3">
        {/* The QR code is an SVG data URL from Supabase, so there is nothing to optimise. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shown.qr} alt="QR code to scan with your authenticator app" width={192} height={192} className="size-48 rounded-field bg-white p-2" />
        <div className="flex items-center gap-1">
          <p className="break-all text-center font-mono text-caption text-ink-500">Cannot scan? Enter this key: {spaced}</p>
          <CopyButton value={shown.secret} label="setup key" />
        </div>
      </div>
      <div>
        <label htmlFor="mfa-first" className={labelCls}>
          Code from your authenticator app
        </label>
        <input id="mfa-first" name="code" inputMode="numeric" autoComplete="one-time-code" required autoFocus maxLength={7} placeholder="123456" aria-invalid={Boolean(confirmed.error)} className={codeCls} />
      </div>
      <Btn type="submit" variant="primary" size="lg" className="w-full" disabled={confirming}>
        {confirming ? <Loader2 className="size-5 animate-spin" aria-label="Checking" /> : "Turn on and continue"}
      </Btn>
    </form>
  );
}
