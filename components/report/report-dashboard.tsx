import type { ReportMetrics, PostMetric } from "@/lib/report/types";

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("id-ID");
}
function pct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return (n * 100).toFixed(2) + "%";
}
const CT_LABEL: Record<string, string> = {
  POST: "Post / Image",
  CAROUSEL_CONTAINER: "Carousel",
  REEL: "Reels",
  STORY: "Story",
};

function Tile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold" style={{ color: accent ?? "#1B2A4A" }}>
        {value}
      </p>
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

      {/* per-post table */}
      {posts.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="p-3">Tanggal</th>
                <th className="p-3">Konten</th>
                <th className="p-3 text-right">Reach</th>
                <th className="p-3 text-right">Impr.</th>
                <th className="p-3 text-right">Likes</th>
                <th className="p-3 text-right">Komen</th>
                <th className="p-3 text-right">Saved</th>
                <th className="p-3 text-right">Shares</th>
                <th className="p-3 text-right">ER%</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p: PostMetric, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  <td className="whitespace-nowrap p-3 text-slate-500">{p.date}</td>
                  <td className="max-w-[240px] p-3 text-slate-700">
                    <span className="line-clamp-2">{p.caption || "—"}</span>
                  </td>
                  <td className="p-3 text-right font-medium">{fmt(p.reach)}</td>
                  <td className="p-3 text-right">{fmt(p.impressions)}</td>
                  <td className="p-3 text-right">{fmt(p.likes)}</td>
                  <td className="p-3 text-right">{fmt(p.comments)}</td>
                  <td className="p-3 text-right">{fmt(p.saved)}</td>
                  <td className="p-3 text-right">{fmt(p.shares)}</td>
                  <td className="p-3 text-right text-slate-500">
                    {p.engagementRate != null ? p.engagementRate.toFixed(1) + "%" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
