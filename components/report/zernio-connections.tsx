"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, PlugZap, Check, Loader2, AlertCircle, Trash2, KeyRound } from "lucide-react";
import { addClientZernioKey, removeClientZernioKey, checkZernioConnection } from "@/lib/report/actions";
import type { ZernioAccount } from "@/lib/report/zernio";

type ConnMeta = {
  id: string;
  label: string;
  masked: string;
  ok: boolean;
  error?: string;
  accounts: ZernioAccount[];
};

function AccountRow({ a }: { a: ZernioAccount }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200">
      <span className="font-semibold uppercase text-slate-400">{a.platform ?? "social"}</span>
      {a.username ? `@${a.username}` : (a.displayName ?? "akun")}
    </span>
  );
}

export function ZernioConnections({ clientId, conns }: { clientId: string; conns: ConnMeta[] }) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const [preview, setPreview] = useState<ZernioAccount[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  async function check() {
    setChecking(true);
    setError(null);
    setPreview(null);
    try {
      const r = await checkZernioConnection(apiKey);
      if (!r.ok) setError(r.error ?? "Koneksi gagal.");
      else setPreview(r.accounts);
    } catch {
      setError("Gagal cek koneksi.");
    }
    setChecking(false);
  }

  function add() {
    setError(null);
    const fd = new FormData();
    fd.set("id", clientId);
    fd.set("zernio_api_key", apiKey.trim());
    if (label.trim()) fd.set("label", label.trim());
    startSaving(async () => {
      const r = await addClientZernioKey(fd);
      if (!r.ok) {
        setError(r.error ?? "Gagal menambah koneksi.");
        return;
      }
      setApiKey("");
      setLabel("");
      setPreview(null);
      router.refresh();
    });
  }

  function remove(connId: string) {
    const fd = new FormData();
    fd.set("id", clientId);
    fd.set("conn", connId);
    startSaving(async () => {
      await removeClientZernioKey(fd);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <KeyRound className="h-4 w-4" /> Koneksi Zernio
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Klien ini bisa punya <strong>lebih dari satu</strong> Zernio API key / profil. Semua akun dari tiap key muncul di
        pemilih akun, dan report otomatis memakai key yang benar untuk akun yang dipilih.
      </p>

      {/* existing connections */}
      <div className="mb-4 grid gap-2">
        {conns.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
            Belum ada koneksi Zernio. Tambahkan di bawah.
          </p>
        )}
        {conns.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  {c.label}
                  {c.id === "primary" && (
                    <span className="rounded bg-[#2A2870]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#2A2870]">
                      utama
                    </span>
                  )}
                  <span className="font-mono text-[11px] font-normal text-slate-400">{c.masked}</span>
                </p>
                {!c.ok ? (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-red-500">
                    <AlertCircle className="h-3 w-3" /> {c.error ?? "Tidak bisa terhubung"}
                  </p>
                ) : c.accounts.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {c.accounts.map((a) => (
                      <AccountRow key={a.id} a={a} />
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-amber-600">Key valid, belum ada akun terhubung.</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(c.id)}
                disabled={saving}
                className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                title="Hapus koneksi"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* add a new connection */}
      <div className="rounded-xl border border-slate-200 p-3">
        <p className="mb-2 text-xs font-semibold text-slate-600">Tambah koneksi Zernio</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setPreview(null);
              setError(null);
            }}
            placeholder="zernio_... (API key)"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs outline-none focus:border-[#2A2870]"
          />
          <button
            type="button"
            onClick={check}
            disabled={checking || !apiKey.trim()}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#2A2870] px-3 py-2 text-xs font-semibold text-[#2A2870] hover:bg-[#2A2870]/5 disabled:opacity-50"
          >
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
            Cek Koneksi
          </button>
        </div>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (opsional, mis. Akun Meta / Workspace 2)"
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#2A2870]"
        />

        {error && (
          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{error}</span>
          </div>
        )}

        {preview && (
          <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
            <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
              <Check className="h-3.5 w-3.5" /> Terhubung — {preview.length} akun:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {preview.length ? (
                preview.map((a) => <AccountRow key={a.id} a={a} />)
              ) : (
                <span className="text-[11px] text-amber-600">belum ada akun terhubung di Zernio.</span>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={add}
          disabled={saving || !apiKey.trim()}
          className="mt-2.5 inline-flex items-center gap-2 rounded-xl bg-[#2A2870] px-4 py-2 text-sm font-semibold text-white hover:bg-[#211f5c] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Tambah Koneksi
        </button>
      </div>
    </div>
  );
}
