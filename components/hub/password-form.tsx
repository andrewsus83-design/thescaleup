"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { inputCls, labelCls } from "@/components/brand/styles";
import { setPassword, type FormState } from "@/lib/hub/actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(setPassword, {});
  return (
    <form action={action} className="space-y-6" autoComplete="off">
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
      <div>
        <label htmlFor="new-pw" className={labelCls}>
          New password
        </label>
        <input id="new-pw" name="password" type="password" required minLength={10} maxLength={72} autoComplete="new-password" className={inputCls} />
        <p className="mt-2 text-caption text-ink-500">At least 10 characters.</p>
      </div>
      <div>
        <label htmlFor="new-pw2" className={labelCls}>
          Repeat password
        </label>
        <input id="new-pw2" name="confirm" type="password" required minLength={10} maxLength={72} autoComplete="new-password" className={inputCls} />
      </div>
      <Btn type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? <Loader2 className="size-5 animate-spin" aria-label="Saving" /> : "Save password"}
      </Btn>
    </form>
  );
}
