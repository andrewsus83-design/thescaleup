import "server-only";
import ExcelJS from "exceljs";
import type { ReportClient, ReportMetrics, ReportRule, PostMetric } from "@/lib/report/types";
import { efficiency, computeDeltas, qualityScore, bestDayTime, reelRows, overlapRows, totalInteraction } from "@/lib/report/derive";

function argb(hex: string) {
  return "FF" + hex.replace("#", "").toUpperCase().padStart(6, "0").slice(0, 6);
}
const fill = (hex: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: argb(hex) } });
const num = (v: number | null | undefined) => (v == null ? null : v);
const thin = { style: "thin" as const, color: { argb: "FFD9D9D9" } };

// Cap Gajah "Post Master - IG" palette
const C = { PINK: "EAD1DC", ENG: "EA9999", ACT: "FCE5CD", IMP: "CFE2F3", REACH: "B6D7A8", PURPLE: "9900FF", CREAM: "FFF2CC" };

/** Build the report Excel from Zernio metrics. Default type = Post Master (Cap Gajah). */
export async function buildReportWorkbook(
  client: ReportClient,
  metrics: ReportMetrics,
  rules: ReportRule[],
  templateType = "post_master",
  templateFileB64: string | null = null,
): Promise<Buffer> {
  // "uploaded" type → write the data into the user's own .xlsx template
  if (templateType === "uploaded" && templateFileB64) {
    const filled = await fillUploadedTemplate(templateFileB64, metrics);
    if (filled) {
      buildSummary(filled, client, metrics, rules);
      buildInsights(filled, metrics);
      return Buffer.from(await filled.xlsx.writeBuffer());
    }
    // mapping failed → fall through to the generated format
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "ScaleUp Reports";
  const brand = client.brandColor || "#2A2870";
  if (templateType !== "ringkas") buildPostMaster(wb, client, metrics, rules, brand);
  buildSummary(wb, client, metrics, rules);
  buildInsights(wb, metrics);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Fill the user's uploaded .xlsx into the raw data columns. Handles multi-row
 *  merged headers (e.g. Cap Gajah's 3-row header) by combining the header band
 *  per column and detecting the data start from the date column. Formula columns
 *  (ER, Total Interaction) are left untouched so Excel recomputes them. */
async function fillUploadedTemplate(base64: string, metrics: ReportMetrics): Promise<ExcelJS.Workbook | null> {
  try {
    const wb = new ExcelJS.Workbook();
    const bin = Buffer.from(base64, "base64");
    const ab = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer;
    await wb.xlsx.load(ab);
    const ws = wb.worksheets[0];
    if (!ws) return null;

    // field → header keywords (raw data only; formula cols like ER are left alone)
    const KW: Record<string, string[]> = {
      date: ["date", "tanggal"],
      caption: ["content", "konten", "caption", "judul"],
      pillar: ["pillar", "pilar"],
      followersAtPeriod: ["followers on", "followers this period", "follower period", "followers pada"],
      likes: ["likes", "suka"],
      comments: ["comment", "komentar"],
      follows: ["follows", "follow"],
      profileVisits: ["profile visit", "kunjungan profil"],
      shares: ["shared", "share"],
      saved: ["saved", "save", "simpan"],
      webClicks: ["web click", "website click", "link click", "klik web"],
      others: ["others", "lainnya"],
      impressions: ["impression", "impresi"],
      reach: ["reach", "jangkauan"],
      views: ["views", "tayangan"],
    };
    const cellText = (v: ExcelJS.CellValue): string => {
      if (v == null) return "";
      if (typeof v === "object") {
        const o = v as { richText?: { text: string }[]; text?: string; result?: unknown };
        if (o.richText) return o.richText.map((t) => t.text).join("");
        if (o.text) return o.text;
        return "";
      }
      return String(v);
    };
    const matchField = (txt: string, used: Set<string>): string | null => {
      const t = txt.toLowerCase().trim();
      if (!t) return null;
      for (const [field, kws] of Object.entries(KW)) {
        if (used.has(field)) continue;
        if (kws.some((k) => t === k || t.includes(k))) {
          if (field === "follows" && t.includes("follower")) continue; // not "followers"
          return field;
        }
      }
      return null;
    };

    // find the first data row (col 1 is a date) → header band is everything above it
    const isDate = (v: ExcelJS.CellValue) =>
      v instanceof Date || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v.trim()));
    let dataStart = 0;
    for (let r = 2; r <= 40; r++) {
      if (isDate(ws.getRow(r).getCell(1).value)) { dataStart = r; break; }
    }

    const colMap: Record<number, string> = {};
    if (dataStart > 1) {
      // combine header-band text per column (handles merged/multi-row headers)
      const used = new Set<string>();
      const cols = Math.max(ws.columnCount, 20);
      for (let col = 1; col <= cols; col++) {
        let txt = "";
        for (let r = 1; r < dataStart; r++) txt += " " + cellText(ws.getRow(r).getCell(col).value);
        const field = matchField(txt, used);
        if (field) { colMap[col] = field; used.add(field); }
      }
    } else {
      // fallback: single header row with the most matches (flat templates)
      let best = 0, headerRow = 0;
      for (let r = 1; r <= 25; r++) {
        const map: Record<number, string> = {};
        const used = new Set<string>();
        let matches = 0;
        ws.getRow(r).eachCell((cell, col) => {
          if (map[col]) return;
          const field = matchField(cellText(cell.value), used);
          if (field) { map[col] = field; used.add(field); matches++; }
        });
        if (matches > best) { best = matches; headerRow = r; Object.assign(colMap, {}); Object.keys(colMap).forEach((k) => delete colMap[Number(k)]); Object.assign(colMap, map); }
      }
      dataStart = headerRow ? headerRow + 1 : 0;
    }
    if (!dataStart || Object.keys(colMap).length < 3) return null; // too weak → caller falls back

    const posts = [...(metrics.posts ?? [])].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    // clear old sample data in mapped columns (bounded)
    for (let r = dataStart; r <= dataStart + 400; r++) {
      const row = ws.getRow(r);
      for (const col of Object.keys(colMap)) row.getCell(Number(col)).value = null;
    }
    // write data
    posts.forEach((p, i) => {
      const row = ws.getRow(dataStart + i);
      for (const [colStr, field] of Object.entries(colMap)) {
        const col = Number(colStr);
        let v: unknown = null;
        if (field === "date") v = p.date;
        else if (field === "caption") v = p.caption;
        else if (field === "pillar") v = p.pillar ?? null;
        else if (field === "others") v = 0;
        else v = (p as unknown as Record<string, number | null>)[field] ?? null;
        row.getCell(col).value = v as ExcelJS.CellValue;
      }
    });
    return wb;
  } catch {
    return null;
  }
}

/** Sheet 1 — "Post Master - IG" (Cap Gajah) full 17-column layout, literal values.
 *  Columns: Date | Content | Pillar | Followers-on-period | Likes | Comments | ER |
 *  Follows | Profile Visits | Shared | Saved | Web Click | Others | Impressions |
 *  Reach | Reach-ER | Total Interaction — grouped by month with a per-month total. */
function buildPostMaster(wb: ExcelJS.Workbook, client: ReportClient, metrics: ReportMetrics, rules: ReportRule[], brand: string) {
  const ws = wb.addWorksheet(`Post Master - ${client.name}`.slice(0, 31));
  const NCOL = 17;
  const widths = [13, 40, 15, 11, 8, 10, 7, 8, 12, 8, 8, 9, 7, 11, 11, 7, 13];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  ws.mergeCells(1, 1, 1, NCOL);
  const t = ws.getCell("A1");
  t.value = `${client.name} — Report ${metrics.platform ?? "Instagram"} · ${metrics.period ?? ""}`;
  t.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  t.fill = fill(brand);
  t.alignment = { vertical: "middle" };
  ws.getRow(1).height = 26;

  // group headers (row 2)
  const groups: [number, number, string, string][] = [
    [1, 4, "Content", C.PINK],
    [5, 7, "Engagement", C.ENG],
    [8, 13, "Actions", C.ACT],
    [14, 14, "Impressions", C.IMP],
    [15, 16, "Reach", C.REACH],
    [17, 17, "Total Interaction", C.PURPLE],
  ];
  for (const [a, b, label, color] of groups) {
    ws.mergeCells(2, a, 2, b);
    const cell = ws.getCell(2, a);
    cell.value = label;
    cell.fill = fill(color);
    cell.font = { bold: true, size: 11, color: { argb: color === C.PURPLE ? "FFFFFFFF" : "FF1A1A1A" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }
  // sub headers (row 3)
  const sub = ["Date", "Content", "Pillar", "Followers on this period", "Likes", "Comments", "ER", "Follows", "Profile Visits", "Shared", "Saved", "Web Click", "Others", "Total", "Total", "ER", "Total"];
  const subFill = ["", "", "", "", C.ENG, C.ENG, C.ENG, C.ACT, C.ACT, C.ACT, C.ACT, C.ACT, C.ACT, C.IMP, C.REACH, C.REACH, ""];
  sub.forEach((h, i) => {
    const cell = ws.getCell(3, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9 };
    if (subFill[i]) cell.fill = fill(subFill[i]);
    cell.alignment = { horizontal: "center", wrapText: true, vertical: "middle" };
    cell.border = { bottom: thin };
  });
  ws.getRow(3).height = 30;

  const N = (v: number | null | undefined) => (v == null ? 0 : v);
  const posts = [...(metrics.posts ?? [])].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const accFollowers = metrics.account?.followers ?? null;
  const tiOf = (p: PostMetric) =>
    N(p.likes) + N(p.comments) + N(p.follows) + N(p.profileVisits) + N(p.shares) + N(p.saved) + N(p.webClicks);
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const intCols = [4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 17];
  const sumCols = [5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 17];
  const colVal = (p: PostMetric, c: number): number => {
    switch (c) {
      case 5: return N(p.likes);
      case 6: return N(p.comments);
      case 8: return N(p.follows);
      case 9: return N(p.profileVisits);
      case 10: return N(p.shares);
      case 11: return N(p.saved);
      case 12: return N(p.webClicks);
      case 13: return 0;
      case 14: return N(p.impressions);
      case 15: return N(p.reach);
      case 17: return tiOf(p);
      default: return 0;
    }
  };

  // group by YYYY-MM
  const byMonth = new Map<string, PostMetric[]>();
  for (const p of posts) {
    const k = (p.date || "").slice(0, 7) || "—";
    (byMonth.get(k) ?? byMonth.set(k, []).get(k)!).push(p);
  }
  const months = [...byMonth.keys()].sort();

  const postRows: { row: number; ti: number }[] = [];
  let r = 4;
  for (const mk of months) {
    const mp = byMonth.get(mk)!;
    for (const p of mp) {
      const ti = tiOf(p);
      const followers = p.followersAtPeriod ?? accFollowers;
      const row = ws.getRow(r);
      row.getCell(1).value = p.date;
      row.getCell(2).value = p.caption;
      row.getCell(3).value = p.pillar ?? null;
      row.getCell(4).value = followers ?? null;
      row.getCell(5).value = N(p.likes);
      row.getCell(6).value = N(p.comments);
      row.getCell(7).value = followers ? ti / followers : null;
      row.getCell(8).value = N(p.follows);
      row.getCell(9).value = N(p.profileVisits);
      row.getCell(10).value = N(p.shares);
      row.getCell(11).value = N(p.saved);
      row.getCell(12).value = N(p.webClicks);
      row.getCell(13).value = 0;
      row.getCell(14).value = p.impressions ?? null;
      row.getCell(15).value = p.reach ?? null;
      row.getCell(16).value = p.reach ? ti / N(p.reach) : null;
      row.getCell(17).value = ti;
      intCols.forEach((c) => { row.getCell(c).numFmt = "#,##0"; row.getCell(c).alignment = { horizontal: "right" }; });
      [7, 16].forEach((c) => (row.getCell(c).numFmt = "0.0%"));
      row.getCell(2).alignment = { wrapText: true, vertical: "top" };
      row.getCell(3).alignment = { horizontal: "center" };
      postRows.push({ row: r, ti });
      r++;
    }
    // per-month total (literal sums)
    const mtr = ws.getRow(r);
    const label = mk === "—" ? "TOTAL" : `${MONTHS[Number(mk.slice(5, 7)) - 1]} ${mk.slice(0, 4)} TOTAL`;
    mtr.getCell(1).value = label;
    for (const c of sumCols) {
      mtr.getCell(c).value = mp.reduce((s, p) => s + colVal(p, c), 0);
      mtr.getCell(c).numFmt = "#,##0";
    }
    for (let c = 1; c <= NCOL; c++) { mtr.getCell(c).fill = fill(C.CREAM); mtr.getCell(c).font = { bold: true }; }
    r++;
  }

  // grand TOTAL + RATA-RATA when the range spans more than one month
  if (posts.length && months.length > 1) {
    const gt = ws.getRow(r++);
    gt.getCell(1).value = "GRAND TOTAL";
    for (const c of sumCols) { gt.getCell(c).value = posts.reduce((s, p) => s + colVal(p, c), 0); gt.getCell(c).numFmt = "#,##0"; }
    const av = ws.getRow(r++);
    av.getCell(1).value = "RATA-RATA";
    for (const c of sumCols) { av.getCell(c).value = Math.round(posts.reduce((s, p) => s + colVal(p, c), 0) / posts.length); av.getCell(c).numFmt = "#,##0"; }
    [gt, av].forEach((row) => { for (let c = 1; c <= NCOL; c++) { row.getCell(c).fill = fill("#EDE7C8"); row.getCell(c).font = { bold: true }; } });
  }

  // JUARA highlight — top posts by total interaction, tinted with rule colors
  if (postRows.length) {
    const ranked = [...postRows].sort((a, b) => b.ti - a.ti);
    const tiers = rules.slice(0, 3);
    ranked.slice(0, Math.max(tiers.length, 3)).forEach((rk, idx) => {
      const color = tiers[idx]?.color ?? ["#6AA84F", "#A4C2F4", "#FFFF00"][idx] ?? "#FFF2CC";
      [2, 17].forEach((c) => (ws.getCell(rk.row, c).fill = fill(color.replace("#", ""))));
    });
  }
  ws.views = [{ state: "frozen", ySplit: 3 }];
}

/** Sheet 3 — "Metrik & Insight": the SAME analytical sections as the dashboard. */
function buildInsights(wb: ExcelJS.Workbook, metrics: ReportMetrics) {
  const ws = wb.addWorksheet("Metrik & Insight");
  ws.columns = [{ width: 30 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }];
  const posts = metrics.posts ?? [];
  const t = metrics.totals;
  const followers = metrics.account?.followers ?? null;
  const pctS = (n: number | null | undefined) => (n == null ? "—" : (n * 100).toFixed(1) + "%");
  const timesS = (n: number | null | undefined) => (n == null ? "—" : n >= 1 ? n.toFixed(1) + "×" : (n * 100).toFixed(1) + "%");
  const deltaS = (n: number | null | undefined) => (n == null ? "—" : (n >= 0 ? "+" : "") + (n * 100).toFixed(0) + "%");

  let row = 1;
  const section = (label: string, color: string) => {
    ws.mergeCells(row, 1, row, 6);
    const c = ws.getCell(row, 1);
    c.value = label;
    c.font = { bold: true, size: 12, color: { argb: "FF1A1A1A" } };
    c.fill = fill(color);
    row++;
  };
  const kv = (label: string, value: string | number | null, bold = true) => {
    ws.getCell(row, 1).value = label;
    const c = ws.getCell(row, 2);
    c.value = (value ?? "—") as ExcelJS.CellValue;
    if (bold) c.font = { bold: true };
    row++;
  };
  const headerRow = (cols: string[]) => {
    cols.forEach((h, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = h;
      c.font = { bold: true, size: 9 };
      c.fill = fill("#EFEFEF");
    });
    row++;
  };

  // 1) Efficiency, funnel & quality
  const eff = efficiency(t, followers, posts.length);
  section("EFISIENSI, FUNNEL & KUALITAS", "#B6D7A8");
  kv("Reach Rate (reach ÷ followers)", timesS(eff.reachRate));
  kv("ER (Reach)", pctS(eff.erReach));
  kv("Content Quality Score (/1k reach)", qualityScore(posts)?.toFixed(1) ?? "—");
  kv("Saves Rate (saved ÷ reach)", pctS(eff.savesRate));
  kv("Shares Rate (shares ÷ reach)", pctS(eff.sharesRate));
  kv("Profile Visit Rate", pctS(eff.pvRate));
  kv("Follow Rate", pctS(eff.followRate));
  kv("Avg Reach / Post", eff.avgReach != null ? Math.round(eff.avgReach) : "—");
  const netGrowth =
    metrics.followersGained != null || metrics.followersLost != null
      ? (metrics.followersGained ?? 0) - (metrics.followersLost ?? 0)
      : null;
  kv("Net Follower Growth", netGrowth != null ? (netGrowth >= 0 ? "+" : "") + netGrowth : "—");
  row++;

  // 2) Period-over-period
  const deltas = computeDeltas(t, metrics.comparison);
  if (deltas) {
    section("PERBANDINGAN vs PERIODE SEBELUMNYA", "#CFE2F3");
    headerRow(["Metrik", "Δ %"]);
    ([
      ["Reach", deltas.reach],
      ["Total Interaksi", deltas.totalInteractions],
      ["ER", deltas.erReach],
      ["Likes", deltas.likes],
      ["Komentar", deltas.comments],
      ["Saved", deltas.saved],
      ["Shares", deltas.shares],
    ] as [string, number | null][]).forEach(([k, d]) => kv(k, deltaS(d)));
    row++;
  }

  // 3) Best day / time
  const bt = bestDayTime(posts);
  if (bt) {
    section("WAKTU TERBAIK POSTING (WIB)", "#FCE5CD");
    kv("Hari Terbaik", `${bt.day} (avg reach ${bt.dayAvgReach.toLocaleString("id-ID")})`);
    kv("Jam Terbaik", `${String(bt.hour).padStart(2, "0")}:00 (avg reach ${bt.hourAvgReach.toLocaleString("id-ID")})`);
    row++;
  }

  // 4) Per-pillar performance
  const pillarMap = new Map<string, { count: number; reach: number; ti: number }>();
  for (const p of posts) {
    if (!p.pillar) continue;
    const e = pillarMap.get(p.pillar) ?? { count: 0, reach: 0, ti: 0 };
    e.count += 1;
    e.reach += p.reach ?? 0;
    e.ti += totalInteraction(p);
    pillarMap.set(p.pillar, e);
  }
  if (pillarMap.size) {
    section("PERFORMA PER PILLAR KONTEN", "#EAD1DC");
    headerRow(["Pillar", "Post", "Reach", "Interaksi"]);
    [...pillarMap.entries()].sort((a, b) => b[1].reach - a[1].reach).forEach(([name, v]) => {
      ws.getCell(row, 1).value = name;
      ws.getCell(row, 2).value = v.count;
      ws.getCell(row, 3).value = v.reach;
      ws.getCell(row, 4).value = v.ti;
      [3, 4].forEach((c) => (ws.getCell(row, c).numFmt = "#,##0"));
      row++;
    });
    row++;
  }

  // 5) Reels retention
  const reels = reelRows(posts);
  if (reels.length) {
    section("RETENSI REELS PER VIDEO", "#D9EAD3");
    headerRow(["Tanggal", "Views", "Reach", "View Rate", "Avg Watch (dtk)", "Completion"]);
    for (const v of reels) {
      ws.getCell(row, 1).value = v.date;
      ws.getCell(row, 2).value = v.views ?? null;
      ws.getCell(row, 3).value = v.reach ?? null;
      ws.getCell(row, 4).value = timesS(v.viewRate);
      ws.getCell(row, 5).value = v.avgWatchSec != null ? Number(v.avgWatchSec.toFixed(1)) : null;
      ws.getCell(row, 6).value = pctS(v.completion);
      [2, 3].forEach((c) => (ws.getCell(row, c).numFmt = "#,##0"));
      row++;
    }
    row++;
  }

  // 6) Audience overlap (followers vs engaged)
  const ov = (title: string, rows: { name: string; follower: number; engaged: number; gap: number }[]) => {
    if (!rows.length) return;
    section(`OVERLAP AUDIENS — ${title}`, "#FFF2CC");
    headerRow(["Segmen", "Followers %", "Interaksi %", "Gap"]);
    for (const rr of rows.slice(0, 8)) {
      ws.getCell(row, 1).value = rr.name;
      ws.getCell(row, 2).value = (rr.follower * 100).toFixed(0) + "%";
      ws.getCell(row, 3).value = (rr.engaged * 100).toFixed(0) + "%";
      ws.getCell(row, 4).value = (rr.gap >= 0 ? "+" : "") + (rr.gap * 100).toFixed(0) + "%";
      row++;
    }
    row++;
  };
  ov("Umur", overlapRows(metrics.demographics?.ages, metrics.engagedDemographics?.ages));
  ov("Gender", overlapRows(metrics.demographics?.genders, metrics.engagedDemographics?.genders));
}

/** Sheet 2 — Ringkasan + rules. */
function buildSummary(wb: ExcelJS.Workbook, client: ReportClient, metrics: ReportMetrics, rules: ReportRule[]) {
  const s2 = wb.addWorksheet("Ringkasan & Rumus");
  s2.columns = [{ width: 26 }, { width: 22 }, { width: 26 }, { width: 22 }];
  const put = (r: number, c: number, v: unknown, bold = false) => {
    const cell = s2.getCell(r, c);
    cell.value = v as ExcelJS.CellValue;
    if (bold) cell.font = { bold: true };
    return cell;
  };
  put(1, 1, `${client.name} — Ringkasan`, true).font = { bold: true, size: 14 };
  const t = metrics.totals;
  const snap: [string, number | string | null][] = [
    ["Platform", metrics.platform ?? "instagram"],
    ["Followers", metrics.account?.followers ?? null],
    ["Reach", t?.reach ?? null],
    ["Impressions", t?.impressions ?? null],
    ["Total Interaksi", t?.totalInteractions ?? null],
    ["ER (Reach)", t?.erReach != null ? `${(t.erReach * 100).toFixed(2)}%` : null],
    ["Accounts Engaged", t?.accountsEngaged ?? null],
    ["Likes", t?.likes ?? null], ["Komentar", t?.comments ?? null],
    ["Saved", t?.saved ?? null], ["Shares", t?.shares ?? null],
    ["Follows", t?.follows ?? null], ["Web Clicks", t?.webClicks ?? null],
    ["Followers gained", metrics.followersGained ?? null], ["Followers lost", metrics.followersLost ?? null],
  ];
  put(3, 1, "SNAPSHOT", true).fill = fill("#B6D7A8");
  snap.forEach(([k, v], i) => { put(4 + i, 1, k); put(4 + i, 2, v as ExcelJS.CellValue, true); });

  if (metrics.discovery) {
    put(3, 3, "DISCOVERY", true).fill = fill("#CFE2F3");
    put(4, 3, "Followers reach"); put(4, 4, metrics.discovery.followers ?? null, true);
    put(5, 3, "Non-followers reach"); put(5, 4, metrics.discovery.nonFollowers ?? null, true);
  }
  if (metrics.reels) {
    put(7, 3, "REELS", true).fill = fill("#FCE5CD");
    put(8, 3, "Jumlah video"); put(8, 4, metrics.reels.count, true);
    put(9, 3, "Total views"); put(9, 4, metrics.reels.totalViews ?? null, true);
    put(10, 3, "Avg completion"); put(10, 4, metrics.reels.avgCompletion != null ? `${(metrics.reels.avgCompletion * 100).toFixed(1)}%` : null, true);
  }

  let row = 4 + snap.length + 1;
  put(row, 1, "PARAMETER RUMUS / PERINGKAT", true).fill = fill("#FFF2CC");
  put(row + 1, 1, "Label", true); put(row + 1, 2, "Metrik", true); put(row + 1, 3, "Kondisi", true);
  rules.forEach((r, i) => {
    put(row + 2 + i, 1, r.label);
    put(row + 2 + i, 2, r.metric);
    put(row + 2 + i, 3, `${r.direction === "up" ? "naik" : "turun"} ≥ ${r.thresholdPct}%`);
    if (r.color) s2.getCell(row + 2 + i, 1).fill = fill(r.color);
  });
  row = row + 2 + rules.length + 1;

  // AI analysis
  if (metrics.aiAnalysis?.length) {
    put(row, 1, "ANALISA AI (CLAUDE OPUS)", true).fill = fill("#E6E0FF");
    row += 1;
    for (const a of metrics.aiAnalysis) {
      put(row, 1, a.label, true);
      const cell = put(row, 2, a.text);
      s2.mergeCells(row, 2, row, 4);
      cell.alignment = { wrapText: true, vertical: "top" };
      s2.getRow(row).height = 46;
      row += 1;
    }
  }
}
