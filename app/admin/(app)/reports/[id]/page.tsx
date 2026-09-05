import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Send, Database } from "lucide-react";
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
    </>
  );
}
