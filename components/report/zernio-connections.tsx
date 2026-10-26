"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, PlugZap, Loader2, Trash2, KeyRound } from "lucide-react";
import { addClientZernioKey, removeClientZernioKey, checkZernioConnection } from "@/lib/report/actions";
import type { ZernioAccount } from "@/lib/report/zernio";
import { Alert, Card, Chip, Tag } from "@/components/brand/primitives";
import { btnCls, capsCls, iconBtnCls, inputCls, tileCls } from "@/components/brand/styles";
import { cn } from "@/lib/utils";

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
    <span className="inline-flex h-7 items-center gap-2 rounded-full border border-ink-100 bg-paper-0 px-3 text-caption text-ink-800">
      <span className="font-mono text-micro font-medium uppercase text-ink-500">{a.platform ?? "social"}</span>
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
    <Card>
      <h2 className="mb-2 flex items-center gap-3 font-title text-h3 text-ink-800">
        <KeyRound className="size-5 text-ink-500" aria-hidden /> Koneksi Zernio
      </h2>
      <p className="mb-6 max-w-chat text-small text-ink-500">
        Klien ini bisa punya <strong className="font-semibold text-ink-800">lebih dari satu</strong> Zernio API key / profil. Semua akun dari tiap key muncul di pemilih akun, dan report otomatis memakai key yang benar untuk akun yang dipilih.
      </p>

      {/* existing connections */}
      <div className="mb-6 grid gap-3">
        {conns.length === 0 && (
          <p className="rounded-field border-control border-dashed border-ink-200 px-4 py-6 text-center text-small text-ink-500">Belum ada koneksi Zernio. Tambahkan di bawah.</p>
        )}
        {conns.map((c) => (
          <div key={c.id} className={cn(tileCls, "flex items-start justify-between gap-4")}>
            <div className="min-w-0 space-y-2">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small font-semibold text-ink-800">
                {c.label}
                {c.id === "primary" && <Tag className="bg-paper-0">utama</Tag>}
                <span className="font-mono text-caption font-normal text-ink-500">{c.masked}</span>
              </p>
              {!c.ok ? (
                <Alert tone="bad">{c.error ?? "Tidak bisa terhubung"}</Alert>
              ) : c.accounts.length ? (
                <div className="flex flex-wrap gap-2">
                  {c.accounts.map((a) => (
                    <AccountRow key={a.id} a={a} />
                  ))}
                </div>
              ) : (
                <p className="text-caption text-ink-500">Key valid, belum ada akun terhubung.</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => remove(c.id)}
              disabled={saving}
              aria-label={`Hapus koneksi ${c.label}`}
              title="Hapus koneksi"
              className={iconBtnCls("quiet", "border-control border-ink-200 bg-paper-0 hover:border-danger hover:text-danger")}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>

      {/* add a new connection */}
      <div className="space-y-4 border-t border-hairline pt-6">
        <p className={capsCls}>Tambah koneksi Zernio</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="min-w-0 flex-1 basis-56">
            <span className="sr-only">Zernio API key</span>
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
              className={cn(inputCls, "font-mono text-caption")}
            />
          </label>
          <button type="button" onClick={check} disabled={checking || !apiKey.trim()} className={btnCls("secondary", "lg", "gap-2")}>
            {checking ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PlugZap className="size-4" aria-hidden />}
            Cek Koneksi
          </button>
        </div>
        <label className="block">
          <span className="sr-only">Label</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (opsional, mis. Akun Meta / Workspace 2)" className={inputCls} />
        </label>

        {error && (
          <Alert tone="bad" role="alert">
            {error}
          </Alert>
        )}

        {preview && (
          <Alert tone="ok" role="status" title={`Terhubung — ${preview.length} akun:`}>
            {preview.length ? (
              <span className="mt-2 flex flex-wrap gap-2">
                {preview.map((a) => (
                  <AccountRow key={a.id} a={a} />
                ))}
              </span>
            ) : (
              <Chip tone="warn">belum ada akun terhubung di Zernio</Chip>
            )}
          </Alert>
        )}

        <button type="button" onClick={add} disabled={saving || !apiKey.trim()} className={btnCls("primary", "lg", "gap-2")}>
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />} Tambah Koneksi
        </button>
      </div>
    </Card>
  );
}
