"use client";

import { useActionState } from "react";
import { connectClientZernio } from "@/lib/report/actions";

type State = { ok: boolean; error?: string } | null;

/** Client-facing form: connect this client's own Zernio account via the connect link. */
export function ConnectForm({ slug, token }: { slug: string; token: string }) {
  const [state, action, pending] = useActionState<State, FormData>(
    async (_prev, formData) => connectClientZernio(formData),
    null,
  );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="token" value={token} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Zernio API Key</span>
        <input
          name="zernio_api_key"
          required
          placeholder="zernio_..."
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-800 outline-none focus:border-[#2A2870]"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          Zernio Account ID <span className="text-slate-400">(opsional)</span>
        </span>
        <input
          name="zernio_account_id"
          placeholder="mis. akun IG yang terhubung"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#2A2870]"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[#2A2870] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#211f5c] disabled:opacity-60"
      >
        {pending ? "Menghubungkan…" : "Hubungkan akun Zernio"}
      </button>
      {state && !state.ok && state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      {state && state.ok && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Terhubung! Laporan akan tampil setelah data pertama ditarik.
        </p>
      )}
    </form>
  );
}
