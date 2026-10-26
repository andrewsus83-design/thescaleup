import type { ReportMetrics, MetricTotals, PostMetric, SeriesPoint } from "@/lib/report/types";

function sumNull(vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter((v): v is number => typeof v === "number");
  return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
}

function mergeSeries(list: (SeriesPoint[] | null | undefined)[]): SeriesPoint[] | null {
  const byDate = new Map<string, number>();
  let any = false;
  for (const s of list) {
    if (!s) continue;
    any = true;
    for (const p of s) byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.value);
  }
  if (!any) return null;
  return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, value }));
}

function mergeDim(list: ({ [k: string]: unknown }[] | null | undefined)[], keyField: string, valField: string) {
  const byKey = new Map<string, number>();
  let any = false;
  for (const arr of list) {
    if (!arr) continue;
    any = true;
    for (const x of arr) {
      const k = String(x[keyField]);
      byKey.set(k, (byKey.get(k) ?? 0) + (Number(x[valField]) || 0));
    }
  }
  return any ? [...byKey.entries()].map(([k, v]) => ({ [keyField]: k, [valField]: v })) : null;
}

/** Combine several per-account snapshots into one aggregated report. */
export function aggregateMetrics(list: ReportMetrics[], label: string): ReportMetrics {
  const connected = list.filter((m) => m.connected);
  if (connected.length === 0) {
    return { connected: false, provider: "zernio", posts: [], reason: "Tidak ada akun terpilih yang punya data." };
  }
  const T = connected.map((m) => m.totals).filter(Boolean) as MetricTotals[];
  const reach = sumNull(T.map((t) => t.reach));
  const ti = sumNull(T.map((t) => t.totalInteractions));
  const totals: MetricTotals = {
    posts: T.reduce((a, t) => a + (t.posts ?? 0), 0),
    reach,
    impressions: sumNull(T.map((t) => t.impressions)),
    likes: sumNull(T.map((t) => t.likes)),
    comments: sumNull(T.map((t) => t.comments)),
    shares: sumNull(T.map((t) => t.shares)),
    saved: sumNull(T.map((t) => t.saved)),
    profileVisits: sumNull(T.map((t) => t.profileVisits)),
    follows: sumNull(T.map((t) => t.follows)),
    webClicks: sumNull(T.map((t) => t.webClicks)),
    accountsEngaged: sumNull(T.map((t) => t.accountsEngaged)),
    replies: sumNull(T.map((t) => t.replies)),
    reposts: sumNull(T.map((t) => t.reposts)),
    totalInteractions: ti,
    erReach: reach && ti ? ti / reach : null,
  };

  const posts: PostMetric[] = connected
    .flatMap((m) => m.posts ?? [])
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // Each account shows ITS latest pull, and those pulls can cover different dates; adding them up then compares unlike
  // periods, so say so instead of printing the first account's period as if it were everyone's.
  const periods = [...new Set(connected.map((m) => m.period).filter((p): p is string => !!p))];
  const dataNotes = [
    ...new Set([
      ...connected.flatMap((m) => m.dataNotes ?? []),
      ...(periods.length > 1
        ? [`Periode tiap akun berbeda (${periods.join("; ")}) — angka gabungan menjumlahkan rentang tanggal yang tidak sama. Tarik data semua akun dengan rentang yang sama.`]
        : []),
    ]),
  ];

  const df = sumNull(connected.map((m) => m.discovery?.followers));
  const dn = sumNull(connected.map((m) => m.discovery?.nonFollowers));

  const ct = mergeDim(
    connected.map((m) => m.byContentType as { [k: string]: unknown }[] | null),
    "type",
    "reach",
  );
  const ctI = mergeDim(
    connected.map((m) => (m.byContentType ?? []).map((c) => ({ type: c.type, interactions: c.interactions ?? 0 }))),
    "type",
    "interactions",
  );
  const iMap = new Map((ctI ?? []).map((x) => [String(x.type), Number(x.interactions)]));
  const byContentType = ct
    ? ct.map((c) => ({ type: String(c.type), reach: Number(c.reach), interactions: iMap.get(String(c.type)) ?? null }))
    : null;

  return {
    connected: true,
    provider: "zernio",
    period: periods.length > 1 ? "periode berbeda" : periods[0],
    account: { username: label, followers: sumNull(connected.map((m) => m.account?.followers)) },
    posts,
    totals,
    discovery: df != null || dn != null ? { followers: df, nonFollowers: dn } : null,
    byContentType,
    reachSeries: mergeSeries(connected.map((m) => m.reachSeries)),
    followerSeries: mergeSeries(connected.map((m) => m.followerSeries)),
    followersGained: sumNull(connected.map((m) => m.followersGained)),
    followersLost: sumNull(connected.map((m) => m.followersLost)),
    contactButtons: (mergeDim(connected.map((m) => m.contactButtons as { [k: string]: unknown }[] | null), "type", "value") as
      | { type: string; value: number }[]
      | null),
    ...(dataNotes.length ? { dataNotes } : {}),
    fetchedAt: connected[0]?.fetchedAt,
  };
}
