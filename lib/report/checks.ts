// Data-quality checks — pure, so tests can run them directly. Each check compares numbers
// of the SAME scope (see derive.ts); the one A-vs-P check only runs when the period is
// recent enough for post lifetime figures to be comparable.
//
// These are internal QA for admins (the dashboard shows them behind `showChecks`); they are
// deliberately NOT written to the Excel, which is a client deliverable.

import type { ReportMetrics } from "@/lib/report/types";
import type { Scope } from "@/lib/report/metric-info";
import { postHasData } from "@/lib/report/derive";

export type CheckStatus = "pass" | "warn" | "fail" | "skip";
/** `scope` is null for a caveat about the data as a whole (see ReportMetrics.dataNotes), which belongs to no single scope. */
export type DataCheck = { id: string; scope: Scope | null; label: string; status: CheckStatus; detail: string };

const n = (v: number) => v.toLocaleString("id-ID");
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** End date of the report period, read from "YYYY-MM-DD → YYYY-MM-DD". */
function periodEnd(period?: string): number | null {
  const found = period?.match(/\d{4}-\d{2}-\d{2}/g);
  const last = found?.[found.length - 1];
  const t = last ? Date.parse(last) : NaN;
  return Number.isFinite(t) ? t : null;
}

export const MIN_POSTS = 5; // below this, per-post averages and rates are too noisy to read

export function runChecks(m: ReportMetrics): DataCheck[] {
  const t = m.totals;
  const posts = m.posts ?? [];
  const ig = (m.platform ?? "instagram") === "instagram";
  const out: DataCheck[] = [];
  const add = (id: string, scope: Scope | null, label: string, status: CheckStatus, detail: string) =>
    out.push({ id, scope, label, status, detail });

  // 0 · what the pipeline itself knows is off with this pull (a repaired old snapshot, a post list that failed to load,
  //     mixed periods). Admin-only like every check here: clients get the numbers, not the housekeeping.
  (m.dataNotes ?? []).forEach((text, i) => add(`data_note_${i}`, null, "Catatan data", "warn", text));

  // 1 · A — the account total must cover its own components
  {
    const label = "Total Interaksi mencakup rinciannya";
    if (ig && t && isNum(t.totalInteractions) && isNum(t.likes) && isNum(t.comments) && isNum(t.saved) && isNum(t.shares)) {
      const parts = t.likes + t.comments + t.saved + t.shares;
      if (t.totalInteractions >= parts) add("interactions_add_up", "A", label, "pass", `${n(t.totalInteractions)} ≥ like + komentar + simpan + share (${n(parts)}).`);
      else add("interactions_add_up", "A", label, "fail", `Total Interaksi (${n(t.totalInteractions)}) lebih kecil dari like + komentar + simpan + share (${n(parts)}) — tidak mungkin; cek sumber data.`);
    } else add("interactions_add_up", "A", label, "skip", "Total interaksi atau rinciannya tidak tersedia.");
  }

  // 2 · A — nobody can engage without being reached
  {
    const label = "Accounts Engaged tidak melebihi Reach";
    if (ig && t && isNum(t.accountsEngaged) && isNum(t.reach)) {
      if (t.accountsEngaged <= t.reach) add("engaged_le_reach", "A", label, "pass", `${n(t.accountsEngaged)} akun berinteraksi dari ${n(t.reach)} akun terjangkau.`);
      else add("engaged_le_reach", "A", label, "warn", `Accounts Engaged (${n(t.accountsEngaged)}) lebih besar dari Reach (${n(t.reach)}) — periksa rentang tanggal.`);
    } else add("engaged_le_reach", "A", label, "skip", "Accounts Engaged atau Reach tidak tersedia.");
  }

  // 3 · A — follower + non-follower reach should add up to total reach
  {
    const label = "Reach follower + non-follower = Reach";
    const d = m.discovery;
    if (ig && t && isNum(t.reach) && t.reach > 0 && d && (isNum(d.followers) || isNum(d.nonFollowers))) {
      const sum = (d.followers ?? 0) + (d.nonFollowers ?? 0);
      const gap = Math.abs(sum - t.reach) / t.reach;
      if (gap <= 0.15) add("discovery_sums", "A", label, "pass", `${n(sum)} dari ${n(t.reach)} (selisih ${(gap * 100).toFixed(0)}%).`);
      else add("discovery_sums", "A", label, "warn", `Jumlah ${n(sum)} berbeda ${(gap * 100).toFixed(0)}% dari Reach ${n(t.reach)} (batas 15%).`);
    } else add("discovery_sums", "A", label, "skip", "Rincian follower vs non-follower tidak tersedia.");
  }

  // 4 · A — daily unique reach can only add up to MORE than the period's unique reach
  {
    const label = "Reach harian konsisten dengan Reach periode";
    const series = m.reachSeries;
    if (ig && t && isNum(t.reach) && series && series.length > 1) {
      const sum = series.reduce((s, p) => s + p.value, 0);
      if (sum >= t.reach * 0.95) add("reach_series_sum", "A", label, "pass", `Jumlah reach harian ${n(sum)} ≥ reach periode ${n(t.reach)}.`);
      else add("reach_series_sum", "A", label, "warn", `Jumlah reach harian (${n(sum)}) lebih kecil dari reach periode (${n(t.reach)}) — rentang data tidak sama.`);
    } else add("reach_series_sum", "A", label, "skip", "Deret reach harian tidak tersedia.");
  }

  // 5 · P — a post cannot be seen by more accounts than it has views
  {
    const label = "Impressions ≥ reach di tiap post";
    const both = posts.filter((p) => (p.impressions ?? 0) > 0 && (p.reach ?? 0) > 0);
    if (both.length) {
      const bad = both.filter((p) => (p.impressions as number) < (p.reach as number));
      if (!bad.length) add("post_views_ge_reach", "P", label, "pass", `Berlaku di semua ${both.length} post yang punya keduanya.`);
      else add("post_views_ge_reach", "P", label, "fail", `${bad.length} dari ${both.length} post punya impressions lebih kecil dari reach (mis. ${bad[0].date}) — kemungkinan salah petakan metrik.`);
    } else add("post_views_ge_reach", "P", label, "skip", "Belum ada post dengan impressions dan reach sekaligus.");
  }

  // 6 · P — fresh posts have no insights yet
  const withData = posts.filter(postHasData);
  {
    const label = "Semua post sudah punya data";
    if (posts.length) {
      const missing = posts.length - withData.length;
      if (!missing) add("posts_have_data", "P", label, "pass", `${posts.length} dari ${posts.length} post punya data insight.`);
      else add("posts_have_data", "P", label, "warn", `${missing} dari ${posts.length} post belum punya data (terlalu baru atau belum disinkron) — tidak ikut dihitung di rata-rata.`);
    } else add("posts_have_data", "P", label, "skip", "Tidak ada post di periode ini.");
  }

  // 7 · P — averages from a handful of posts are noise
  {
    const label = `Sampel cukup (≥ ${MIN_POSTS} post)`;
    if (posts.length) {
      if (withData.length >= MIN_POSTS) add("sample_size", "P", label, "pass", `${withData.length} post dipakai untuk rata-rata dan rate.`);
      else add("sample_size", "P", label, "warn", `Hanya ${withData.length} post yang dipakai — rata-rata dan rate belum stabil.`);
    } else add("sample_size", "P", label, "skip", "Tidak ada post di periode ini.");
  }

  // 8 · A vs P — post reach is lifetime-to-date, account reach is the period only, so they are
  //     only comparable while the period is recent.
  {
    const label = "Reach post terbesar ≤ Reach akun";
    const end = periodEnd(m.period);
    const fetched = m.fetchedAt ? Date.parse(m.fetchedAt) : NaN;
    const top = withData.reduce((mx, p) => Math.max(mx, p.reach ?? 0), 0);
    if (!ig || !t || !isNum(t.reach) || !top) add("reach_vs_posts", "A", label, "skip", "Tidak ada reach akun atau reach post untuk dibandingkan.");
    else if (end == null || !Number.isFinite(fetched) || fetched - end > 14 * 864e5) {
      add("reach_vs_posts", "A", label, "skip", "Periode sudah lewat lebih dari 14 hari — reach post terus bertambah sehingga tidak sebanding.");
    } else if (top <= t.reach) add("reach_vs_posts", "A", label, "pass", `Reach post terbesar ${n(top)} ≤ reach akun ${n(t.reach)}.`);
    else add("reach_vs_posts", "A", label, "warn", `Reach post terbesar (${n(top)}) melebihi reach akun (${n(t.reach)}) — periksa rentang tanggal.`);
  }

  // 9 · A — period-over-period needs the previous window
  {
    const label = "Data periode sebelumnya tersedia";
    if (m.comparison) add("comparison_available", "A", label, "pass", "Perubahan % dibandingkan periode sepanjang yang sama sebelumnya.");
    else add("comparison_available", "A", label, "skip", "Periode sebelumnya tidak tersedia — badge perubahan % tidak ditampilkan.");
  }

  return out;
}

/** Roll-up for a one-line banner. Skipped checks never count against the data. */
export function summarizeChecks(checks: DataCheck[]) {
  const c = { pass: 0, warn: 0, fail: 0, skip: 0 };
  for (const x of checks) c[x.status]++;
  const level: "fail" | "warn" | "pass" | "none" = c.fail ? "fail" : c.warn ? "warn" : c.pass ? "pass" : "none";
  return { ...c, level };
}
