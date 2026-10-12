import { Suspense } from "react";
import Link from "next/link";
import { Layers, Sparkles, TrendingUp, Lightbulb, Search } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import {
  listClients,
  getLatestSnapshot,
  getClientKey,
  listClientAccounts,
  getChannelFlags,
} from "@/lib/report/data";
import type { ReportMetrics } from "@/lib/report/types";
import {
  computeHealthScore,
  generateCMOTips,
  generateResearch,
  type HealthScore,
  type CMOTip,
  type ResearchCard,
} from "@/lib/report/analytic-ai";
import { AdminBottomNav } from "@/components/report/admin-bottom-nav";
import { aggregateMetrics } from "@/lib/report/aggregate";

export const dynamic = "force-dynamic";

export default async function AnalyticPage({
  searchParams,
}: {
  searchParams: Promise<{ accounts?: string; webs?: string; account?: string }>;
}) {
  await requireAdmin();
  const { accounts: accCsv, account, webs: websCsv } = await searchParams;

  const allClients = isSupabaseAdminConfigured() ? await listClients() : [];
  const flags = allClients.length ? await getChannelFlags() : {};
  const acctLists = await Promise.all(allClients.map((c) => listClientAccounts(c.id)));
  const clientAccounts = await Promise.all(
    allClients.map(async (c, i) => {
      let accounts = acctLists[i] ?? [];
      if (!accounts.length && flags[c.id]?.social) {
        const acc = await getClientKey(c.id, "zernio_account_id");
        if (acc)
          accounts = [{ id: acc, username: c.igHandle, displayName: c.name, platform: "instagram", followers: null }];
      }
      return { client: c, accounts };
    }),
  );
  const allAccounts = clientAccounts.flatMap(({ client: c, accounts }) =>
    accounts.map((a) => ({ ...a, clientId: c.id })),
  );
  const accById = new Map(allAccounts.map((a) => [a.id, a]));

  const has = (id: string) => allClients.some((c) => c.id === id);
  let accountIds = (accCsv ?? account ?? "").split(",").map((s) => s.trim()).filter((id) => accById.has(id));
  const webIds = (websCsv ?? "").split(",").map((s) => s.trim()).filter((id) => id && has(id));
  if (!accountIds.length && allAccounts[0]) accountIds = [allAccounts[0].id];

  const selectedAccounts = accountIds.map((id) => accById.get(id)!);
  const combined = selectedAccounts.length > 1;
  const primaryAcc = selectedAccounts[0] ?? null;
  const primary =
    (primaryAcc && allClients.find((c) => c.id === primaryAcc.clientId)) ??
    allClients.find((c) => c.id === webIds[0]) ??
    allClients[0] ??
    null;

  let metrics: ReportMetrics | null = null;
  if (selectedAccounts.length) {
    if (combined) {
      const snaps = await Promise.all(
        selectedAccounts.map((a) => getLatestSnapshot(a.clientId, a.id, a.platform !== "tiktok")),
      );
      metrics = aggregateMetrics(
        snaps.filter(Boolean).map((s) => s!.data),
        `Gabungan · ${selectedAccounts.length} akun`,
      );
    } else if (primaryAcc) {
      const snap = await getLatestSnapshot(primaryAcc.clientId, primaryAcc.id, primaryAcc.platform !== "tiktok");
      metrics = snap?.data ?? null;
    }
  }

  const score = metrics ? computeHealthScore(metrics) : null;

  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 pt-8 sm:px-8">
      {/* account identity bar */}
      {primary && (
        <div className="mb-6 flex items-center gap-3">
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: primary.brandColor }}
          >
            {combined ? <Layers className="h-5 w-5" /> : primary.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <p className="font-bold text-[#1B2A4A]">
              {combined ? `Gabungan · ${selectedAccounts.length} akun` : primary.name}
            </p>
            <p className="text-xs text-slate-500">
              {primaryAcc
                ? `${primaryAcc.platform ?? "social"}${primaryAcc.username ? ` · @${primaryAcc.username}` : ""}`
                : primary.slug}
            </p>
          </div>
        </div>
      )}

      {!metrics ? (
        <NoData />
      ) : (
        <div className="space-y-5">
          {/* ── Score ── */}
          <Section icon={<TrendingUp className="h-4 w-4" />} title="Skor Kesehatan Sosial">
            {score ? <HealthScoreCard score={score} /> : <p className="text-sm text-slate-500">Data tidak cukup untuk menghitung skor.</p>}
          </Section>

          {/* ── Tips & Tricks (AI) ── */}
          <Section icon={<Lightbulb className="h-4 w-4" />} title="Tips & Tricks — CMO & Digital Marketing">
            <Suspense fallback={<AISkeleton count={5} />}>
              {primary && <TipsSection clientId={primary.id} metrics={metrics} />}
            </Suspense>
          </Section>

          {/* ── Research (AI) ── */}
          <Section icon={<Search className="h-4 w-4" />} title="Research — SEO · GEO · Social Search">
            <Suspense fallback={<AISkeleton count={4} />}>
              {primary && <ResearchSection clientId={primary.id} metrics={metrics} />}
            </Suspense>
          </Section>
        </div>
      )}

      <AdminBottomNav accountIds={accountIds} webIds={webIds} active="analytic" />
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((card, i) => (
        <ResearchCardItem key={i} card={card} />
      ))}
    </div>
  );
}

/* ─── UI primitives ─── */

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#1B2A4A]">
        <span className="text-[#2A2870]">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function HealthScoreCard({ score }: { score: HealthScore }) {
  return (
    <div className="space-y-5">
      {/* total + grade */}
      <div className="flex items-end gap-5">
        <div>
          <span className="text-5xl font-extrabold tabular-nums" style={{ color: score.color }}>
            {score.total}
          </span>
          <span className="ml-1 text-xl text-slate-400">/100</span>
        </div>
        <div className="mb-1">
          <span
            className="inline-flex items-center rounded-lg px-3 py-1 text-sm font-bold text-white"
            style={{ backgroundColor: score.color }}
          >
            Grade {score.grade} · {score.label}
          </span>
        </div>
      </div>

      {/* sub-scores */}
      <div className="grid gap-3 sm:grid-cols-2">
        {score.subScores.map((sub) => (
          <div key={sub.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">{sub.label}</span>
              <span className="font-bold text-slate-900">
                {sub.score}/{sub.max}
              </span>
            </div>
            <div className="mb-1.5 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${(sub.score / sub.max) * 100}%`,
                  backgroundColor: sub.score / sub.max >= 0.8 ? "#16a34a" : sub.score / sub.max >= 0.6 ? "#d97706" : "#dc2626",
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{sub.value}</span>
              <span className="text-slate-400">patokan {sub.bench}</span>
            </div>
            {sub.tip && (
              <p className="mt-1.5 text-xs text-amber-700">
                💡 {sub.tip}
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
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-xl">{tip.emoji}</span>
        <span className="text-sm font-semibold text-[#1B2A4A]">{tip.title}</span>
      </div>
      <p className="text-sm text-slate-600">{tip.body}</p>
    </div>
  );
}

const CATEGORY_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  SEO: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  GEO: { bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-500" },
  "Social Search": { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
};

function ResearchCardItem({ card }: { card: ResearchCard }) {
  const s = CATEGORY_STYLE[card.category] ?? CATEGORY_STYLE.SEO;
  return (
    <div className={`rounded-xl border border-slate-100 p-4 ${s.bg}`}>
      <div className="mb-2 flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${s.dot}`} />
        <span className={`text-xs font-bold uppercase tracking-wide ${s.text}`}>{card.category}</span>
      </div>
      <p className="mb-2 text-sm font-medium text-slate-800">{card.insight}</p>
      <p className="text-xs text-slate-600">
        <span className="font-semibold text-slate-700">Aksi: </span>
        {card.action}
      </p>
    </div>
  );
}

function AISkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}

function NoData() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
      <Sparkles className="mx-auto mb-3 h-8 w-8 text-slate-300" />
      <p className="font-semibold text-slate-700">Belum ada laporan</p>
      <p className="mt-1 text-sm text-slate-500">
        Buka tab{" "}
        <Link href="/report/admin" className="font-semibold text-[#2A2870] underline">
          Report
        </Link>{" "}
        → Tarik data terlebih dahulu.
      </p>
    </div>
  );
}

function NoApiKey() {
  return (
    <p className="text-sm text-amber-700">
      Claude API key belum diisi. Isi di{" "}
      <span className="font-semibold">Setting → Claude API key</span> untuk mengaktifkan analisa AI.
    </p>
  );
}

function AIError() {
  return <p className="text-sm text-slate-500">Analisa AI tidak tersedia saat ini. Coba lagi nanti.</p>;
}
