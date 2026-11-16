import "server-only";
import ExcelJS from "exceljs";
import { LIMITS, cellToString, parseCsv } from "./model";

// Reads an uploaded Excel or CSV file into a plain table of text. Where the columns mean what is decided later, by the person.

export type Table = { ok: true; rows: string[][]; sheet: string | null; cut: boolean } | { ok: false; error: string };

const clip = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, LIMITS.cell);
// Header lines plus data rows. A few title lines above the header are common in marketplace exports.
const MAX_ROWS = LIMITS.rows + 30;
const MAX_CHARS = 8_000_000;

export async function readTable(file: File): Promise<Table> {
  if (file.size === 0) return { ok: false, error: "That file is empty." };
  if (file.size > LIMITS.bytes) return { ok: false, error: "That file is over 4 MB. Split it into smaller files, or save it as CSV, which is much smaller." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const oldExcel = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  if (oldExcel) return { ok: false, error: "That is an old .xls file. Open it in Excel and save it as .xlsx or .csv, then upload it again." };
  if (zip) return readXlsx(bytes);
  if (bytes.includes(0)) return { ok: false, error: "That does not look like an Excel or CSV file." };
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  const all = parseCsv(text);
  if (all.length === 0) return { ok: false, error: "No rows found in that file." };
  const cut = all.length > MAX_ROWS;
  return { ok: true, rows: cut ? all.slice(0, MAX_ROWS) : all, sheet: null, cut };
}

async function readXlsx(bytes: Uint8Array): Promise<Table> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  } catch {
    return { ok: false, error: "Could not open that Excel file. Save it again as .xlsx or .csv and retry." };
  }
  for (const ws of wb.worksheets) {
    if (ws.state && ws.state !== "visible") continue;
    const rows: string[][] = [];
    let chars = 0;
    let cut = false;
    const width = Math.min(ws.columnCount, LIMITS.cols);
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (cut) return;
      if (rows.length >= MAX_ROWS || chars > MAX_CHARS) {
        cut = true;
        return;
      }
      const cells: string[] = [];
      for (let c = 1; c <= width; c++) cells.push(clip(cellToString(row.getCell(c).value)));
      if (cells.some((x) => x !== "")) {
        chars += cells.reduce((n, x) => n + x.length, 0);
        rows.push(cells);
      }
    });
    if (rows.length > 0) return { ok: true, rows, sheet: ws.name, cut };
  }
  return { ok: false, error: "No rows found in that Excel file." };
}
