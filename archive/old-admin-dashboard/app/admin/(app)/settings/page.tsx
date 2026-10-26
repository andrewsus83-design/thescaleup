import { KeyRound, Plug, Database, CheckCircle2, AlertTriangle } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { PageHeader, Card, EmptyState } from "@/components/admin/ui";
import { API_PROVIDERS } from "@/lib/admin/config";
import { saveSettings } from "@/lib/admin/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdmin();

  if (!isSupabaseAdminConfigured()) {
    return (
      <>
        <PageHeader title="Setting" />
        <EmptyState icon={<Database className="h-5 w-5" />} title="Supabase belum terkonfigurasi" />
      </>
    );
  }

  const db = createSupabaseAdminClient();
  const { data, error } = await db.from("app_settings").select("key, value");
  const tableMissing = !!error;
  const settings = new Map((data ?? []).map((r) => [r.key, r.value as string]));
  const mask = (v?: string | null) =>
    v ? "••••••" + v.slice(-4) : null;

  return (
    <>
      <PageHeader
        title="Setting"
        description="Kelola API keys untuk pipeline & koneksi MCP. Nilai tersimpan terenkripsi di database dan tidak pernah tampil penuh."
      />

      {tableMissing && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-warn/25 bg-warn/10 p-4 text-sm text-warn">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Tabel <code className="font-mono">app_settings</code> belum ada, jadi
            key tidak bisa disimpan. Jalankan migrasi admin SQL di Supabase (SQL
            Editor) dulu, lalu muat ulang halaman ini.
          </span>
        </div>
      )}

      <form action={saveSettings} className="space-y-4">
        <Card>
          <p className="mb-5 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-500">
            <KeyRound className="h-3.5 w-3.5" /> API Keys
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {API_PROVIDERS.map((p) => {
              const current = settings.get(p.key);
              return (
                <label key={p.key} className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-300">
                    {p.label}
                    {current && (
                      <span className="inline-flex items-center gap-1 text-[0.68rem] text-good">
                        <CheckCircle2 className="h-3 w-3" /> tersimpan
                      </span>
                    )}
                  </span>
                  <input
                    name={p.key}
                    type="password"
                    autoComplete="off"
                    placeholder={current ? mask(current)! : p.hint}
                    className="w-full rounded-xl border border-white/10 bg-obsidian/50 px-3.5 py-2.5 font-mono text-sm text-mist placeholder:text-slate-600 focus:border-coral/50 focus:outline-none"
                  />
                </label>
              );
            })}
          </div>
        </Card>

        <Card>
          <p className="mb-5 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-500">
            <Plug className="h-3.5 w-3.5" /> MCP Connection
          </p>
          <div className="grid gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-300">
                MCP Endpoint / URL
              </span>
              <input
                name="mcp_endpoint"
                placeholder={settings.get("mcp_endpoint") ?? "https://... atau nama server"}
                className="w-full rounded-xl border border-white/10 bg-obsidian/50 px-3.5 py-2.5 font-mono text-sm text-mist placeholder:text-slate-600 focus:border-coral/50 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-300">
                MCP Config (JSON)
              </span>
              <textarea
                name="mcp_config"
                rows={4}
                placeholder={settings.get("mcp_config") ? "•••• tersimpan ••••" : '{ "servers": { ... } }'}
                className="w-full resize-none rounded-xl border border-white/10 bg-obsidian/50 px-3.5 py-2.5 font-mono text-xs text-mist placeholder:text-slate-600 focus:border-coral/50 focus:outline-none"
              />
            </label>
          </div>
        </Card>

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            Kolom yang dikosongkan tidak akan menghapus nilai yang sudah tersimpan.
          </p>
          <button className="rounded-full bg-gradient-to-br from-coral to-sunset px-6 py-2.5 font-display font-semibold text-white hover:brightness-110">
            Simpan Setting
          </button>
        </div>
      </form>
    </>
  );
}
