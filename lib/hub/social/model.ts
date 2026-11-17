// Pure rules for the Social Media page: reading Zernio's daily metrics, comparing with the period before, and the rule-based notes.
// Zernio documents /v1/analytics/daily-metrics (dailyData, platformBreakdown, totals). Every number is read defensively and stays 0 when
// it is missing; nothing here invents a figure. No I/O.

import { addDays, diffDays, isIsoDate } from "../tasks/dates";

export const SOCIAL_MAX_DAYS = 366; // Zernio's limit for one analytics window

export type Metrics = { impressions: number; reach: number; likes: number; comments: number; shares: number; saves: number; clicks: number; views: number };
export type Day = { date: string; postCount: number; metrics: Metrics };
export type PlatformRow = Metrics & { platform: string; postCount: number };
export type Daily = { days: Day[]; platforms: PlatformRow[]; totals: Metrics & { postCount: number } };

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const n = (v: unknown): number => {
  const x = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(x) && x > 0 ? x : 0;
};
const KEYS = ["impressions", "reach", "likes", "comments", "shares", "saves", "clicks", "views"] as const;
const metricsOf = (raw: unknown): Metrics => {
  const o = isRec(raw) ? raw : {};
  return { impressions: n(o.impressions), reach: n(o.reach), likes: n(o.likes), comments: n(o.comments), shares: n(o.shares), saves: n(o.saves), clicks: n(o.clicks), views: n(o.views) };
};
export const zero = (): Metrics => ({ impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, views: 0 });
const add = (a: Metrics, b: Metrics): Metrics => {
  const out = zero();
  for (const k of KEYS) out[k] = a[k] + b[k];
  return out;
};

/** Likes, comments, shares and saves together: Zernio's own definition of engagement. */
export const engagement = (m: Metrics) => m.likes + m.comments + m.shares + m.saves;

/** Engagement as a share of impressions, or of reach, or of views when the platform gives no impressions. null when there is nothing to divide by. */
export function engagementRate(m: Metrics): number | null {
  const base = m.impressions || m.reach || m.views;
  return base > 0 ? (engagement(m) / base) * 100 : null;
}

const DATE = /^\d{4}-\d{2}-\d{2}/;

export function parseDaily(raw: unknown): Daily | null {
  if (!isRec(raw)) return null;
  const days: Day[] = [];
  for (const d of Array.isArray(raw.dailyData) ? raw.dailyData : []) {
    if (!isRec(d) || typeof d.date !== "string" || !DATE.test(d.date)) continue;
    days.push({ date: d.date.slice(0, 10), postCount: Math.round(n(d.postCount)), metrics: metricsOf(d.metrics) });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  const platforms: PlatformRow[] = [];
  for (const p of Array.isArray(raw.platformBreakdown) ? raw.platformBreakdown : []) {
    if (!isRec(p) || typeof p.platform !== "string" || !p.platform.trim()) continue;
    platforms.push({ platform: p.platform.trim().toLowerCase(), postCount: Math.round(n(p.postCount)), ...metricsOf(p) });
  }
  platforms.sort((a, b) => engagement(b) - engagement(a));
  // The totals Zernio sends win; when they are missing they are summed from the days.
  const t = isRec(raw.totals) ? raw.totals : null;
  const summed = days.reduce((s, d) => add(s, d.metrics), zero());
  const totals = t ? { ...metricsOf(t), postCount: Math.round(n(t.postCount)) } : { ...summed, postCount: days.reduce((s, d) => s + d.postCount, 0) };
  return { days, platforms, totals };
}

// ---------------------------------------------------------------------------------------------- ranges
export type Window = { from: string; to: string };

/** A window never longer than Zernio allows: the end stays, the start moves up. */
export function clampWindow(w: Window): Window {
  return diffDays(w.to, w.from) + 1 > SOCIAL_MAX_DAYS ? { from: addDays(w.to, -(SOCIAL_MAX_DAYS - 1)), to: w.to } : w;
}

/** The window of the same length that ends the day before this one starts. */
export function previousWindow(w: Window): Window {
  const len = diffDays(w.to, w.from) + 1;
  return { from: addDays(w.from, -len), to: addDays(w.from, -1) };
}

/** Percent change from `prev` to `cur`; null when there is nothing before to compare with. */
export function change(cur: number, prev: number): number | null {
  if (!(prev > 0)) return null;
  return ((cur - prev) / prev) * 100;
}

/** Every day of the window, with zeros for days Zernio sent nothing for, so a chart has no holes. */
export function fillDays(days: readonly Day[], w: Window): Day[] {
  const by = new Map(days.map((d) => [d.date, d]));
  const out: Day[] = [];
  for (let d = w.from, i = 0; d <= w.to && i < SOCIAL_MAX_DAYS + 1; d = addDays(d, 1), i++) out.push(by.get(d) ?? { date: d, postCount: 0, metrics: zero() });
  return out;
}

export const validWindow = (from: unknown, to: unknown): boolean => isIsoDate(from) && isIsoDate(to) && from <= to;

// ---------------------------------------------------------------------------------------------- notes
export type Note = { id: string; tone: "ok" | "warn" | "info"; title: string; why: string };

const WEEKDAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const weekday = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
const fmtPct = (x: number) => `${Math.abs(x).toLocaleString("en-US", { maximumFractionDigits: 0 })}%`;

/**
 * Plain observations from the numbers, each with the reason. At most five. They never claim a cause: they say what the data shows and
 * what is worth trying.
 */
export function notes(cur: Daily, prev: Daily | null, w: Window, platformLabel: (p: string) => string): Note[] {
  const out: Note[] = [];
  const posts = cur.totals.postCount;
  const filled = fillDays(cur.days, w);

  if (posts === 0) {
    out.push({ id: "quiet", tone: "warn", title: "Nothing was posted in these days", why: "Zernio shows no published posts here. Pick a longer range, or check that the accounts are connected in Zernio." });
    return out;
  }

  const e = engagement(cur.totals);
  const ePrev = prev ? engagement(prev.totals) : 0;
  const move = prev ? change(e, ePrev) : null;
  if (move !== null && Math.abs(move) >= 20) {
    out.push(
      move > 0
        ? { id: "up", tone: "ok", title: `Engagement is up ${fmtPct(move)} on the days before`, why: `${e.toLocaleString("en-US")} likes, comments, shares and saves, against ${ePrev.toLocaleString("en-US")}. Look at the top posts below and make more like them.` }
        : { id: "down", tone: "warn", title: `Engagement is down ${fmtPct(move)} on the days before`, why: `${e.toLocaleString("en-US")} against ${ePrev.toLocaleString("en-US")}. Check whether you posted less, or whether one platform dropped (see the table).` },
    );
  }

  const rated = cur.platforms.filter((p) => p.postCount >= 3);
  if (rated.length >= 2) {
    const per = (p: PlatformRow) => engagement(p) / p.postCount;
    const best = [...rated].sort((a, b) => per(b) - per(a));
    const top = best[0];
    const low = best[best.length - 1];
    if (per(top) >= per(low) * 2 && per(top) >= 1) out.push({ id: "platform", tone: "info", title: `${platformLabel(top.platform)} earns the most per post`, why: `About ${Math.round(per(top)).toLocaleString("en-US")} interactions a post, against ${Math.round(per(low)).toLocaleString("en-US")} on ${platformLabel(low.platform)}. Worth giving it more of the effort.` });
  }

  // Longest stretch with no post, when the range is long enough for that to mean something.
  if (filled.length >= 14) {
    let run = 0;
    let best = 0;
    for (const d of filled) {
      run = d.postCount === 0 ? run + 1 : 0;
      best = Math.max(best, run);
    }
    if (best >= 7) out.push({ id: "gap", tone: "warn", title: `A gap of ${best} days with no post`, why: "Long gaps usually cost reach. A steady rhythm, even a small one, tends to beat bursts." });
  }

  // Which weekday gets the most per post, when there are enough weeks to say so.
  if (filled.length >= 28) {
    const sum = Array.from({ length: 7 }, () => ({ e: 0, p: 0 }));
    for (const d of filled) {
      const s = sum[weekday(d.date)];
      s.e += engagement(d.metrics);
      s.p += d.postCount;
    }
    const ranked = sum.map((s, i) => ({ i, per: s.p >= 3 ? s.e / s.p : -1 })).filter((x) => x.per >= 0).sort((a, b) => b.per - a.per);
    if (ranked.length >= 3 && ranked[0].per > 0 && ranked[0].per >= ranked[ranked.length - 1].per * 1.5)
      out.push({ id: "weekday", tone: "info", title: `${WEEKDAY[ranked[0].i]} posts do best`, why: `They average ${Math.round(ranked[0].per).toLocaleString("en-US")} interactions, against ${Math.round(ranked[ranked.length - 1].per).toLocaleString("en-US")} on ${WEEKDAY[ranked[ranked.length - 1].i]}. A small sample, so test it before changing the plan.` });
  }

  if (e === 0) out.push({ id: "zero", tone: "warn", title: "Posts went out but nothing came back", why: "No likes, comments, shares or saves are recorded. Zernio may still be syncing these accounts, or the platform does not share these numbers." });
  return out.slice(0, 5);
}
