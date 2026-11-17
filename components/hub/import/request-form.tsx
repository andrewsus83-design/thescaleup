"use client";

import { useActionState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { labelCls, textareaCls } from "@/components/brand/styles";
import { compactField } from "@/components/hub/tasks/parts";
import type { FormState } from "@/lib/hub/actions";
import { requestImport } from "@/lib/hub/import-actions";
import { REQUEST_LIMITS, SUGGESTIONS } from "@/lib/hub/import/model";
import { cn } from "@/lib/utils";

/** Ask for a source that has no importer yet. The shortcuts only fill the name. */
export function RequestForm({ brandId }: { brandId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestImport, {});
  const source = useRef<HTMLInputElement>(null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="brandId" value={brandId} />
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
        <label htmlFor="ir-source" className={labelCls}>
          What do you want to import from?
        </label>
        <input ref={source} id="ir-source" name="source" maxLength={REQUEST_LIMITS.source} autoComplete="off" placeholder="Trello, a Google Sheet, our old CRM…" className={cn(compactField, "h-11 w-full")} />
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                if (source.current) {
                  source.current.value = s;
                  source.current.focus();
                }
              }}
              className="min-h-9 rounded-full border border-ink-200 px-3 text-small text-ink-700 hover:bg-paper-100"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="ir-note" className={labelCls}>
          What should come over, and where to? (optional)
        </label>
        <textarea id="ir-note" name="note" rows={3} maxLength={REQUEST_LIMITS.note} placeholder="For example: all open cards become tasks; the contacts tab becomes CRM leads." className={textareaCls} />
        <p className="mt-2 text-caption text-ink-500">Do not paste passwords or keys.</p>
      </div>
      <Btn type="submit" variant="primary" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Send request
      </Btn>
    </form>
  );
}
