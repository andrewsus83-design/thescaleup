"use client";

import { useActionState } from "react";
import { connectClientZernio } from "@/lib/report/actions";
import { Alert } from "@/components/brand/primitives";
import { btnCls, inputCls, labelCls } from "@/components/brand/styles";
import { cn } from "@/lib/utils";

type State = { ok: boolean; error?: string } | null;

/** Client-facing form: connect this client's own Zernio account via the connect link. */
export function ConnectForm({ slug, token }: { slug: string; token: string }) {
  const [state, action, pending] = useActionState<State, FormData>(
    async (_prev, formData) => connectClientZernio(formData),
    null,
  );
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="token" value={token} />
      <label className="block">
        <span className={labelCls}>Zernio API Key</span>
        <input name="zernio_api_key" required placeholder="zernio_..." className={cn(inputCls, "font-mono")} />
      </label>
      <label className="block">
        <span className={labelCls}>
          Zernio Account ID <span className="font-normal text-ink-500">(opsional)</span>
        </span>
        <input name="zernio_account_id" placeholder="mis. akun IG yang terhubung" className={inputCls} />
      </label>
      <button type="submit" disabled={pending} className={btnCls("primary", "lg", "w-full")}>
        {pending ? "Menghubungkan…" : "Hubungkan akun Zernio"}
      </button>
      {state && !state.ok && state.error && (
        <Alert tone="bad" role="alert">
          {state.error}
        </Alert>
      )}
      {state && state.ok && (
        <Alert tone="ok" role="status">
          Terhubung! Laporan akan tampil setelah data pertama ditarik.
        </Alert>
      )}
    </form>
  );
}
