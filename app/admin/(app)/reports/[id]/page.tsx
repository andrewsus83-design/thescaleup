import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Send,
  Database,
  AlertTriangle,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { Card, EmptyState } from "@/components/admin/ui";
import { sendReport } from "@/lib/admin/actions";

export const dynamic = "force-dynamic";

export default async function ReportView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  if (!isSupabaseAdminConfigured()) {
    return <EmptyState icon={<Database className="h-5 w-5" />} title="Supabase belum terkonfigurasi" />;
  }

  const db = createSupabaseAdminClient();
  const { data: r } = await db
    .from("reports")
    .select("*, member:leads(id, business, name)")
    .eq("id", id)
    .single();
  if (!r) notFound();

  const content = (r.content ?? {}) as Record<string, unknown>;
  const context = (content.context ?? {}) as Record<string, unknown>;
  const scores = (content.scores ?? {}) as Record<string, number | null>;
  const roadmap = (content.roadmap ?? {}) as Record<string, string[]>;
  const hasScores = Object.values(scores).some((v) => v != null);
  const whatsMissing = (content.whats_missing as string[]) ?? [];
  const rb = (content.revenue_booster ?? null) as {
    current_estimate?: string;
    projected?: string;
    uplift?: string;
    levers?: string[];
  } | null;
  const exec = (content.executive ?? null) as Record<
    string,
    { summary?: string; actions?: string[] }
  > | null;
  const engineInfo = content.engine as { provider?: string; model?: string } | undefined;
  const engineError = content.engine_error as string | undefined;

  return (
    <>
      <Link
        href="/admin/reports"
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-coral"
      >
        <ArrowLeft className="h-4 w-4" />
        Semua report
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist">
            {r.title}
          </h1>
          {r.summary && (
            <p className="mt-2 max-w-2xl text-sm text-slate-400">{r.summary}</p>
          )}
          {engineInfo?.provider && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-coral/25 bg-coral/10 px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-wider text-coral-soft">
              <Sparkles className="h-3 w-3" /> {engineInfo.provider}
              {engineInfo.model ? ` · ${engineInfo.model}` : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/admin/reports/${r.id}/download`}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5"
          >
            <Download className="h-4 w-4" /> Download
          </a>
          {r.status !== "sent" && (
            <form action={sendReport.bind(null, r.id)}>
              <button className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-coral to-sunset px-4 py-2 text-sm font-semibold text-white hover:brightness-110">
                <Send className="h-4 w-4" /> Tandai terkirim
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <p className="mb-4 font-mono text-xs uppercase tracking-wider text-slate-500">
            Skor 4 Pilar
          </p>
          {hasScores ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["cro", "geo", "social", "tech"] as const).map((k) => (
                <div key={k} className="rounded-xl border border-white/8 bg-obsidian/40 p-4 text-center">
                  <p className="font-display text-3xl font-extrabold text-coral">
                    {scores[k] ?? "—"}
                  </p>
                  <p className="mt-1 text-xs uppercase text-slate-500">{k}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-obsidian/30 p-5 text-sm text-slate-400">
              Skor belum dinilai. {String(content.note ?? "")}
            </div>
          )}

          {roadmap && Object.keys(roadmap).length > 0 && (
            <div className="mt-6">
              <p className="mb-3 font-mono text-xs uppercase tracking-wider text-slate-500">
                Roadmap
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {Object.entries(roadmap).map(([phase, items]) => (
                  <div key={phase} className="rounded-xl border border-white/8 bg-obsidian/40 p-4">
                    <p className="font-display text-sm font-bold capitalize text-mist">
                      {phase.replace(/_/g, " ")}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {(items as string[]).map((it) => (
                        <li key={it} className="flex gap-2 text-xs text-slate-300">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-coral" />
                          {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <p className="mb-4 font-mono text-xs uppercase tracking-wider text-slate-500">
            Konteks Bisnis
          </p>
          <dl className="space-y-3 text-sm">
            {Object.entries(context).map(([k, v]) => {
              if (!v || (Array.isArray(v) && v.length === 0)) return null;
              return (
                <div key={k}>
                  <dt className="text-xs capitalize text-slate-500">{k}</dt>
                  <dd className="text-slate-200">
                    {Array.isArray(v) ? v.join(", ") : String(v)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </Card>
      </div>

      {whatsMissing.length > 0 && (
        <Card className="mt-4 border-bad/20">
          <p className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-500">
            <AlertTriangle className="h-3.5 w-3.5 text-bad" /> Yang Hilang &amp; Bocor
          </p>
          <ul className="space-y-3">
            {whatsMissing.map((w, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-300">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-bad/25 bg-bad/10 font-mono text-[0.66rem] text-bad">
                  {i + 1}
                </span>
                {w}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {rb && (
        <Card className="mt-4 border-coral/20 bg-gradient-to-br from-coral/10 via-card/40 to-card/40">
          <p className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-500">
            <TrendingUp className="h-3.5 w-3.5 text-coral" /> Revenue Booster
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="text-xs text-slate-500">Sekarang</p>
              <p className="font-mono text-slate-400">{rb.current_estimate ?? "-"}</p>
            </div>
            <span className="pb-1 text-coral">→</span>
            <div>
              <p className="text-xs text-slate-500">Proyeksi</p>
              <p className="font-display text-2xl font-extrabold text-gradient-coral">
                {rb.projected ?? "-"}
              </p>
            </div>
            {rb.uplift && (
              <span className="mb-1 rounded-full border border-good/30 bg-good/10 px-2.5 py-1 font-mono text-xs text-good">
                {rb.uplift}
              </span>
            )}
          </div>
          {rb.levers && rb.levers.length > 0 && (
            <ul className="mt-4 space-y-2">
              {rb.levers.map((l, i) => (
                <li key={i} className="rounded-xl border border-white/5 bg-obsidian/50 px-4 py-2.5 text-sm text-slate-300">
                  {l}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {exec && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(["cmo", "cbo", "cto", "creative"] as const).map((role) => {
            const r2 = exec[role];
            if (!r2) return null;
            return (
              <Card key={role}>
                <p className="font-mono text-xs font-bold uppercase tracking-widest text-coral">
                  {role}
                </p>
                {r2.summary && (
                  <p className="mt-2 text-sm text-slate-300">{r2.summary}</p>
                )}
                {r2.actions && r2.actions.length > 0 && (
                  <ul className="mt-3 space-y-2 border-t border-white/5 pt-3">
                    {r2.actions.map((a, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-300">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-coral" />
                        {a}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {engineError && (
        <p className="mt-4 text-xs text-warn">
          Catatan engine: {engineError}
        </p>
      )}
    </>
  );
}
