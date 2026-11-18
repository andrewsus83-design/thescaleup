"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Btn, Chip } from "@/components/brand/primitives";
import { inputCls } from "@/components/brand/styles";
import { checkKeyAction, removeSecretAction, saveSecretAction } from "@/lib/hub/secret-actions";
import { checkSpec, type CheckResult, type CheckStatus } from "@/lib/hub/key-check-model";
import type { FormState } from "@/lib/hub/actions";
import type { ProviderDef } from "@/lib/hub/providers";

export type KeyStatus = { last4: string | null; updatedAt: string } | null;

const CHECK_TONE: Record<CheckStatus, "ok" | "bad" | "warn" | "neutral"> = { ok: "ok", rejected: "bad", error: "bad", limited: "warn", unreachable: "warn", unsure: "warn", missing: "neutral" };
const CHECK_WORD: Record<CheckStatus, string> = { ok: "Connected", rejected: "Rejected", error: "Not checked", limited: "Limited", unreachable: "Not reached", unsure: "Unclear", missing: "Not checked" };

/** One key: write-only. The stored value is never sent to the browser, only its last 4 characters. */
export function KeyRow({ scope, provider, status, inherited }: { scope: string; provider: ProviderDef; status: KeyStatus; inherited?: boolean }) {
  const spec = checkSpec(provider.key);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [checking, startCheck] = useTransition();
  // A key that is saved is checked right away, but only when the check is free: one that costs a little waits for a click.
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    setCheck(null);
    const saved = await saveSecretAction(prev, fd);
    if (saved.message && spec?.cost === "free") setCheck(await checkKeyAction(scope, provider.key));
    return saved;
  }, {});
  const id = `key-${scope}-${provider.key}`;
  const canCheck = Boolean(spec) && (Boolean(status) || Boolean(inherited));
  const runCheck = () => startCheck(async () => setCheck(await checkKeyAction(scope, provider.key)));
  return (
    <li className="py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <label htmlFor={id} className="text-body font-semibold text-ink-800">
            {provider.label}
          </label>
          <p className="text-small text-ink-500">{provider.use}</p>
        </div>
        {status ? (
          <Chip tone="ok">Set{status.last4 ? ` · …${status.last4}` : ""}</Chip>
        ) : inherited ? (
          <Chip tone="info">Using the workspace default</Chip>
        ) : (
          <Chip tone="neutral">Not set</Chip>
        )}
      </div>
      <form action={action} className="mt-3 flex flex-col gap-2 sm:flex-row" autoComplete="off">
        <input type="hidden" name="scope" value={scope} />
        <input type="hidden" name="provider" value={provider.key} />
        <input id={id} name="value" type="password" autoComplete="new-password" spellCheck={false} placeholder={status ? "Paste a new key to replace it" : provider.hint} className={inputCls} />
        <Btn type="submit" variant="secondary" size="md" disabled={pending} className="shrink-0">
          {pending ? <Loader2 className="size-4 animate-spin" aria-label="Saving" /> : status ? "Replace" : "Save"}
        </Btn>
        {status && (
          <Btn type="submit" variant="ghost" size="md" formAction={removeSecretAction} onClick={() => setCheck(null)} className="shrink-0">
            Remove
          </Btn>
        )}
        {canCheck && (
          <Btn type="button" variant="ghost" size="md" onClick={runCheck} disabled={checking || pending} className="shrink-0">
            {checking ? <Loader2 className="size-4 animate-spin" aria-label="Checking" /> : inherited && !status ? "Check default key" : "Check connection"}
          </Btn>
        )}
      </form>
      {canCheck && spec?.cost === "small" && <p className="mt-2 text-caption text-ink-500">This check sends one tiny paid request, because {spec.label} has no free way to test a key.</p>}
      <div aria-live="polite">
        {canCheck && check && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-caption text-ink-700">
            <Chip tone={CHECK_TONE[check.status]}>{CHECK_WORD[check.status]}</Chip>
            <span>{check.message}</span>
          </p>
        )}
      </div>
      {status && !(provider.wired && scope === "workspace") && (
        <p className="mt-2 text-caption text-ink-500">
          {scope === "workspace" ? "Saved safely. Nothing in the app uses this key yet." : "Saved safely. This brand's agents will use it once they ship."}
        </p>
      )}
      {state.error && <p className="mt-2 text-caption text-danger">{state.error}</p>}
      {state.message && <p className="mt-2 text-caption text-success-ink">{state.message}</p>}
    </li>
  );
}
