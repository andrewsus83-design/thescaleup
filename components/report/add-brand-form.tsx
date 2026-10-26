"use client";

import { useState } from "react";
import { Plus, PlugZap, Check, Loader2 } from "lucide-react";
import { checkZernioConnection, createClient } from "@/lib/report/actions";
import type { ZernioAccount } from "@/lib/report/zernio";
import { Alert, Tag } from "@/components/brand/primitives";
import { btnCls, inputCls, labelCls, motion } from "@/components/brand/styles";
import { cn } from "@/lib/utils";

export function AddBrandForm() {
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [profileId, setProfileId] = useState("");
  const [checking, setChecking] = useState(false);
  const [accounts, setAccounts] = useState<ZernioAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setChecking(true);
    setError(null);
    setAccounts(null);
    try {
      const r = await checkZernioConnection(apiKey);
      if (!r.ok) setError(r.error ?? "Koneksi gagal.");
      else {
        setAccounts(r.accounts);
        if (r.accounts.length === 1) setProfileId(r.accounts[0].id);
        if (r.accounts.length && !name) setName(r.accounts[0].displayName ?? r.accounts[0].username ?? "");
      }
    } catch {
      setError("Gagal cek koneksi.");
    }
    setChecking(false);
  }

  const selected = accounts?.find((a) => a.id === profileId);

  return (
    <form action={createClient} className="grid gap-6">
      <label className="block">
        <span className={labelCls}>Nama Brand *</span>
        <input name="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Cap Gajah" className={inputCls} />
      </label>

      <div>
        <label htmlFor="add-brand-key" className={labelCls}>
          Zernio API Key *
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="add-brand-key"
            name="zernio_api_key"
            required
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setAccounts(null);
              setProfileId("");
            }}
            placeholder="zernio_..."
            className={cn(inputCls, "min-w-0 flex-1 basis-48 font-mono")}
          />
          <button type="button" onClick={check} disabled={checking || !apiKey.trim()} className={btnCls("secondary", "lg", "gap-2")}>
            {checking ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PlugZap className="size-4" aria-hidden />}
            Cek Koneksi
          </button>
        </div>
      </div>

      {error && (
        <Alert tone="bad" role="alert">
          {error}
        </Alert>
      )}

      {accounts && accounts.length > 0 && (
        <div className="space-y-3">
          <Alert tone="ok" role="status" title="Terhubung.">
            Pilih akun yang mau dilaporkan.
          </Alert>
          <div className="grid gap-2">
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-pressed={profileId === a.id}
                onClick={() => setProfileId(a.id)}
                className={cn(
                  "flex min-h-14 items-center justify-between gap-3 rounded-field border-control px-4 py-3 text-left text-small",
                  motion,
                  profileId === a.id ? "border-ink-800 bg-paper-0" : "border-ink-200 bg-paper-0 hover:bg-paper-100",
                )}
              >
                <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  {a.platform && <Tag className="uppercase">{a.platform}</Tag>}
                  <span className="min-w-0">
                    <span className="font-semibold text-ink-800">{a.displayName ?? a.username ?? "Akun"}</span>{" "}
                    {a.username && <span className="text-ink-500">@{a.username}</span>}
                    {a.followers != null && <span className="text-ink-500"> · {a.followers.toLocaleString("id-ID")} followers</span>}
                  </span>
                </span>
                {profileId === a.id && <Check className="size-4 shrink-0 text-ink-800" aria-hidden />}
              </button>
            ))}
          </div>
        </div>
      )}
      {accounts && accounts.length === 0 && <Alert tone="warn">Key valid tapi belum ada akun Instagram terhubung di Zernio.</Alert>}

      <label className="block">
        <span className={labelCls}>Zernio Profile ID *</span>
        <input
          name="zernio_account_id"
          required
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          placeholder="klik Cek Koneksi lalu pilih akun (otomatis terisi)"
          className={cn(inputCls, "font-mono")}
        />
      </label>

      <div>
        <button type="submit" disabled={!profileId.trim()} className={btnCls("primary", "lg", "gap-2")}>
          <Plus className="size-4" aria-hidden /> Buat Brand{selected ? ` — ${selected.displayName ?? selected.username}` : ""}
        </button>
      </div>
    </form>
  );
}
