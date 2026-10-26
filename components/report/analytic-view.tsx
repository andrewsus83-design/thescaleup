import { Suspense } from "react";
import Link from "next/link";
import { Lightbulb, Search, Sparkles, TrendingUp } from "lucide-react";
import { getClientKey } from "@/lib/report/data";
import type { ReportMetrics } from "@/lib/report/types";
import { computeHealthScore, generateCMOTips, generateResearch, type HealthScore, type CMOTip, type ResearchCard } from "@/lib/report/analytic-ai";
import type { ReportView } from "@/lib/report/view";
import { Alert, Bar, Card, Chip, EmptyState, type Tone } from "@/components/brand/primitives";
import { btnCls, capsCls, tileCls } from "@/components/brand/styles";
import { cn } from "@/lib/utils";
import { ReportAvatar } from "@/components/report/report-avatar";

/**
 * The Analytic screen of report.thescaleup.xyz without its page frame: who it is about, the health score, and the
 * AI tips and research (streamed, so the score shows first). The standalone page (/report/admin/analytic) and the Chat
 * Room (Project → Report → Analytic) both render this. Brand v2: white cards on Paper, Paper tiles, status as a chip
 * (dot + label), the score in Title 800 72 with its `/ 100` in Mono (BRAND "Card · Skor").
 *  - `reportHref`: where "pull the report first" points (the Report screen of the host page).
 */
export function AnalyticView({ view, reportHref }: { view: ReportView; reportHref: string }) {
  const { selectedAccounts, combined, primaryAcc, primary, metrics } = view;
  const score = metrics ? computeHealthScore(metrics) : null;

  return (
    <div className="space-y-6">
      {/* account identity bar */}
      {primary && (
        <div className="flex items-center gap-4">
          <ReportAvatar name={primary.name} combined={combined} />
          <div className="min-w-0">
            <p className="truncate font-title text-h3 text-ink-800">{combined ? `Gabungan · ${selectedAccounts.length} akun` : primary.name}</p>
            <p className="truncate text-small text-ink-500">
              {primaryAcc ? `${primaryAcc.platform ?? "social"}${primaryAcc.username ? ` · @${primaryAcc.username}` : ""}` : primary.slug}
            </p>
          </div>
        </div>
      )}

      {!metrics ? (
        <NoData reportHref={reportHref} />
      ) : (
        <>
          {/* ── Score ── */}
          <Section icon={<TrendingUp className="size-5" aria-hidden />} title="Skor Kesehatan Sosial">
            {score ? <HealthScoreCard score={score} /> : <p className="text-body text-ink-500">Data tidak cukup untuk menghitung skor.</p>}
          </Section>

          {/* ── Tips & Tricks (AI) ── */}
          <Section icon={<Lightbulb className="size-5" aria-hidden />} title="Tips & Tricks — CMO & Digital Marketing">
            <Suspense fallback={<AISkeleton count={5} />}>
              {primary && <TipsSection clientId={primary.id} metrics={metrics} />}
            </Suspense>
          </Section>

          {/* ── Research (AI) ── */}
          <Section icon={<Search className="size-5" aria-hidden />} title="Research — SEO · GEO · Social Search">
            <Suspense fallback={<AISkeleton count={4} />}>
              {primary && <ResearchSection clientId={primary.id} metrics={metrics} />}
            </Suspense>
          </Section>
        </>
      )}
    </div>
  );
}

/* ─── async AI server components (stream via Suspense) ─── */

async function TipsSection({ clientId, metrics }: { clientId: string; metrics: ReportMetrics }) {
  const apiKey = await getClientKey(clientId, "claude");
  if (!apiKey) return <NoApiKey />;
  const tips = await generateCMOTips(apiKey, metrics);
  if (!tips.length) return <AIError />;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tips.map((tip, i) => (
        <TipCard key={i} tip={tip} />
      ))}
    </div>
  );
}

async function ResearchSection({ clientId, metrics }: { clientId: string; metrics: ReportMetrics }) {
  const apiKey = await getClientKey(clientId, "claude");
  if (!apiKey) return <NoApiKey />;
  const cards = await generateResearch(apiKey, metrics);
  if (!cards.length) return <AIError />;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cards.map((card, i) => (
        <ResearchCardItem key={i} card={card} />
      ))}
    </div>
  );
}

/* ─── UI pieces ─── */

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-6 flex items-center gap-3 font-title text-h3 text-ink-800">
        <span className="text-ink-500">{icon}</span>
        {title}
      </h2>
      {children}
    </Card>
  );
}

/** A sub-score meter turns green from 80%, amber from 60%, red below: the same cut-offs as the grade. */
const subTone = (ratio: number) => (ratio >= 0.8 ? "ok" : ratio >= 0.6 ? "warn" : "bad");

function HealthScoreCard({ score }: { score: HealthScore }) {
  return (
    <div className="space-y-6">
      {/* total + grade */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <p className="font-title text-display text-ink-800">
          {score.total}
          <span className="ml-2 font-mono text-caption font-medium tracking-normal text-ink-500">/ 100</span>
        </p>
        <Chip tone={score.tone as Tone}>
          Grade {score.grade} · {score.label}
        </Chip>
      </div>

      {/* sub-scores */}
      <div className="grid gap-4 sm:grid-cols-2">
        {score.subScores.map((sub) => (
          <div key={sub.label} className={cn(tileCls, "space-y-3")}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-small font-semibold text-ink-800">{sub.label}</span>
              <span className="font-mono text-caption font-medium text-ink-800">
                {sub.score}/{sub.max}
              </span>
            </div>
            <Bar value={sub.score} max={sub.max} tone={subTone(sub.score / sub.max)} label={`${sub.label}: ${sub.score} dari ${sub.max}`} />
            <div className="flex items-center justify-between gap-3 text-caption text-ink-500">
              <span className="font-mono">{sub.value}</span>
              <span>patokan {sub.bench}</span>
            </div>
            {sub.tip && (
              <p className="flex items-start gap-2 text-caption text-ink-800">
                <Lightbulb className="mt-1 size-4 shrink-0 text-warning" aria-hidden />
                {sub.tip}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TipCard({ tip }: { tip: CMOTip }) {
  return (
    <div className={cn(tileCls, "space-y-2")}>
      <p className="flex items-center gap-3 font-title text-body font-bold text-ink-800">
        <span className="text-h3" aria-hidden>
          {tip.emoji}
        </span>
        {tip.title}
      </p>
      <p className="text-small font-normal text-ink-500">{tip.body}</p>
    </div>
  );
}

const CATEGORY_TONE: Record<string, Tone> = { SEO: "info", GEO: "brand", "Social Search": "ok" };

function ResearchCardItem({ card }: { card: ResearchCard }) {
  return (
    <div className={cn(tileCls, "space-y-3")}>
      <Chip tone={CATEGORY_TONE[card.category] ?? "info"}>{card.category}</Chip>
      <p className="text-small font-medium text-ink-800">{card.insight}</p>
      <p className="text-caption text-ink-500">
        <span className={capsCls}>Aksi</span> {card.action}
      </p>
    </div>
  );
}

function AISkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2" role="status" aria-label="Memuat analisa AI">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-field bg-paper-100" />
      ))}
    </div>
  );
}

function NoData({ reportHref }: { reportHref: string }) {
  return (
    <EmptyState
      icon={<Sparkles className="size-5" aria-hidden />}
      title="Belum ada laporan"
      hint="Buka tab Report dan tarik data terlebih dahulu; skor dan analisa dihitung dari laporan itu."
    >
      <Link href={reportHref} className={btnCls("secondary", "md")}>
        Buka Report
      </Link>
    </EmptyState>
  );
}

function NoApiKey() {
  return (
    <Alert tone="warn">
      Claude API key belum diisi. Isi di <strong className="font-semibold">Setting → Claude API key</strong> untuk mengaktifkan analisa AI.
    </Alert>
  );
}

function AIError() {
  return <Alert tone="info">Analisa AI tidak tersedia saat ini. Coba lagi nanti.</Alert>;
}
