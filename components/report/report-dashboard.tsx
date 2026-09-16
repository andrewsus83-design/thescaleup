import type { ReportMetrics, PostMetric } from "@/lib/report/types";

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("id-ID");
}
function pct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return (n * 100).toFixed(2) + "%";
}

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

/** Renders a client's normalized metrics, or a clear not-connected state (never fake data). */
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
          <p className="mx-auto mt-3 max-w-md rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {metrics.reason}
          </p>
        )}
      </div>
    );
  }

  const t = metrics.totals;
  const posts = metrics.posts ?? [];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            {metrics.account?.username ? `@${metrics.account.username}` : "Akun terhubung"} ·{" "}
            {metrics.period ?? "periode"}
          </p>
          <p className="text-lg font-bold" style={{ color: brandColor }}>
            {fmt(metrics.account?.followers)} followers
          </p>
        </div>
        {metrics.fetchedAt && (
          <p className="text-xs text-slate-400">
            Data ditarik: {new Date(metrics.fetchedAt).toLocaleString("id-ID")}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Tile label="Reach" value={fmt(t?.reach)} accent={brandColor} />
        <Tile label="Impressions" value={fmt(t?.impressions)} />
        <Tile label="Total Interaksi" value={fmt(t?.totalInteractions)} accent={accentColor} />
        <Tile label="ER (Reach)" value={pct(t?.erReach)} />
        <Tile label="Likes" value={fmt(t?.likes)} />
        <Tile label="Komentar" value={fmt(t?.comments)} />
        <Tile label="Shares" value={fmt(t?.shares)} />
        <Tile label="Saved" value={fmt(t?.saved)} />
        <Tile label="Profile Visits" value={fmt(t?.profileVisits)} />
        <Tile label="Follows" value={fmt(t?.follows)} />
        <Tile label="Web Clicks" value={fmt(t?.webClicks)} />
        <Tile label="Jumlah Post" value={fmt(t?.posts)} />
      </div>

      {posts.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="p-3">Tanggal</th>
                <th className="p-3">Konten</th>
                <th className="p-3">Format</th>
                <th className="p-3 text-right">Reach</th>
                <th className="p-3 text-right">Likes</th>
                <th className="p-3 text-right">Komentar</th>
                <th className="p-3 text-right">Interaksi</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p: PostMetric, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  <td className="whitespace-nowrap p-3 text-slate-500">{p.date}</td>
                  <td className="max-w-[260px] p-3 text-slate-700">
                    <span className="line-clamp-2">{p.caption || "—"}</span>
                  </td>
                  <td className="whitespace-nowrap p-3 text-slate-500">{p.format}</td>
                  <td className="p-3 text-right">{fmt(p.reach)}</td>
                  <td className="p-3 text-right">{fmt(p.likes)}</td>
                  <td className="p-3 text-right">{fmt(p.comments)}</td>
                  <td className="p-3 text-right font-semibold">{fmt(p.totalInteractions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
