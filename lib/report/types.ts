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
  postedAt?: string | null; // full publish timestamp (for best day/time analysis)
  caption: string;
  format: string; // Image | Carousel | Reels / Video | Post | Story
  pillar?: string | null; // editorial content pillar (AI-suggested, override-able)
  followersAtPeriod?: number | null; // running follower count at the post's date
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
  engagementRate?: number | null; // percent (e.g. 3.4)
  avgWatchTime?: number | null; // ms
  completionRate?: number | null; // fraction 0..1
  skipRate?: number | null; // fraction 0..1
  url?: string | null;
};

/** Aggregate video/Reels performance. */
export type ReelsSummary = {
  count: number;
  totalViews: number | null;
  avgWatchTimeSec: number | null;
  avgCompletion: number | null; // fraction 0..1
};

/** One story with its insights. */
export type StoryItem = {
  date: string;
  mediaType: string;
  views: number | null;
  reach: number | null;
  replies: number | null;
  exits: number | null;
  tapsForward: number | null;
  tapsBack: number | null;
  profileVisits: number | null;
  follows: number | null;
};
export type StoriesSummary = {
  count: number;
  views: number | null;
  reach: number | null;
  replies: number | null;
  exits: number | null;
  tapsForward: number | null;
  tapsBack: number | null;
  profileVisits: number | null;
  follows: number | null;
  items: StoryItem[];
};

/** Previous equal-length window, for period-over-period deltas. */
export type PeriodComparison = {
  reach: number | null;
  totalInteractions: number | null;
  erReach: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
};

/** Reach split by whether it came from followers vs discovery (non-followers). */
export type DiscoverySplit = { followers: number | null; nonFollowers: number | null };
/** One content-type's reach + interactions (POST/STORY/REEL/CAROUSEL). */
export type ContentTypeStat = { type: string; reach: number | null; interactions: number | null };
/** One day's value in a time series. */
export type SeriesPoint = { date: string; value: number };

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
  accountsEngaged: number | null;
  replies: number | null;
  reposts: number | null;
  totalInteractions: number | null;
  erReach: number | null; // total interactions / reach
};

/** Audience demographic breakdown (top values), when Zernio exposes it. */
export type Demographics = {
  cities?: { name: string; value: number }[];
  countries?: { name: string; value: number }[];
  ages?: { name: string; value: number }[];
  genders?: { name: string; value: number }[];
};

/** Normalized report payload — what a connected provider returns, or a not-connected state. */
export type ReportMetrics = {
  connected: boolean;
  reason?: string; // why not connected (shown to admin, never fabricated data)
  provider: string;
  period?: string;
  account?: { id?: string | null; username?: string | null; followers?: number | null; platform?: string | null };
  posts: PostMetric[];
  totals?: MetricTotals | null;
  // Professional-dashboard extras (all optional; present when Zernio returns them):
  discovery?: DiscoverySplit | null; // reach followers vs non-followers
  byContentType?: ContentTypeStat[] | null; // reach/interactions per POST/STORY/REEL/CAROUSEL
  reachSeries?: SeriesPoint[] | null; // daily reach
  followerSeries?: SeriesPoint[] | null; // daily follower count
  followersGained?: number | null;
  followersLost?: number | null;
  contactButtons?: { type: string; value: number }[] | null; // profile-tap breakdown
  demographics?: Demographics | null; // follower audience breakdown
  engagedDemographics?: Demographics | null; // engaged-audience breakdown
  reels?: ReelsSummary | null; // video/Reels performance
  stories?: StoriesSummary | null; // Instagram Stories insights
  comparison?: PeriodComparison | null; // previous equal-length window (period-over-period)
  platform?: string; // instagram | tiktok
  aiAnalysis?: { label: string; type: string; text: string }[] | null; // Claude Opus custom analysis
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

/** A configurable report rule/formula (e.g. "Juara 1 if reach naik ≥ 25%"). */
export type ReportRule = {
  id: string;
  label: string; // e.g. "Juara 1"
  metric: string; // reach | impressions | total_interactions | engagement_rate | followers | likes | comments | saves | shares
  direction: "up" | "down"; // naik / turun
  thresholdPct: number; // e.g. 25 → ≥ 25% change over the selected date range
  color?: string; // highlight color (hex)
  note?: string;
};

/** Report/Excel template types. Default = the uploaded "Post Master - IG" (Cap Gajah). */
export const REPORT_TEMPLATE_TYPES: { value: string; label: string; desc: string }[] = [
  { value: "post_master", label: "Post Master - IG (Cap Gajah)", desc: "Format bawaan: header Engagement/Actions/Impressions/Reach + JUARA. Default." },
  { value: "uploaded", label: "Template Upload", desc: "Pakai file .xlsx yang Anda upload sebagai template report." },
  { value: "ringkas", label: "Ringkas / Summary", desc: "Satu halaman ringkasan metrik + top post." },
];
export const DEFAULT_TEMPLATE_TYPE = "post_master";

/** A custom AI parameter — Claude Opus analyzes the report data against this. */
export type ReportCustomParam = {
  id: string;
  label: string; // e.g. "Analisa Kompetitor", "Rekomendasi Konten"
  type: string; // analisa | rekomendasi | ringkasan | prediksi | custom
  prompt: string; // the instruction/question for the AI
};

export const CUSTOM_PARAM_TYPES: { value: string; label: string }[] = [
  { value: "analisa", label: "Analisa" },
  { value: "rekomendasi", label: "Rekomendasi" },
  { value: "ringkasan", label: "Ringkasan" },
  { value: "prediksi", label: "Prediksi" },
  { value: "custom", label: "Custom" },
];

export const RULE_METRICS: { value: string; label: string }[] = [
  { value: "reach", label: "Reach" },
  { value: "impressions", label: "Impressions" },
  { value: "total_interactions", label: "Total Interaksi" },
  { value: "engagement_rate", label: "Engagement Rate" },
  { value: "followers", label: "Followers" },
  { value: "likes", label: "Likes" },
  { value: "comments", label: "Komentar" },
  { value: "saves", label: "Saved" },
  { value: "shares", label: "Shares" },
];

export const CLIENT_STATUSES: Record<string, { label: string; badge: string }> = {
  pending: { label: "Belum konek", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  connected: { label: "Terkoneksi", badge: "bg-sky-100 text-sky-700 border-sky-200" },
  active: { label: "Aktif", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  paused: { label: "Dijeda", badge: "bg-slate-100 text-slate-600 border-slate-200" },
};
