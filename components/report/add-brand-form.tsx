"use client";

import { useState } from "react";
import { Plus, PlugZap, Check, Loader2, AlertCircle } from "lucide-react";
import { checkZernioConnection, createClient } from "@/lib/report/actions";
import type { ZernioAccount } from "@/lib/report/zernio";

export function AddBrandForm({ hasClients }: { hasClients?: boolean }) {
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
    <form action={createClient} className="grid gap-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Nama Brand *</span>
        <input
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="mis. Cap Gajah"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2A2870]"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Zernio API Key *</span>
        <div className="flex items-stretch gap-2">
          <input
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
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs outline-none focus:border-[#2A2870]"
          />
          <button
            type="button"
            onClick={check}
            disabled={checking || !apiKey.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#2A2870] px-3 py-2 text-xs font-semibold text-[#2A2870] hover:bg-[#2A2870]/5 disabled:opacity-50"
          >
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
            Cek Koneksi
          </button>
        </div>
      </label>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
        </div>
      )}

      {accounts && accounts.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <Check className="h-4 w-4" /> Terhubung — pilih akun:
          </p>
          <div className="grid gap-2">
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setProfileId(a.id)}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  profileId === a.id ? "border-[#2A2870] bg-white" : "border-transparent bg-white/60 hover:bg-white"
                }`}
              >
                <span className="flex items-center gap-2">
                  {a.platform && (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                      {a.platform}
                    </span>
                  )}
                  <span>
                    <span className="font-semibold text-slate-800">{a.displayName ?? a.username ?? "Akun"}</span>{" "}
                    {a.username && <span className="text-slate-500">@{a.username}</span>}
                    {a.followers != null && (
                      <span className="text-slate-400"> · {a.followers.toLocaleString("id-ID")} followers</span>
                    )}
                  </span>
                </span>
                {profileId === a.id && <Check className="h-4 w-4 text-[#2A2870]" />}
              </button>
            ))}
          </div>
        </div>
      )}
      {accounts && accounts.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Key valid tapi belum ada akun Instagram terhubung di Zernio.
        </p>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Zernio Profile ID *</span>
        <input
          name="zernio_account_id"
          required
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          placeholder="klik Cek Koneksi lalu pilih akun (otomatis terisi)"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs outline-none focus:border-[#2A2870]"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Warna Brand</span>
          <input name="brand_color" type="color" defaultValue="#2A2870" className="h-11 w-full rounded-lg border border-slate-200 px-1" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Warna Aksen</span>
          <input name="accent_color" type="color" defaultValue="#38B6F0" className="h-11 w-full rounded-lg border border-slate-200 px-1" />
        </label>
      </div>

      <div>
        <button
          type="submit"
          disabled={!profileId.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#2A2870] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#211f5c] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Buat Brand{selected ? ` — ${selected.displayName ?? selected.username}` : ""}
        </button>
      </div>
    </form>
  );
}
