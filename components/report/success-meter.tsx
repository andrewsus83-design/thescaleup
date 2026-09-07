import { Search, Bot, HeartHandshake, Newspaper } from "lucide-react";
import { ScoreRing } from "@/components/ui/score-ring";
import { Card } from "@/components/admin/ui";

type ScoreItem = { score?: number; target?: number; reason?: string };

const FACTORS = [
  { key: "self", label: "Score Pribadi", hint: "SEO · GEO · Web · Tech" },
  { key: "social", label: "Score Social", hint: "Konten & sentimen sosial" },
  { key: "competitor", label: "Score vs Kompetitor", hint: "Daya saing" },
] as const;

const LANDSCAPE = [
  { key: "seo", label: "SEO", icon: Search },
  { key: "geo", label: "GEO / AI Search", icon: Bot },
  { key: "social", label: "Social Media", icon: HeartHandshake },
  { key: "news", label: "Berita / PR", icon: Newspaper },
] as const;

export function SuccessMeter({
  content,
  compact,
}: {
  content: Record<string, unknown>;
  compact?: boolean;
}) {
  const ss = (content.success_scores ?? {}) as Record<string, ScoreItem>;
  const landscape = (content.landscape ?? {}) as Record<string, string>;
  const hasScores = FACTORS.some((f) => ss[f.key]?.score != null);
  if (!hasScores) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {FACTORS.map((f) => {
          const it = ss[f.key] ?? {};
          const cur = Number(it.score ?? 0);
          const tgt = it.target != null ? Number(it.target) : null;
          const delta = tgt != null ? tgt - cur : null;
          return (
            <Card key={f.key} className="flex flex-col items-center text-center">
              <ScoreRing value={cur} size={104} stroke={9} />
              <p className="mt-3 font-display text-sm font-bold text-mist">
                {f.label}
              </p>
              <p className="text-[0.68rem] text-slate-500">{f.hint}</p>
              {tgt != null && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-good/25 bg-good/10 px-2.5 py-1 text-xs text-good">
                  <span className="text-slate-400">target</span>
                  <span className="font-mono font-bold">{tgt}</span>
                  {delta != null && delta > 0 && (
                    <span className="font-mono">(+{delta})</span>
                  )}
                </div>
              )}
              {!compact && it.reason && (
                <p className="mt-3 border-t border-white/5 pt-3 text-xs leading-relaxed text-slate-400">
                  {it.reason}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {!compact &&
        LANDSCAPE.some((l) => landscape[l.key]) && (
          <Card>
            <p className="mb-4 font-mono text-xs uppercase tracking-wider text-slate-500">
              Landscape Digital
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {LANDSCAPE.map((l) => {
                const txt = landscape[l.key];
                if (!txt) return null;
                const Icon = l.icon;
                return (
                  <div
                    key={l.key}
                    className="rounded-xl border border-white/8 bg-obsidian/40 p-3.5"
                  >
                    <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-coral">
                      <Icon className="h-3.5 w-3.5" /> {l.label}
                    </p>
                    <p className="text-sm leading-relaxed text-slate-300">
                      {txt}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
    </div>
  );
}
