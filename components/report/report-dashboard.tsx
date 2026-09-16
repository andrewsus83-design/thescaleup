import { Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ReportMetrics, PostMetric } from "@/lib/report/types";
import {
  efficiency,
  computeDeltas,
  qualityScore,
  bestDayTime,
  reelRows,
  overlapRows,
  totalInteraction as tiOf,
} from "@/lib/report/derive";

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("id-ID");
}
function pct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return (n * 100).toFixed(2) + "%";
}
function pct1(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return (n * 100).toFixed(1) + "%";
}
/** Ratios ≥1 read better as "×" (e.g. reach 4.8× followers), else as a percent. */
function times(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n >= 1 ? n.toFixed(1) + "×" : (n * 100).toFixed(1) + "%";
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** Δ badge for period-over-period change (fraction, e.g. 0.23 → +23%). */
function DeltaBadge({ d }: { d: number | null }) {
  if (d == null) return null;
  const up = d >= 0;
  const Icon = d === 0 ? Minus : up ? TrendingUp : TrendingDown;
  const cls = d === 0 ? "text-slate-400 bg-slate-100" : up ? "text-emerald-600 bg-emerald-50" : "text-red-500 bg-red-50";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />
      {up && d !== 0 ? "+" : ""}
      {(d * 100).toFixed(0)}%
    </span>
  );
}
function monthLabel(ym: string): string {
  const mo = Number(ym.slice(5, 7));
  return mo >= 1 && mo <= 12 ? `${MONTHS[mo - 1]} ${ym.slice(0, 4)}` : ym;
}
const CT_LABEL: Record<string, string> = {
  POST: "Post / Image",
  CAROUSEL_CONTAINER: "Carousel",
  REEL: "Reels",
  STORY: "Story",
};

function Tile({ label, value, accent, hint }: { label: string; value: string; accent?: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold" style={{ color: accent ?? "#1B2A4A" }}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

/** Simple SVG line chart of a daily series. */
function FollowerLine({ series, color }: { series: { date: string; value: number }[]; color: string }) {
  const vals = series.map((s) => s.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const w = 600;
  const h = 60;
  const pts = series
    .map((s, i) => `${(i / (series.length - 1)) * w},${h - ((s.value - min) / span) * (h - 8) - 4}`)
    .join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-16 w-full">
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        <span>{series[0]?.date}</span>
        <span>{series[series.length - 1]?.date}</span>
      </div>
    </div>
  );
}

/** Horizontal bar list of top demographic values. */
function BarList({
  title,
  items,
  color,
}: {
  title: string;
  items?: { name: string; value: number }[];
  color: string;
}) {
  const list = (items ?? []).slice(0, 5);
  const total = list.reduce((a, x) => a + x.value, 0) || 1;
  if (!list.length) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <div className="space-y-1.5">
        {list.map((x) => (
          <div key={x.name}>
            <div className="mb-0.5 flex justify-between text-xs">
              <span className="truncate text-slate-600">{x.name}</span>
              <span className="text-slate-400">{Math.round((x.value / total) * 100)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${(x.value / total) * 100}%`, backgroundColor: color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Follower-share vs engaged-share table with a signed gap. */
function OverlapTable({
  title,
  rows,
  brandColor,
  accentColor,
}: {
  title: string;
  rows: { name: string; follower: number; engaged: number; gap: number }[];
  brandColor: string;
  accentColor: string;
}) {
  const list = rows.slice(0, 6);
  if (!list.length) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[11px] uppercase text-slate-400">
            <th className="py-1">Segmen</th>
            <th className="py-1 text-right" style={{ color: brandColor }}>Followers</th>
            <th className="py-1 text-right" style={{ color: accentColor }}>Interaksi</th>
            <th className="py-1 text-right">Gap</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.name} className="border-t border-slate-50">
              <td className="py-1.5 pr-2 text-slate-600">{r.name}</td>
              <td className="py-1.5 text-right text-slate-500">{(r.follower * 100).toFixed(0)}%</td>
              <td className="py-1.5 text-right text-slate-500">{(r.engaged * 100).toFixed(0)}%</td>
              <td className={`py-1.5 text-right font-semibold ${r.gap >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {r.gap >= 0 ? "+" : ""}
                {(r.gap * 100).toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportDashboard({
  metrics,
  brandColor = "#2A2870",
  accentColor = "#38B6F0",
  showReason = false,
}: {
  metrics: ReportMetrics;
  brandColor?: string;
  accentColor?: string;
  showReason?: boolean;
}) {
  if (!metrics.connected) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
        <p className="font-semibold text-slate-700">Belum ada data laporan</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
          Data ditarik dari Zernio setelah akun terhubung dan laporan digenerate.
        </p>
        {showReason && metrics.reason && (
          <p className="mx-auto mt-3 max-w-md rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{metrics.reason}</p>
        )}
      </div>
    );
  }

  const t = metrics.totals;
  const posts = metrics.posts ?? [];
  const disc = metrics.discovery;
  const discTotal = (disc?.followers ?? 0) + (disc?.nonFollowers ?? 0);
  const ct = (metrics.byContentType ?? []).filter((c) => (c.reach ?? 0) > 0);
  const ctMax = Math.max(1, ...ct.map((c) => c.reach ?? 0));
  const series = metrics.reachSeries ?? [];
  const sMax = Math.max(1, ...series.map((s) => s.value));

  // ---- CMO efficiency + funnel + advanced metrics (shared with the Excel) ----
  const followersBase = metrics.account?.followers ?? null;
  const eff = efficiency(t, followersBase, posts.length);
  const deltas = computeDeltas(t, metrics.comparison);
  const qScore = qualityScore(posts);
  const bestTime = bestDayTime(posts);
  const reels = reelRows(posts);
  const genderOverlap = overlapRows(metrics.demographics?.genders, metrics.engagedDemographics?.genders);
  const ageOverlap = overlapRows(metrics.demographics?.ages, metrics.engagedDemographics?.ages);
  const netGrowth =
    metrics.followersGained != null || metrics.followersLost != null
      ? (metrics.followersGained ?? 0) - (metrics.followersLost ?? 0)
      : null;
  const growthRate = netGrowth != null && followersBase ? netGrowth / followersBase : null;

  // ---- per-pillar performance rollup (needs AI-suggested pillars) ----
  const pillarRoll = (() => {
    const m = new Map<string, { count: number; reach: number; ti: number }>();
    for (const p of posts) {
      if (!p.pillar) continue;
      const e = m.get(p.pillar) ?? { count: 0, reach: 0, ti: 0 };
      e.count += 1;
      e.reach += p.reach ?? 0;
      e.ti += tiOf(p);
      m.set(p.pillar, e);
    }
    return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.reach - a.reach);
  })();
  const pillarMaxReach = Math.max(1, ...pillarRoll.map((p) => p.reach));

  // ---- per-post rows grouped by month (mirrors the Excel Post Master) ----
  const sortedPosts = [...posts].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const monthGroups = (() => {
    const m = new Map<string, PostMetric[]>();
    for (const p of sortedPosts) {
      const k = (p.date || "").slice(0, 7) || "—";
      (m.get(k) ?? m.set(k, []).get(k)!).push(p);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  })();
  const sumBy = (arr: PostMetric[], f: (p: PostMetric) => number | null | undefined) =>
    arr.reduce((s, p) => s + (f(p) ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            {metrics.platform ? <span className="font-semibold capitalize">{metrics.platform}</span> : "Akun"} ·{" "}
            {metrics.account?.username ? `@${metrics.account.username}` : "terhubung"} · {metrics.period ?? "periode"}
          </p>
          <p className="text-lg font-bold" style={{ color: brandColor }}>
            {fmt(metrics.account?.followers)} followers
          </p>
        </div>
        {metrics.fetchedAt && (
          <p className="text-xs text-slate-400">Data ditarik: {new Date(metrics.fetchedAt).toLocaleString("id-ID")}</p>
        )}
      </div>

      {/* top-line tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Tile label="Reach" value={fmt(t?.reach)} accent={brandColor} />
        <Tile label="Impressions" value={fmt(t?.impressions)} />
        <Tile label="Total Interaksi" value={fmt(t?.totalInteractions)} accent={accentColor} />
        <Tile label="ER (Reach)" value={pct(t?.erReach)} />
        <Tile label="Accounts Engaged" value={fmt(t?.accountsEngaged)} />
        <Tile label="Likes" value={fmt(t?.likes)} />
        <Tile label="Komentar" value={fmt(t?.comments)} />
        <Tile label="Shares" value={fmt(t?.shares)} />
        <Tile label="Saved" value={fmt(t?.saved)} />
        <Tile label="Follows" value={fmt(t?.follows)} />
        <Tile label="Web Clicks" value={fmt(t?.webClicks)} />
        <Tile label="Jumlah Post" value={fmt(t?.posts)} />
      </div>

      {/* CMO: efficiency + profile-action funnel + quality (derived, shared with Excel) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="mb-3 text-sm font-semibold text-slate-700">Efisiensi, Funnel & Kualitas</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Tile label="Reach Rate" value={times(eff.reachRate)} accent={brandColor} hint="reach ÷ followers" />
          <Tile label="ER (Reach)" value={pct1(eff.erReach)} hint="interaksi ÷ reach" />
          <Tile label="Content Quality Score" value={qScore != null ? qScore.toFixed(1) : "—"} accent={accentColor} hint="engagement berbobot / 1k reach" />
          <Tile label="Saves Rate" value={pct1(eff.savesRate)} hint="saved ÷ reach · sinyal simpan" />
          <Tile label="Shares Rate" value={pct1(eff.sharesRate)} hint="shares ÷ reach · viralitas" />
          <Tile label="Profile Visit Rate" value={pct1(eff.pvRate)} hint="profil ÷ reach" />
          <Tile label="Follow Rate" value={pct1(eff.followRate)} hint="follows ÷ reach" />
          <Tile
            label="Net Follower Growth"
            value={netGrowth != null ? (netGrowth >= 0 ? "+" : "") + fmt(netGrowth) : "—"}
            accent={netGrowth != null && netGrowth < 0 ? "#DC2626" : brandColor}
            hint={growthRate != null ? `${pct1(growthRate)} dari basis` : "gained − lost"}
          />
          <Tile label="Avg Reach / Post" value={fmt(eff.avgReach != null ? Math.round(eff.avgReach) : null)} hint="rata-rata jangkauan" />
        </div>
      </div>

      {/* CMO: period-over-period comparison */}
      {deltas && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-slate-700">Perbandingan vs Periode Sebelumnya</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {[
              ["Reach", deltas.reach],
              ["Total Interaksi", deltas.totalInteractions],
              ["ER", deltas.erReach],
              ["Likes", deltas.likes],
              ["Komentar", deltas.comments],
              ["Saved", deltas.saved],
              ["Shares", deltas.shares],
            ].map(([label, d]) => (
              <div key={label as string} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-center">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
                <div className="mt-1.5 flex justify-center">
                  {d != null ? <DeltaBadge d={d as number} /> : <span className="text-xs text-slate-400">—</span>}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Dibandingkan dengan periode sepanjang yang sama tepat sebelum rentang tanggal ini.</p>
        </div>
      )}

      {/* CMO: best day / time to post */}
      {bestTime && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-slate-700">Waktu Terbaik Posting (WIB)</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Hari Terbaik" value={bestTime.day} accent={brandColor} hint={`avg reach ${fmt(bestTime.dayAvgReach)}`} />
            <Tile label="Jam Terbaik" value={`${String(bestTime.hour).padStart(2, "0")}:00`} accent={accentColor} hint={`avg reach ${fmt(bestTime.hourAvgReach)}`} />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Berdasarkan rata-rata reach per hari/jam dari post di periode ini.</p>
        </div>
      )}

      {/* CMO: performance per content pillar (needs AI-suggested pillars) */}
      {pillarRoll.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-slate-700">Performa per Pillar Konten</p>
          <div className="space-y-2.5">
            {pillarRoll.map((p) => (
              <div key={p.name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-slate-600">
                    {p.name} <span className="text-slate-400">· {p.count} post</span>
                  </span>
                  <span className="text-slate-500">
                    {fmt(p.reach)} reach · {fmt(p.ti)} interaksi
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${(p.reach / pillarMaxReach) * 100}%`, backgroundColor: brandColor }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Pillar disarankan AI (Claude) — regenerate laporan untuk mengisinya.</p>
        </div>
      )}

      {/* AI analysis (Claude Opus custom parameters) */}
      {metrics.aiAnalysis && metrics.aiAnalysis.length > 0 && (
        <div className="rounded-2xl border border-[#2A2870]/25 bg-gradient-to-br from-[#2A2870]/[0.06] to-white p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#2A2870]">
            <Sparkles className="h-4 w-4" /> Analisa AI (Claude Opus)
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {metrics.aiAnalysis.map((a, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-[#1B2A4A]">
                  {a.label}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] capitalize text-slate-500">{a.type}</span>
                </p>
                <p className="whitespace-pre-line text-sm text-slate-600">{a.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* discovery split */}
        {disc && discTotal > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="mb-3 text-sm font-semibold text-slate-700">Jangkauan: Followers vs Non-followers</p>
            <div className="flex h-4 overflow-hidden rounded-full">
              <div style={{ width: `${((disc.followers ?? 0) / discTotal) * 100}%`, backgroundColor: brandColor }} />
              <div style={{ width: `${((disc.nonFollowers ?? 0) / discTotal) * 100}%`, backgroundColor: accentColor }} />
            </div>
            <div className="mt-3 flex justify-between text-sm">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: brandColor }} /> Followers{" "}
                <b>{fmt(disc.followers)}</b> ({Math.round(((disc.followers ?? 0) / discTotal) * 100)}%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accentColor }} /> Non-followers{" "}
                <b>{fmt(disc.nonFollowers)}</b> ({Math.round(((disc.nonFollowers ?? 0) / discTotal) * 100)}%)
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Porsi non-followers tinggi = konten Anda banyak ditemukan lewat discovery/explore.
            </p>
          </div>
        )}

        {/* content type breakdown */}
        {ct.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="mb-3 text-sm font-semibold text-slate-700">Reach per Jenis Konten</p>
            <div className="space-y-2.5">
              {ct
                .sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))
                .map((c) => (
                  <div key={c.type}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-slate-600">{CT_LABEL[c.type] ?? c.type}</span>
                      <span className="text-slate-500">
                        {fmt(c.reach)} reach{c.interactions != null ? ` · ${fmt(c.interactions)} interaksi` : ""}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${((c.reach ?? 0) / ctMax) * 100}%`, backgroundColor: brandColor }} />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* follower growth */}
      {(metrics.followerSeries?.length || metrics.followersGained != null) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700">Pertumbuhan Follower</p>
            <div className="flex gap-4 text-sm">
              {metrics.followersGained != null && (
                <span className="text-emerald-600">+{fmt(metrics.followersGained)} gained</span>
              )}
              {metrics.followersLost != null && <span className="text-red-500">−{fmt(metrics.followersLost)} lost</span>}
              {metrics.account?.followers != null && (
                <span className="font-semibold" style={{ color: brandColor }}>
                  {fmt(metrics.account.followers)} total
                </span>
              )}
            </div>
          </div>
          {metrics.followerSeries && metrics.followerSeries.length > 1 && (
            <FollowerLine series={metrics.followerSeries} color={brandColor} />
          )}
        </div>
      )}

      {/* audience demographics */}
      {metrics.demographics &&
        ((metrics.demographics.ages?.length ?? 0) > 0 ||
          (metrics.demographics.cities?.length ?? 0) > 0 ||
          (metrics.demographics.genders?.length ?? 0) > 0) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="mb-4 text-sm font-semibold text-slate-700">Audiens (Followers)</p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <BarList title="Umur" items={metrics.demographics.ages} color={brandColor} />
              <BarList title="Gender" items={metrics.demographics.genders} color={accentColor} />
              <BarList title="Kota" items={metrics.demographics.cities} color={brandColor} />
              <BarList title="Negara" items={metrics.demographics.countries} color={accentColor} />
            </div>
          </div>
        )}

      {/* reels / video performance */}
      {metrics.reels && metrics.reels.count > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-slate-700">Performa Reels / Video</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Jumlah Video" value={fmt(metrics.reels.count)} />
            <Tile label="Total Views" value={fmt(metrics.reels.totalViews)} accent={accentColor} />
            <Tile label="Avg Watch Time" value={metrics.reels.avgWatchTimeSec != null ? `${metrics.reels.avgWatchTimeSec.toFixed(1)} dtk` : "—"} />
            <Tile label="Completion Rate" value={pct(metrics.reels.avgCompletion)} accent={brandColor} />
          </div>
        </div>
      )}

      {/* CMO: per-Reel retention detail */}
      {reels.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <p className="px-4 pt-4 text-sm font-semibold text-slate-700">Retensi Reels per Video</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="border-y border-slate-100 text-left uppercase tracking-wide text-slate-400">
                  <th className="p-2.5">Tanggal</th>
                  <th className="p-2.5">Konten</th>
                  <th className="p-2.5 text-right">Views</th>
                  <th className="p-2.5 text-right">Reach</th>
                  <th className="p-2.5 text-right">View Rate</th>
                  <th className="p-2.5 text-right">Avg Watch</th>
                  <th className="p-2.5 text-right">Completion</th>
                  <th className="p-2.5 text-right">Skip</th>
                </tr>
              </thead>
              <tbody>
                {reels.map((v, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0">
                    <td className="whitespace-nowrap p-2.5 text-slate-500">{v.date}</td>
                    <td className="max-w-[240px] p-2.5 text-slate-700">
                      <span className="line-clamp-1">{v.caption || "—"}</span>
                    </td>
                    <td className="p-2.5 text-right font-medium">{fmt(v.views)}</td>
                    <td className="p-2.5 text-right">{fmt(v.reach)}</td>
                    <td className="p-2.5 text-right text-slate-500">{v.viewRate != null ? times(v.viewRate) : "—"}</td>
                    <td className="p-2.5 text-right">{v.avgWatchSec != null ? `${v.avgWatchSec.toFixed(1)} dtk` : "—"}</td>
                    <td className="p-2.5 text-right">{pct1(v.completion)}</td>
                    <td className="p-2.5 text-right text-slate-500">{pct1(v.skip)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 pb-3 pt-2 text-[11px] text-slate-400">
            View Rate = views ÷ reach (daya tarik hook). Completion tinggi + Skip rendah = retensi kuat.
          </p>
        </div>
      )}

      {/* instagram stories */}
      {metrics.stories && metrics.stories.count > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-slate-700">Instagram Stories ({metrics.stories.count})</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <Tile label="Views" value={fmt(metrics.stories.views)} accent={brandColor} />
            <Tile label="Reach" value={fmt(metrics.stories.reach)} />
            <Tile label="Replies" value={fmt(metrics.stories.replies)} />
            <Tile label="Taps Fwd" value={fmt(metrics.stories.tapsForward)} />
            <Tile label="Taps Back" value={fmt(metrics.stories.tapsBack)} />
            <Tile label="Exits" value={fmt(metrics.stories.exits)} />
            <Tile label="Profile Visits" value={fmt(metrics.stories.profileVisits)} />
            <Tile label="Follows" value={fmt(metrics.stories.follows)} />
          </div>
        </div>
      )}

      {/* engaged-audience demographics */}
      {metrics.engagedDemographics &&
        ((metrics.engagedDemographics.ages?.length ?? 0) > 0 ||
          (metrics.engagedDemographics.cities?.length ?? 0) > 0 ||
          (metrics.engagedDemographics.genders?.length ?? 0) > 0) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="mb-4 text-sm font-semibold text-slate-700">Audiens yang Berinteraksi</p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <BarList title="Umur" items={metrics.engagedDemographics.ages} color={brandColor} />
              <BarList title="Gender" items={metrics.engagedDemographics.genders} color={accentColor} />
              <BarList title="Kota" items={metrics.engagedDemographics.cities} color={brandColor} />
              <BarList title="Negara" items={metrics.engagedDemographics.countries} color={accentColor} />
            </div>
          </div>
        )}

      {/* CMO: audience overlap — who follows vs who actually engages */}
      {(genderOverlap.length > 0 || ageOverlap.length > 0) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-1 text-sm font-semibold text-slate-700">Overlap Audiens: Followers vs yang Berinteraksi</p>
          <p className="mb-4 text-[11px] text-slate-400">
            Gap positif = segmen itu <b>lebih aktif</b> berinteraksi dibanding porsinya di followers.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <OverlapTable title="Umur" rows={ageOverlap} brandColor={brandColor} accentColor={accentColor} />
            <OverlapTable title="Gender" rows={genderOverlap} brandColor={brandColor} accentColor={accentColor} />
          </div>
        </div>
      )}

      {/* contact buttons */}
      {metrics.contactButtons && metrics.contactButtons.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-slate-700">Tap Tombol Kontak (Profil)</p>
          <div className="flex flex-wrap gap-2">
            {metrics.contactButtons.map((c) => (
              <span key={c.type} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                {c.type}: <b>{fmt(c.value)}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* reach trend */}
      {series.length > 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-slate-700">Tren Reach Harian</p>
          <div className="flex h-24 items-end gap-[3px]">
            {series.map((s, i) => (
              <div
                key={i}
                title={`${s.date}: ${fmt(s.value)}`}
                className="flex-1 rounded-t"
                style={{ height: `${Math.max(2, (s.value / sMax) * 100)}%`, backgroundColor: accentColor }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
            <span>{series[0]?.date}</span>
            <span>{series[series.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Post Master — full per-post detail (same columns as the Excel report) */}
      {posts.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between px-4 pt-4">
            <p className="text-sm font-semibold text-slate-700">Post Master — detail per post</p>
            <span className="text-[11px] text-slate-400">sama seperti Excel · {posts.length} post</span>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[1180px] text-xs">
              <thead>
                <tr className="border-y border-slate-100 text-left uppercase tracking-wide text-slate-400">
                  <th className="p-2.5">Tanggal</th>
                  <th className="p-2.5">Pillar</th>
                  <th className="p-2.5">Konten</th>
                  <th className="p-2.5 text-right">Followers</th>
                  <th className="p-2.5 text-right">Likes</th>
                  <th className="p-2.5 text-right">Komen</th>
                  <th className="p-2.5 text-right">ER</th>
                  <th className="p-2.5 text-right">Follows</th>
                  <th className="p-2.5 text-right">Profil</th>
                  <th className="p-2.5 text-right">Shared</th>
                  <th className="p-2.5 text-right">Saved</th>
                  <th className="p-2.5 text-right">Web Clk</th>
                  <th className="p-2.5 text-right">Impr.</th>
                  <th className="p-2.5 text-right">Reach</th>
                  <th className="p-2.5 text-right">Reach ER</th>
                  <th className="p-2.5 text-right">Total Int.</th>
                </tr>
              </thead>
              <tbody>
                {monthGroups.map(([ym, mp]) => (
                  <MonthRows key={ym} ym={ym} posts={mp} followersBase={followersBase} sumBy={sumBy} multi={monthGroups.length > 1} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/** One month's post rows + a bold month-total row (mirrors the Excel per-month total). */
function MonthRows({
  ym,
  posts,
  followersBase,
  sumBy,
  multi,
}: {
  ym: string;
  posts: PostMetric[];
  followersBase: number | null;
  sumBy: (arr: PostMetric[], f: (p: PostMetric) => number | null | undefined) => number;
  multi: boolean;
}) {
  return (
    <>
      {multi && (
        <tr className="bg-slate-50/70">
          <td colSpan={16} className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {monthLabel(ym)}
          </td>
        </tr>
      )}
      {posts.map((p, i) => {
        const ti = tiOf(p);
        const followers = p.followersAtPeriod ?? followersBase;
        return (
          <tr key={i} className="border-b border-slate-50 last:border-0">
            <td className="whitespace-nowrap p-2.5 text-slate-500">{p.date}</td>
            <td className="whitespace-nowrap p-2.5 text-slate-600">{p.pillar ?? "—"}</td>
            <td className="max-w-[220px] p-2.5 text-slate-700">
              <span className="line-clamp-2">{p.caption || "—"}</span>
            </td>
            <td className="p-2.5 text-right text-slate-500">{fmt(followers)}</td>
            <td className="p-2.5 text-right">{fmt(p.likes)}</td>
            <td className="p-2.5 text-right">{fmt(p.comments)}</td>
            <td className="p-2.5 text-right text-slate-500">{followers ? pct1(ti / followers) : "—"}</td>
            <td className="p-2.5 text-right">{fmt(p.follows)}</td>
            <td className="p-2.5 text-right">{fmt(p.profileVisits)}</td>
            <td className="p-2.5 text-right">{fmt(p.shares)}</td>
            <td className="p-2.5 text-right">{fmt(p.saved)}</td>
            <td className="p-2.5 text-right">{fmt(p.webClicks)}</td>
            <td className="p-2.5 text-right">{fmt(p.impressions)}</td>
            <td className="p-2.5 text-right font-medium">{fmt(p.reach)}</td>
            <td className="p-2.5 text-right text-slate-500">{p.reach ? pct1(ti / p.reach) : "—"}</td>
            <td className="p-2.5 text-right font-semibold">{fmt(ti)}</td>
          </tr>
        );
      })}
      <tr className="border-b border-slate-100 bg-amber-50/50 font-semibold text-slate-700">
        <td className="p-2.5" colSpan={3}>
          {multi ? `${monthLabel(ym)} — Total` : "Total"}
        </td>
        <td className="p-2.5"></td>
        <td className="p-2.5 text-right">{fmt(sumBy(posts, (p) => p.likes))}</td>
        <td className="p-2.5 text-right">{fmt(sumBy(posts, (p) => p.comments))}</td>
        <td className="p-2.5"></td>
        <td className="p-2.5 text-right">{fmt(sumBy(posts, (p) => p.follows))}</td>
        <td className="p-2.5 text-right">{fmt(sumBy(posts, (p) => p.profileVisits))}</td>
        <td className="p-2.5 text-right">{fmt(sumBy(posts, (p) => p.shares))}</td>
        <td className="p-2.5 text-right">{fmt(sumBy(posts, (p) => p.saved))}</td>
        <td className="p-2.5 text-right">{fmt(sumBy(posts, (p) => p.webClicks))}</td>
        <td className="p-2.5 text-right">{fmt(sumBy(posts, (p) => p.impressions))}</td>
        <td className="p-2.5 text-right">{fmt(sumBy(posts, (p) => p.reach))}</td>
        <td className="p-2.5"></td>
        <td className="p-2.5 text-right">{fmt(sumBy(posts, tiOf))}</td>
      </tr>
    </>
  );
}
