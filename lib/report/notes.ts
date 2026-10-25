// Rule-based notes — plain-language explanations of the numbers, generated from fixed rules
// (never AI), so the same data always yields the same sentences. Pure; shared by the dashboard
// and the Excel so both say the same thing.

import type { ReportMetrics } from "@/lib/report/types";
import { computeDeltas, postHasData } from "@/lib/report/derive";
import { MIN_POSTS } from "@/lib/report/checks";

export type AutoNote = { id: string; tone: "good" | "info" | "warn"; text: string };

const MIN_ER_MOVE = 0.05; // ignore ER changes smaller than 5% (relative) — that is noise
const CONCENTRATION = 0.5; // one post carrying ≥ 50% of post reach
const DISCOVERY_HIGH = 0.5; // non-follower share of reach
const DISCOVERY_LOW = 0.2;

const signed = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(0)}%`;
const share = (x: number) => `${(x * 100).toFixed(0)}%`;

export function autoNotes(m: ReportMetrics): AutoNote[] {
  const notes: AutoNote[] = [];
  const posts = m.posts ?? [];
  const ig = (m.platform ?? "instagram") === "instagram";

  // 1 · why ER moved — the cause is in reach vs interactions, not in "better content"
  const d = computeDeltas(m.totals, m.comparison);
  if (d && d.erReach != null && d.reach != null && d.totalInteractions != null && Math.abs(d.erReach) >= MIN_ER_MOVE) {
    const [e, r, i] = [d.erReach, d.reach, d.totalInteractions];
    if (e > 0 && r < 0) {
      notes.push({ id: "er_cause", tone: "warn", text: `ER naik ${signed(e)}, tapi terutama karena reach turun (${signed(r)}) — interaksi ${signed(i)}. Audiens yang terjangkau lebih sedikit; belum tentu kontennya lebih baik.` });
    } else if (e > 0) {
      notes.push({ id: "er_cause", tone: "good", text: `ER naik ${signed(e)}: interaksi (${signed(i)}) tumbuh lebih cepat dari reach (${signed(r)}).` });
    } else if (r > 0) {
      notes.push({ id: "er_cause", tone: "info", text: `ER turun ${signed(e)} karena reach naik ${signed(r)} lebih cepat dari interaksi (${signed(i)}) — jangkauan lebih luas, interaksi belum mengikuti.` });
    } else {
      notes.push({ id: "er_cause", tone: "warn", text: `ER turun ${signed(e)}: interaksi turun (${signed(i)}) lebih dalam dari reach (${signed(r)}).` });
    }
  }

  // 2 · posts that have no insights yet are left out of every per-post average
  const withData = posts.filter(postHasData);
  const missing = posts.length - withData.length;
  if (posts.length && missing > 0) {
    notes.push({ id: "posts_pending", tone: "info", text: `${missing} dari ${posts.length} post belum punya data reach/impressions (terlalu baru atau belum disinkron) — tidak ikut dihitung di rata-rata.` });
  }

  // 3 · tiny samples
  if (withData.length > 0 && withData.length < MIN_POSTS) {
    notes.push({ id: "small_sample", tone: "warn", text: `Rata-rata dan rate per post dihitung dari ${withData.length} post saja — jangan disimpulkan dulu (minimal ${MIN_POSTS} post).` });
  }

  // 4 · one post carrying the period
  const reaches = withData.map((p) => ({ p, r: p.reach ?? 0 })).filter((x) => x.r > 0);
  if (reaches.length >= 3) {
    const total = reaches.reduce((s, x) => s + x.r, 0);
    const top = reaches.reduce((a, b) => (b.r > a.r ? b : a));
    if (top.r / total >= CONCENTRATION) {
      notes.push({ id: "concentration", tone: "info", text: `1 post (${top.p.date}) menyumbang ${share(top.r / total)} dari total reach post — hasil periode ini bergantung pada satu konten.` });
    }
  }

  // 5 · where the reach came from (account scope)
  const disc = m.discovery;
  const discTotal = (disc?.followers ?? 0) + (disc?.nonFollowers ?? 0);
  if (ig && disc && disc.nonFollowers != null && discTotal > 0) {
    const nf = disc.nonFollowers / discTotal;
    if (nf >= DISCOVERY_HIGH) notes.push({ id: "discovery", tone: "good", text: `${share(nf)} reach datang dari non-follower — konten menyebar ke luar audiens Anda.` });
    else if (nf <= DISCOVERY_LOW) notes.push({ id: "discovery", tone: "info", text: `Hanya ${share(nf)} reach dari non-follower — penambahan audiens baru masih rendah.` });
  }

  // 6 · followers going down
  if (m.followersGained != null && m.followersLost != null) {
    const net = m.followersGained - m.followersLost;
    if (net < 0) notes.push({ id: "net_followers", tone: "warn", text: `Follower turun bersih ${Math.abs(net).toLocaleString("id-ID")} di periode ini (+${m.followersGained.toLocaleString("id-ID")} / −${m.followersLost.toLocaleString("id-ID")}).` });
  }

  return notes;
}
