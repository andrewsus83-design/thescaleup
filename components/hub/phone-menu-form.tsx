"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { inputCls, labelCls } from "@/components/brand/styles";
import { resetPhoneMenu, savePhoneMenu } from "@/lib/hub/pref-actions";
import type { FormState } from "@/lib/hub/actions";
import type { TabKey } from "@/lib/hub/tabs";

/** Pick which menus sit on the phone's bottom bar, in order. Everything else goes under More. */
export function PhoneMenuForm({ options, current, custom }: { options: { key: TabKey; label: string }[]; current: TabKey[]; custom: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePhoneMenu, {});
  return (
    // Remounts after a save or a reset so the selects show what is stored.
    <form key={current.join(",")} action={action} className="space-y-5">
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
      {current.map((k, i) => (
        <div key={i}>
          <label htmlFor={`slot${i + 1}`} className={labelCls}>
            Position {i + 1}
          </label>
          <select id={`slot${i + 1}`} name={`slot${i + 1}`} defaultValue={k} className={inputCls}>
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      <p className="text-small text-ink-500">The fifth button is always “More”. It holds every other menu.</p>
      <div className="flex flex-wrap gap-2">
        <Btn type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? <Loader2 className="size-5 animate-spin" aria-label="Saving" /> : "Save"}
        </Btn>
        {custom && (
          <Btn type="submit" variant="ghost" size="md" formAction={resetPhoneMenu} disabled={pending}>
            Back to default
          </Btn>
        )}
      </div>
    </form>
  );
}
