import "server-only";
import ExcelJS from "exceljs";
import type { ReportClient, ReportMetrics, ReportRule } from "@/lib/report/types";

function argb(hex: string) {
  return "FF" + hex.replace("#", "").toUpperCase().padStart(6, "0").slice(0, 6);
}
const fill = (hex: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: argb(hex) } });
const n = (v: number | null | undefined) => (v == null ? null : v);

/** Build the "Post Master" Excel report from Zernio metrics, applying JUARA rules. */
export async function buildReportWorkbook(
  client: ReportClient,
  metrics: ReportMetrics,
  rules: ReportRule[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ScaleUp Reports";
  const brand = client.brandColor || "#2A2870";

  // ---------------- Sheet 1: Post Master ----------------
  const ws = wb.addWorksheet(`Post Master - ${client.name}`.slice(0, 31));
  ws.columns = [
    { header: "Tanggal", key: "date", width: 13 },
    { header: "Konten", key: "content", width: 46 },
    { header: "Reach", key: "reach", width: 10 },
    { header: "Impressions", key: "impr", width: 12 },
    { header: "Likes", key: "likes", width: 9 },
    { header: "Komentar", key: "comments", width: 10 },
    { header: "Saved", key: "saved", width: 9 },
    { header: "Shares", key: "shares", width: 9 },
    { header: "Follows", key: "follows", width: 9 },
    { header: "Profile Visits", key: "pv", width: 12 },
    { header: "Total Interaksi", key: "ti", width: 13 },
    { header: "ER %", key: "er", width: 8 },
  ];

  ws.mergeCells("A1:L1");
  const title = ws.getCell("A1");
  title.value = `${client.name} — Report Instagram · ${metrics.period ?? ""}`;
  title.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  title.fill = fill(brand);
  title.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(1).height = 26;

  const headerRow = ws.getRow(2);
  headerRow.values = ws.columns.map((c) => c.header as string);
  headerRow.eachCell((c) => {
    c.font = { bold: true, size: 10 };
    c.fill = fill("#EEF2FB");
    c.alignment = { horizontal: "center", wrapText: true };
    c.border = { bottom: { style: "thin", color: { argb: "FFD9D9D9" } } };
  });

  const posts = [...(metrics.posts ?? [])].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const start = 3;
  posts.forEach((p) => {
    ws.addRow({
      date: p.date, content: p.caption, reach: n(p.reach), impr: n(p.impressions), likes: n(p.likes),
      comments: n(p.comments), saved: n(p.saved), shares: n(p.shares), follows: n(p.follows),
      pv: n(p.profileVisits), ti: n(p.totalInteractions), er: p.engagementRate != null ? p.engagementRate / 100 : null,
    });
  });
  const end = start + posts.length - 1;
  // number formats + alignment
  for (let r = start; r <= end; r++) {
    const row = ws.getRow(r);
    ["reach", "impr", "likes", "comments", "saved", "shares", "follows", "pv", "ti"].forEach((k) => {
      const c = row.getCell(k); c.numFmt = "#,##0"; c.alignment = { horizontal: "right" };
    });
    row.getCell("er").numFmt = "0.0%";
  }

  // JUARA highlight — rank by total interaction, color top posts with rule colors
  if (posts.length) {
    const ranked = posts
      .map((p, i) => ({ i: start + i, ti: p.totalInteractions ?? 0 }))
      .sort((a, b) => b.ti - a.ti);
    const tiers = rules.slice(0, 3);
    ranked.slice(0, Math.max(tiers.length, 3)).forEach((rk, idx) => {
      const color = tiers[idx]?.color ?? ["#6AA84F", "#A4C2F4", "#FFFF00"][idx] ?? "#FFF2CC";
      ["date", "content", "ti"].forEach((k) => (ws.getCell(rk.i, ws.getColumn(k).number).fill = fill(color)));
    });
  }

  // TOTAL + AVERAGE
  const sumF = (col: string) => ({ formula: `SUM(${col}${start}:${col}${end})` });
  const avgF = (col: string) => ({ formula: `AVERAGE(${col}${start}:${col}${end})` });
  const colL = (k: string) => ws.getColumn(k).letter;
  if (posts.length) {
    const tr = ws.addRow({ content: "TOTAL" });
    const ar = ws.addRow({ content: "RATA-RATA" });
    ["reach", "impr", "likes", "comments", "saved", "shares", "follows", "pv", "ti"].forEach((k) => {
      tr.getCell(k).value = sumF(colL(k)); tr.getCell(k).numFmt = "#,##0";
      ar.getCell(k).value = avgF(colL(k)); ar.getCell(k).numFmt = "#,##0";
    });
    ar.getCell("er").value = avgF(colL("er")); ar.getCell("er").numFmt = "0.0%";
    [tr, ar].forEach((row) => row.eachCell((c) => { c.font = { bold: true }; c.fill = fill("#FFF2CC"); }));
  }

  ws.views = [{ state: "frozen", ySplit: 2 }];

  // ---------------- Sheet 2: Ringkasan ----------------
  const s2 = wb.addWorksheet("Ringkasan & Rumus");
  s2.columns = [{ width: 26 }, { width: 22 }, { width: 26 }, { width: 22 }];
  const put = (r: number, c: number, v: unknown, bold = false) => {
    const cell = s2.getCell(r, c); cell.value = v as ExcelJS.CellValue; if (bold) cell.font = { bold: true };
    return cell;
  };
  put(1, 1, `${client.name} — Ringkasan`, true).font = { bold: true, size: 14 };
  const t = metrics.totals;
  const snap: [string, number | string | null][] = [
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
    const base = 4;
    put(base, 3, "DISCOVERY", true).fill = fill("#CFE2F3");
    put(base + 1, 3, "Followers reach"); put(base + 1, 4, metrics.discovery.followers ?? null, true);
    put(base + 2, 3, "Non-followers reach"); put(base + 2, 4, metrics.discovery.nonFollowers ?? null, true);
  }

  const rRow = 4 + snap.length + 1;
  put(rRow, 1, "PARAMETER RUMUS / PERINGKAT", true).fill = fill("#FFF2CC");
  put(rRow + 1, 1, "Label", true); put(rRow + 1, 2, "Metrik", true); put(rRow + 1, 3, "Kondisi", true);
  rules.forEach((r, i) => {
    put(rRow + 2 + i, 1, r.label);
    put(rRow + 2 + i, 2, r.metric);
    put(rRow + 2 + i, 3, `${r.direction === "up" ? "naik" : "turun"} ≥ ${r.thresholdPct}%`);
    if (r.color) s2.getCell(rRow + 2 + i, 1).fill = fill(r.color);
  });

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
