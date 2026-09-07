import {
  AlertTriangle,
  TrendingUp,
  Blocks,
  Activity,
  Eye,
  Crosshair,
  Lightbulb,
  HeartHandshake,
} from "lucide-react";
import { ScoreRing } from "@/components/ui/score-ring";
import { Card } from "@/components/admin/ui";
import { builderTitle } from "@/lib/builders";
import { cn } from "@/lib/utils";
import { SuccessMeter } from "@/components/report/success-meter";

type Exec = Record<string, { summary?: string; actions?: string[] }>;

function Narrative({
  icon,
  label,
  text,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  text: string;
  accent?: boolean;
}) {
  return (
    <Card
      className={
        accent
          ? "border-coral/20 bg-gradient-to-br from-coral/10 via-card/40 to-card/40"
          : undefined
      }
    >
      <p className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-500">
        {icon} {label}
      </p>
      <p className="text-sm leading-relaxed text-slate-300">{text}</p>
    </Card>
  );
}

export function ReportView({
  content,
  summary,
}: {
  content: Record<string, unknown>;
  summary?: string | null;
}) {
  const scores = (content.scores ?? {}) as Record<string, number | null>;
  const hasScores = Object.values(scores).some((v) => v != null);
  const whatsMissing = (content.whats_missing as string[]) ?? [];
  const rb = (content.revenue_booster ?? null) as {
    current_estimate?: string;
    projected?: string;
    uplift?: string;
    levers?: string[];
  } | null;
  const exec = (content.executive ?? null) as Exec | null;
  const roadmap = (content.roadmap ?? {}) as Record<string, string[]>;
  const recBuilders = (content.recommended_builders ?? []) as {
    builder: string;
    priority?: string;
    fit?: number;
    reason?: string;
  }[];
  const currentCondition = content.current_condition as string | undefined;
  const brandPerception = content.brand_perception as string | undefined;
  const competitiveness = content.competitiveness as string | undefined;
  const opportunities = (content.opportunities as string[]) ?? [];
  const howHelps = content.how_scaleup_helps as string | undefined;
  const pillars = [
    { label: "CRO", v: scores.cro },
    { label: "GEO / AI Search", v: scores.geo },
    { label: "Social", v: scores.social },
    { label: "Tech", v: scores.tech },
  ];

  return (
    <div className="space-y-4">
      {summary && (
        <Card>
          <p className="text-sm leading-relaxed text-slate-300">{summary}</p>
        </Card>
      )}

      <SuccessMeter content={content} />

      {currentCondition && (
        <Narrative
          icon={<Activity className="h-3.5 w-3.5 text-coral" />}
          label="Kondisi Saat Ini"
          text={currentCondition}
        />
      )}
      {brandPerception && (
        <Narrative
          icon={<Eye className="h-3.5 w-3.5 text-coral" />}
          label="Apa yang Dunia Lihat (Brand & Sosial)"
          text={brandPerception}
        />
      )}

      {hasScores && (
        <Card>
          <p className="mb-4 font-mono text-xs uppercase tracking-wider text-slate-500">
            Skor 4 Pilar
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {pillars.map((p) => (
              <div key={p.label} className="flex flex-col items-center gap-2">
                <ScoreRing value={Number(p.v ?? 0)} size={92} stroke={8} />
                <span className="text-center text-xs text-slate-400">
                  {p.label}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {competitiveness && (
        <Narrative
          icon={<Crosshair className="h-3.5 w-3.5 text-coral" />}
          label="Daya Saing vs Kompetitor"
          text={competitiveness}
        />
      )}

      {whatsMissing.length > 0 && (
        <Card className="border-bad/20">
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

      {opportunities.length > 0 && (
        <Card className="border-good/15">
          <p className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-500">
            <Lightbulb className="h-3.5 w-3.5 text-good" /> Peluang
          </p>
          <ul className="space-y-3">
            {opportunities.map((o, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-300">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-good/25 bg-good/10 font-mono text-[0.66rem] text-good">
                  {i + 1}
                </span>
                {o}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {rb && (
        <Card className="border-coral/20 bg-gradient-to-br from-coral/10 via-card/40 to-card/40">
          <p className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-500">
            <TrendingUp className="h-3.5 w-3.5 text-coral" /> Revenue Booster
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="text-xs text-slate-500">Sekarang</p>
              <p className="font-mono text-slate-400">
                {rb.current_estimate ?? "-"}
              </p>
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
                <li
                  key={i}
                  className="rounded-xl border border-white/5 bg-obsidian/50 px-4 py-2.5 text-sm text-slate-300"
                >
                  {l}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {recBuilders.length > 0 && (
        <Card className="border-coral/15">
          <p className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-500">
            <Blocks className="h-3.5 w-3.5 text-coral" /> Rekomendasi Builder (produk/jasa)
          </p>
          <div className="space-y-2.5">
            {recBuilders.map((r, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/8 bg-obsidian/40 p-3.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-200">
                    {builderTitle(r.builder)}
                  </span>
                  {r.priority && (
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[0.6rem] uppercase",
                        r.priority === "high"
                          ? "border-coral/30 bg-coral/10 text-coral"
                          : "border-white/15 text-slate-400",
                      )}
                    >
                      {r.priority}
                    </span>
                  )}
                  {typeof r.fit === "number" && (
                    <span className="font-mono text-xs text-slate-500">
                      fit {r.fit}
                    </span>
                  )}
                </div>
                {r.reason && (
                  <p className="mt-1 text-xs text-slate-400">{r.reason}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {howHelps && (
        <Narrative
          accent
          icon={<HeartHandshake className="h-3.5 w-3.5 text-coral" />}
          label="Bagaimana ScaleUp Membantu"
          text={howHelps}
        />
      )}

      {exec && (
        <div className="grid gap-4 sm:grid-cols-2">
          {(["cmo", "cbo", "cto", "creative"] as const).map((role) => {
            const r = exec[role];
            if (!r) return null;
            return (
              <Card key={role}>
                <p className="font-mono text-xs font-bold uppercase tracking-widest text-coral">
                  {role}
                </p>
                {r.summary && (
                  <p className="mt-2 text-sm text-slate-300">{r.summary}</p>
                )}
                {r.actions && r.actions.length > 0 && (
                  <ul className="mt-3 space-y-2 border-t border-white/5 pt-3">
                    {r.actions.map((a, i) => (
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

      {(roadmap.phase_1 || roadmap.phase_2 || roadmap.phase_3) && (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { key: "phase_1", label: "Fase 1 · Quick Wins" },
            { key: "phase_2", label: "Fase 2 · Growth" },
            { key: "phase_3", label: "Fase 3 · Scale" },
          ].map((p) => (
            <Card key={p.key}>
              <p className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-coral">
                {p.label}
              </p>
              <ul className="space-y-2">
                {(roadmap[p.key] ?? []).map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
                    {t}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
