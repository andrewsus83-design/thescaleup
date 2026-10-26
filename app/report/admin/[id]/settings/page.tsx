import { notFound } from "next/navigation";
import { KeyRound, Search } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { getClient, getClientSettings, getClientZernioConnMeta } from "@/lib/report/data";
import { saveClientSettings } from "@/lib/report/actions";
import { CLIENT_PROVIDERS, SECRET_PROVIDER_KEYS } from "@/lib/report/config";
import { Card } from "@/components/brand/primitives";
import { btnCls, inputCls, labelCls, pageX } from "@/components/brand/styles";
import { cn } from "@/lib/utils";
import { ClientSubnav } from "@/components/report/client-subnav";
import { ZernioConnections } from "@/components/report/zernio-connections";
import { ReportAvatar } from "@/components/report/report-avatar";
import { ReportPageHead } from "@/components/report/page-head";

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
    { key: "research", title: "Riset & Audit (dipakai nanti)", icon: <Search className="size-5 text-ink-500" aria-hidden />, desc: "API untuk pipeline riset SEO/GEO/sosial per klien." },
  ];

  return (
    <div className={cn("mx-auto max-w-3xl py-10 sm:py-12", pageX)}>
      <ReportPageHead
        back={{ href: "/report/admin", label: "Semua klien" }}
        title={client.name}
        description="Setting API — key milik klien ini sendiri"
        lead={<ReportAvatar name={client.name} size="lg" />}
      />

      <ClientSubnav id={id} active="settings" configuredCount={configuredCount} />

      <div className="mt-8 space-y-6">
        {/* Zernio — the data source. Supports MORE THAN ONE key/profile per client. */}
        <ZernioConnections clientId={id} conns={zernioConns} />

        <form action={saveClientSettings} className="space-y-6">
          <input type="hidden" name="id" value={id} />

          {groups.map((g) => {
            const providers = CLIENT_PROVIDERS.filter((p) => p.group === g.key);
            return (
              <Card key={g.key}>
                <h2 className="mb-2 flex items-center gap-3 font-title text-h3 text-ink-800">
                  {g.icon} {g.title}
                </h2>
                <p className="mb-6 text-small text-ink-500">{g.desc}</p>
                <div className="grid gap-6 sm:grid-cols-2">
                  {providers.map((p) => {
                    const current = settings[p.key];
                    const secret = SECRET_PROVIDER_KEYS.has(p.key);
                    return (
                      <label key={p.key} className="block">
                        <span className={cn(labelCls, "flex items-center justify-between gap-3")}>
                          {p.label}
                          {current ? (
                            <span className="font-mono text-caption font-medium text-success-ink">{secret ? mask(current) : current}</span>
                          ) : (
                            <span className="text-caption font-normal text-ink-500">belum diisi</span>
                          )}
                        </span>
                        <input
                          name={p.key}
                          type={secret ? "password" : "text"}
                          autoComplete="off"
                          placeholder={current ? "•••• (biarkan kosong = tidak diubah)" : p.hint}
                          className={cn(inputCls, "font-mono text-caption")}
                        />
                        <span className="mt-2 block text-caption text-ink-500">{p.hint}</span>
                      </label>
                    );
                  })}
                </div>
              </Card>
            );
          })}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <button type="submit" className={btnCls("primary", "lg", "gap-2")}>
              <KeyRound className="size-4" aria-hidden /> Simpan API Keys
            </button>
            <p className="text-caption text-ink-500">Field kosong tidak menimpa key yang sudah tersimpan.</p>
          </div>
        </form>
      </div>
    </div>
  );
}
