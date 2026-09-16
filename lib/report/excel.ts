import "server-only";
import ExcelJS from "exceljs";
import type { ReportClient, ReportMetrics, ReportRule } from "@/lib/report/types";

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
      return Buffer.from(await filled.xlsx.writeBuffer());
    }
    // mapping failed → fall through to the generated format
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "ScaleUp Reports";
  const brand = client.brandColor || "#2A2870";
  if (templateType !== "ringkas") buildPostMaster(wb, client, metrics, rules, brand);
  buildSummary(wb, client, metrics, rules);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Fill the user's uploaded .xlsx: detect the header row, map columns, write per-post data. */
async function fillUploadedTemplate(base64: string, metrics: ReportMetrics): Promise<ExcelJS.Workbook | null> {
  try {
    const wb = new ExcelJS.Workbook();
    const bin = Buffer.from(base64, "base64");
    const ab = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer;
    await wb.xlsx.load(ab);
    const ws = wb.worksheets[0];
    if (!ws) return null;
    // field → header keywords (lowercase, matched by exact/contains)
    const KW: Record<string, string[]> = {
      date: ["date", "tanggal"],
      caption: ["content", "konten", "caption", "judul"],
      likes: ["likes", "suka"],
      comments: ["comment", "komentar"],
      shares: ["shared", "share"],
      saved: ["saved", "save", "simpan"],
      reach: ["reach", "jangkauan"],
      impressions: ["impression", "impresi"],
      follows: ["follows", "follow"],
      profileVisits: ["profile visit", "kunjungan profil"],
      webClicks: ["web click", "link click"],
      totalInteractions: ["total interaction", "total interaksi"],
      views: ["views", "tayangan"],
      engagementRate: ["engagement rate"],
    };
    let headerRow = 0;
    let best = 0;
    let colMap: Record<number, string> = {};
    for (let r = 1; r <= 25; r++) {
      const row = ws.getRow(r);
      const map: Record<number, string> = {};
      const used = new Set<string>();
      let matches = 0;
      row.eachCell((cell, col) => {
        const txt = String(cell.value ?? "").toLowerCase().trim();
        if (!txt || map[col]) return;
        for (const [field, kws] of Object.entries(KW)) {
          if (used.has(field)) continue;
          if (kws.some((k) => txt === k || txt.includes(k))) {
            // "follows" must not match "followers"
            if (field === "follows" && txt.includes("follower")) continue;
            map[col] = field;
            used.add(field);
            matches++;
            break;
          }
        }
      });
      if (matches > best) { best = matches; headerRow = r; colMap = map; }
    }
    if (!headerRow || best < 3) return null; // too weak → let caller fall back

    const posts = [...(metrics.posts ?? [])].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    // clear old sample data in mapped columns (bounded)
    for (let r = headerRow + 1; r <= headerRow + 400; r++) {
      const row = ws.getRow(r);
      for (const col of Object.keys(colMap)) row.getCell(Number(col)).value = null;
    }
    // write data
    posts.forEach((p, i) => {
      const row = ws.getRow(headerRow + 1 + i);
      for (const [colStr, field] of Object.entries(colMap)) {
        const col = Number(colStr);
        let v: unknown = null;
        if (field === "date") v = p.date;
        else if (field === "caption") v = p.caption;
        else if (field === "engagementRate") v = p.engagementRate != null ? p.engagementRate / 100 : null;
        else v = (p as unknown as Record<string, number | null>)[field] ?? null;
        row.getCell(col).value = v as ExcelJS.CellValue;
      }
    });
    return wb;
  } catch {
    return null;
  }
}

/** Sheet 1 — "Post Master" grouped-header layout matching the uploaded Cap Gajah file. */
function buildPostMaster(wb: ExcelJS.Workbook, client: ReportClient, metrics: ReportMetrics, rules: ReportRule[], brand: string) {
  const ws = wb.addWorksheet(`Post Master - ${client.name}`.slice(0, 31));
  // A Date B Content | C Likes D Comments E ER | F Follows G ProfileVisits H Shared I Saved | J Impr | K Reach L ReachER | M TotalInteraction
  const widths = [13, 44, 8, 10, 7, 8, 12, 8, 8, 11, 11, 7, 13];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  ws.mergeCells("A1:M1");
  const t = ws.getCell("A1");
  t.value = `${client.name} — Report ${metrics.platform ?? "Instagram"} · ${metrics.period ?? ""}`;
  t.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  t.fill = fill(brand);
  t.alignment = { vertical: "middle" };
  ws.getRow(1).height = 26;

  // group headers (row 2)
  const groups: [string, string, string][] = [
    ["A2:B2", "Content", C.PINK],
    ["C2:E2", "Engagement", C.ENG],
    ["F2:I2", "Actions", C.ACT],
    ["J2:J2", "Impressions", C.IMP],
    ["K2:L2", "Reach", C.REACH],
    ["M2:M2", "Total Interaction", C.PURPLE],
  ];
  for (const [range, label, color] of groups) {
    ws.mergeCells(range);
    const cell = ws.getCell(range.split(":")[0]);
    cell.value = label;
    cell.fill = fill(color);
    cell.font = { bold: true, size: 11, color: { argb: color === C.PURPLE ? "FFFFFFFF" : "FF1A1A1A" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }
  // sub headers (row 3)
  const sub = ["Date", "Content", "Likes", "Comments", "ER", "Follows", "Profile Visits", "Shared", "Saved", "Total", "Total", "ER", "Total"];
  const subFill = ["", "", C.ENG, C.ENG, C.ENG, C.ACT, C.ACT, C.ACT, C.ACT, C.IMP, C.REACH, C.REACH, ""];
  sub.forEach((h, i) => {
    const cell = ws.getCell(3, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9 };
    if (subFill[i]) cell.fill = fill(subFill[i]);
    cell.alignment = { horizontal: "center", wrapText: true };
    cell.border = { bottom: thin };
  });

  const posts = [...(metrics.posts ?? [])].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const start = 4;
  posts.forEach((p, i) => {
    const r = ws.getRow(start + i);
    r.getCell(1).value = p.date;
    r.getCell(2).value = p.caption;
    r.getCell(3).value = num(p.likes);
    r.getCell(4).value = num(p.comments);
    r.getCell(5).value = p.engagementRate != null ? p.engagementRate / 100 : null;
    r.getCell(6).value = num(p.follows);
    r.getCell(7).value = num(p.profileVisits);
    r.getCell(8).value = num(p.shares);
    r.getCell(9).value = num(p.saved);
    r.getCell(10).value = num(p.impressions);
    r.getCell(11).value = num(p.reach);
    r.getCell(12).value = p.reach && p.totalInteractions ? p.totalInteractions / p.reach : null;
    r.getCell(13).value = num(p.totalInteractions);
    [3, 4, 6, 7, 8, 9, 10, 11, 13].forEach((c) => { r.getCell(c).numFmt = "#,##0"; r.getCell(c).alignment = { horizontal: "right" }; });
    [5, 12].forEach((c) => (r.getCell(c).numFmt = "0.0%"));
    r.getCell(2).alignment = { wrapText: true };
  });
  const end = start + posts.length - 1;

  // JUARA highlight — rank by total interaction, color with rule colors
  if (posts.length) {
    const ranked = posts.map((p, i) => ({ i: start + i, ti: p.totalInteractions ?? 0 })).sort((a, b) => b.ti - a.ti);
    const tiers = rules.slice(0, 3);
    ranked.slice(0, Math.max(tiers.length, 3)).forEach((rk, idx) => {
      const color = tiers[idx]?.color ?? ["#6AA84F", "#A4C2F4", "#FFFF00"][idx] ?? "#FFF2CC";
      [1, 2, 13].forEach((c) => (ws.getCell(rk.i, c).fill = fill(color.replace("#", ""))));
    });
  }

  // TOTAL + AVERAGE
  if (posts.length) {
    const cols = [3, 4, 6, 7, 8, 9, 10, 11, 13];
    const L = (c: number) => ws.getColumn(c).letter;
    const tr = ws.getRow(end + 1);
    tr.getCell(1).value = "TOTAL";
    cols.forEach((c) => { tr.getCell(c).value = { formula: `SUM(${L(c)}${start}:${L(c)}${end})` }; tr.getCell(c).numFmt = "#,##0"; });
    const ar = ws.getRow(end + 2);
    ar.getCell(1).value = "RATA-RATA";
    cols.forEach((c) => { ar.getCell(c).value = { formula: `AVERAGE(${L(c)}${start}:${L(c)}${end})` }; ar.getCell(c).numFmt = "#,##0"; });
    [5, 12].forEach((c) => { ar.getCell(c).value = { formula: `AVERAGE(${L(c)}${start}:${L(c)}${end})` }; ar.getCell(c).numFmt = "0.0%"; });
    [tr, ar].forEach((row) => { for (let c = 1; c <= 13; c++) { row.getCell(c).fill = fill(C.CREAM); row.getCell(c).font = { bold: true }; } });
  }
  ws.views = [{ state: "frozen", ySplit: 3 }];
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
