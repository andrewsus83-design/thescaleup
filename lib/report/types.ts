// Shared types for the multi-client Report platform (report.thescaleup.xyz).

export type ReportClient = {
  id: string;
  slug: string;
  name: string;
  igHandle: string | null;
  logoUrl: string | null;
  brandColor: string;
  accentColor: string;
  theme: string;
  connectToken: string | null;
  status: string; // pending | connected | active | paused
  notes: string | null;
  createdAt: string;
  /** Provider keys that have a stored value for this client (presence only, never the secret). */
  configuredProviders?: string[];
};

/** One post's metrics, normalized across providers (Zernio → this shape). */
export type PostMetric = {
  date: string;
  caption: string;
  format: string; // Image | Carousel | Reels / Video
  reach?: number | null;
  impressions?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saved?: number | null;
  profileVisits?: number | null;
  follows?: number | null;
  webClicks?: number | null;
  views?: number | null;
  totalInteractions?: number | null;
  url?: string | null;
};

export type MetricTotals = {
  posts: number;
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saved: number | null;
  profileVisits: number | null;
  follows: number | null;
  webClicks: number | null;
  totalInteractions: number | null;
  erReach: number | null; // total interactions / reach
};

/** Normalized report payload — what a connected provider returns, or a not-connected state. */
export type ReportMetrics = {
  connected: boolean;
  reason?: string; // why not connected (shown to admin, never fabricated data)
  provider: string;
  period?: string;
  account?: { username?: string | null; followers?: number | null };
  posts: PostMetric[];
  totals?: MetricTotals | null;
  fetchedAt?: string;
};

export type ReportSnapshot = {
  id: string;
  clientId: string;
  period: string;
  data: ReportMetrics;
  source: string;
  createdAt: string;
};

export const CLIENT_STATUSES: Record<string, { label: string; badge: string }> = {
  pending: { label: "Belum konek", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  connected: { label: "Terkoneksi", badge: "bg-sky-100 text-sky-700 border-sky-200" },
  active: { label: "Aktif", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  paused: { label: "Dijeda", badge: "bg-slate-100 text-slate-600 border-slate-200" },
};
