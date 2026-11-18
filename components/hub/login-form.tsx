"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Alert, Btn, Card } from "@/components/brand/primitives";
import { codeInputCls, inputCls, labelCls, pillCls } from "@/components/brand/styles";
import { requestLoginCode, signInWithPassword, verifyLoginCode, type FormState } from "@/lib/hub/actions";

export function HubLoginForm({ next, presetEmail }: { next: string; presetEmail?: string }) {
  const [sent, sendAction, sending] = useActionState<FormState, FormData>(requestLoginCode, { email: presetEmail });
  const [checked, verifyAction, verifying] = useActionState<FormState, FormData>(verifyLoginCode, {});

  const [pwState, pwAction, pwPending] = useActionState<FormState, FormData>(signInWithPassword, {});
  const [mode, setMode] = useState<"password" | "code">("password");

  const step = sent.step === "code" ? "code" : "email";
  const email = sent.email ?? presetEmail ?? "";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-auth flex-col justify-center px-5 py-12">
      <div className="mb-10 flex flex-col items-center text-center">
        <Logo variant="lockup" size={32} />
        <h1 className="mt-10 font-title text-balance text-h2 text-ink-800">Sign in</h1>
        <p className="mt-3 text-pretty text-body text-ink-500">Use your password, or get a sign-in code by email.</p>
      </div>

      <Card>
        {step === "email" && (
          <div className="mb-6 flex gap-2" role="tablist" aria-label="Sign-in method">
            {(["password", "code"] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={pillCls(mode === m)}>
                {m === "password" ? "Password" : "Email code"}
              </button>
            ))}
          </div>
        )}
        {step === "email" && mode === "password" ? (
          <form action={pwAction} className="space-y-6">
            <input type="hidden" name="next" value={next} />
            {pwState.error && (
              <Alert tone="bad" role="alert">
                {pwState.error}
              </Alert>
            )}
            <div>
              <label htmlFor="hub-pw-email" className={labelCls}>
                Email
              </label>
              <input id="hub-pw-email" name="email" type="email" required autoComplete="username" defaultValue={email} placeholder="you@company.com" className={inputCls} />
            </div>
            <div>
              <label htmlFor="hub-pw" className={labelCls}>
                Password
              </label>
              <input id="hub-pw" name="password" type="password" required autoComplete="current-password" aria-invalid={Boolean(pwState.error)} className={inputCls} />
            </div>
            <Btn type="submit" variant="primary" size="lg" className="w-full" disabled={pwPending}>
              {pwPending ? <Loader2 className="size-5 animate-spin" aria-label="Signing in" /> : "Sign in"}
            </Btn>
          </form>
        ) : step === "email" ? (
          <form action={sendAction} className="space-y-6">
            {sent.error && (
              <Alert tone="bad" role="alert">
                {sent.error}
              </Alert>
            )}
            <div>
              <label htmlFor="hub-email" className={labelCls}>
                Email
              </label>
              <input id="hub-email" name="email" type="email" required autoFocus autoComplete="email" defaultValue={email} placeholder="you@company.com" className={inputCls} />
            </div>
            <Btn type="submit" variant="primary" size="lg" className="w-full" disabled={sending}>
              {sending ? <Loader2 className="size-5 animate-spin" aria-label="Sending" /> : <>Email me a code <ArrowRight className="size-5" aria-hidden /></>}
            </Btn>
          </form>
        ) : (
          <form action={verifyAction} className="space-y-6">
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="next" value={next} />
            {checked.error ? (
              <Alert tone="bad" role="alert">
                {checked.error}
              </Alert>
            ) : (
              <Alert tone="ok" role="status">
                {sent.message}
              </Alert>
            )}
            <div>
              <label htmlFor="hub-code" className={labelCls}>
                Code sent to {email}
              </label>
              <input
                id="hub-code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                autoFocus
                placeholder="123456"
                aria-invalid={Boolean(checked.error)}
                className={codeInputCls}
              />
            </div>
            <Btn type="submit" variant="primary" size="lg" className="w-full" disabled={verifying}>
              {verifying ? <Loader2 className="size-5 animate-spin" aria-label="Checking" /> : "Sign in"}
            </Btn>
            <p className="text-center text-small text-ink-500">
              Wrong email or no code?{" "}
              <a href={`/hub/login?next=${encodeURIComponent(next)}`} className="font-semibold text-ink-800 underline underline-offset-4">
                Start over
              </a>
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
