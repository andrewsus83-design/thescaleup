import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, KeyRound, Search } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { getClient, getClientSettings, getClientZernioConnMeta } from "@/lib/report/data";
import { saveClientSettings } from "@/lib/report/actions";
import { CLIENT_PROVIDERS, SECRET_PROVIDER_KEYS } from "@/lib/report/config";
import { ClientSubnav } from "@/components/report/client-subnav";
import { ZernioConnections } from "@/components/report/zernio-connections";

// Zernio keys are managed by the dedicated multi-connection card, not the generic grid.
const ZERNIO_KEYS = new Set(["zernio", "zernio_account_id"]);

export const dynamic = "force-dynamic";

function mask(v?: string | null) {
  if (!v) return null;
  return v.length <= 6 ? "••••" : "••••••" + v.slice(-4);
}

export default async function ClientSettings({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  const [settings, zernioConns] = await Promise.all([getClientSettings(id), getClientZernioConnMeta(id)]);
  const configuredCount = Object.keys(settings).filter((k) => settings[k]?.trim()).length;

  const groups: { key: "data" | "research"; title: string; icon: React.ReactNode; desc: string }[] = [
    { key: "research", title: "Riset & Audit (dipakai nanti)", icon: <Search className="h-4 w-4" />, desc: "API untuk pipeline riset SEO/GEO/sosial per klien." },
  ];

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <Link href="/report/admin" className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Semua klien
      </Link>

      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: client.brandColor }}>
          {client.name.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <h1 className="text-xl font-extrabold text-[#1B2A4A]">{client.name}</h1>
          <p className="text-xs text-slate-500">Setting API — key milik klien ini sendiri</p>
        </div>
      </div>

      <ClientSubnav id={id} active="settings" configuredCount={configuredCount} />

      {/* Zernio — the data source. Supports MORE THAN ONE key/profile per client. */}
      <div className="mt-6">
        <ZernioConnections clientId={id} conns={zernioConns} />
      </div>

      <form action={saveClientSettings} className="mt-6 space-y-6">
        <input type="hidden" name="id" value={id} />

        {groups.map((g) => {
          const providers = CLIENT_PROVIDERS.filter((p) => p.group === g.key);
          return (
            <div key={g.key} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
                {g.icon} {g.title}
              </div>
              <p className="mb-4 text-xs text-slate-500">{g.desc}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {providers.map((p) => {
                  const current = settings[p.key];
                  const secret = SECRET_PROVIDER_KEYS.has(p.key);
                  return (
                    <label key={p.key} className="block">
                      <span className="mb-1.5 flex items-center justify-between gap-2 text-sm font-medium text-slate-700">
                        {p.label}
                        {current ? (
                          <span className="font-mono text-[11px] text-emerald-600">{secret ? mask(current) : current}</span>
                        ) : (
                          <span className="text-[11px] text-slate-400">belum diisi</span>
                        )}
                      </span>
                      <input
                        name={p.key}
                        type={secret ? "password" : "text"}
                        autoComplete="off"
                        placeholder={current ? "•••• (biarkan kosong = tidak diubah)" : p.hint}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs text-slate-800 outline-none focus:border-[#2A2870]"
                      />
                      <span className="mt-1 block text-[11px] text-slate-400">{p.hint}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex items-center gap-3">
          <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[#2A2870] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#211f5c]">
            <KeyRound className="h-4 w-4" /> Simpan API Keys
          </button>
          <p className="text-xs text-slate-400">Field kosong tidak menimpa key yang sudah tersimpan.</p>
        </div>
      </form>
    </div>
  );
}
