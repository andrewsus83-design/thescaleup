// Pure rules for bringing leads or clients into the CRM from a spreadsheet: which column is which, how a row is tidied, and which
// rows are the same person. No I/O. The database does the same duplicate check again (crm_import_chunk), so a second import of
// the same file adds nobody.

import { parseNumber } from "../products/model";
import { isIsoDate } from "../tasks/dates";
import { EMAIL, LIMITS, firstStage, isStageKey, oneLine, stagesOf, type Kind, type StageDef } from "./model";

/** Rows per request. A row with a long note is about 2.6 KB, so this stays under a server action's 1 MB body limit. */
export const CHUNK = 200;
/** Most rows one file may hold (the file reader stops there). */
export const MAX_ROWS = 20_000;

export type Field = "name" | "first" | "last" | "company" | "email" | "phone" | "source" | "value" | "followUp" | "notes" | "stage";
export type Mapping = Record<Field, number>;

export const FIELDS: { key: Field; label: string; hint: string }[] = [
  { key: "name", label: "Name", hint: "Full name. Or use first and last name below." },
  { key: "first", label: "First name", hint: "Used with the last name when there is no full name column" },
  { key: "last", label: "Last name", hint: "" },
  { key: "company", label: "Company", hint: "" },
  { key: "email", label: "Email", hint: "Also used to spot people who are already in the CRM" },
  { key: "phone", label: "Phone or WhatsApp", hint: "0812…, +62 812… and 62812… count as the same number" },
  { key: "source", label: "Source", hint: "Where they came from: Instagram, referral, event" },
  { key: "value", label: "Value", hint: "What the lead may be worth, or the client pays" },
  { key: "followUp", label: "Next follow-up", hint: "A date, day first: 31/12/2026 or 2026-12-31" },
  { key: "notes", label: "Notes", hint: "Saved on the person's page" },
  { key: "stage", label: "Stage", hint: "Matched to your stages by name; anything else starts in the first stage" },
];

export const emptyMapping = (): Mapping => ({ name: -1, first: -1, last: -1, company: -1, email: -1, phone: -1, source: -1, value: -1, followUp: -1, notes: -1, stage: -1 });

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const SYNONYMS: Record<Field, string[]> = {
  email: ["email", "emailaddress", "alamatemail", "surel", "emailaddr", "mail", "eemail", "primaryemail", "workemail"],
  phone: ["phone", "phonenumber", "mobile", "mobilephone", "mobilenumber", "telepon", "telp", "notelp", "nomortelepon", "notelepon", "nohp", "hp", "nomorhp", "whatsapp", "wa", "nowa", "nomorwa", "nowhatsapp", "tel", "cell", "contactnumber", "kontak"],
  company: ["company", "companyname", "organization", "organisation", "perusahaan", "namaperusahaan", "bisnis", "usaha", "namausaha", "toko", "namatoko", "business", "businessname", "instansi", "institusi", "employer"],
  first: ["firstname", "givenname", "namadepan", "first"],
  last: ["lastname", "surname", "familyname", "namabelakang", "namakeluarga", "last"],
  followUp: ["nextfollowup", "followup", "followupdate", "tanggalfollowup", "tglfollowup", "nextcontact", "nextcontactdate", "tindaklanjut", "nextactivity", "jadwalfollowup", "nextstep", "followupdue"],
  value: ["value", "dealvalue", "amount", "nilai", "nilaideal", "estimasi", "estimatedvalue", "revenue", "budget", "potensi", "nilaiestimasi", "dealamount"],
  stage: ["stage", "status", "tahap", "tahapan", "leadstatus", "lifecyclestage", "pipelinestage", "statuslead"],
  source: ["source", "leadsource", "sumber", "sumberlead", "asal", "channel", "referral", "utmsource", "origin", "asalpelanggan"],
  notes: ["notes", "note", "catatan", "keterangan", "comments", "comment", "description", "deskripsi", "remarks", "pesan", "message", "memo"],
  name: ["name", "fullname", "nama", "namalengkap", "contactname", "customername", "namapelanggan", "namakontak", "leadname", "namalead", "namacustomer", "contact", "customer", "pelanggan"],
};

// Exact headings are claimed in this order across all fields first; only then do loose matches (a heading that contains the word) fill what is left.
const ORDER: Field[] = ["email", "phone", "company", "first", "last", "followUp", "value", "stage", "source", "notes", "name"];
const LOOSE: Field[] = ["email", "phone", "company", "followUp", "source", "value"];

/** The best column for each field, by the heading's words. -1 when none looks right; a column is never given to two fields. */
export function guessMapping(headers: readonly string[]): Mapping {
  const heads = headers.map(norm);
  const used = new Set<number>();
  const out = emptyMapping();
  for (const key of ORDER) {
    for (const syn of SYNONYMS[key]) {
      const i = heads.findIndex((h, n) => !used.has(n) && h === syn);
      if (i >= 0) {
        out[key] = i;
        used.add(i);
        break;
      }
    }
  }
  for (const key of LOOSE) {
    if (out[key] >= 0) continue;
    for (const syn of SYNONYMS[key]) {
      if (syn.length < 4) continue;
      const i = heads.findIndex((h, n) => !used.has(n) && h.includes(syn));
      if (i >= 0) {
        out[key] = i;
        used.add(i);
        break;
      }
    }
  }
  return out;
}

/** The first of the opening rows that looks like a heading row: it names a person and a way to reach them. */
export function detectHeader(rows: readonly (readonly string[])[]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const g = guessMapping(rows[i]);
    if ((g.name >= 0 || g.first >= 0) && (g.email >= 0 || g.phone >= 0 || g.company >= 0)) return i;
  }
  return 0;
}

/** null when the mapping can be used. A name, a first name, a company or an email must be chosen: a row needs something to be called. */
export function mappingError(m: Mapping): string | null {
  if (m.name < 0 && m.first < 0 && m.company < 0 && m.email < 0) return "Pick the column that holds the name.";
  const picked = Object.values(m).filter((i) => i >= 0);
  if (new Set(picked).size !== picked.length) return "Each column can be used for one thing only. Two of the choices are the same column.";
  return null;
}

// ---------------------------------------------------------------------------------------------- reading cells

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, januari: 1, feb: 2, february: 2, februari: 2, mar: 3, march: 3, maret: 3, apr: 4, april: 4, may: 5, mei: 5, jun: 6, june: 6, juni: 6,
  jul: 7, july: 7, juli: 7, aug: 8, august: 8, agu: 8, agt: 8, agustus: 8, sep: 9, sept: 9, september: 9, oct: 10, okt: 10, october: 10, oktober: 10,
  nov: 11, november: 11, dec: 12, des: 12, december: 12, desember: 12,
};
const pad = (n: number) => String(n).padStart(2, "0");

/** A calendar day as people write it, to "2026-12-31". Day first (31/12/2026) unless the second number cannot be a month. null when it is not a real date. */
export function parseDay(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  let y = 0;
  let mo = 0;
  let d = 0;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[t\s].*)?$/.exec(s);
  if (m) {
    y = +m[1];
    mo = +m[2];
    d = +m[3];
  } else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s.*)?$/.exec(s))) {
    d = +m[1];
    mo = +m[2];
    y = +m[3];
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
  } else if ((m = /^(\d{1,2})[\s-]([a-z]+)\.?[\s,-]+(\d{4})$/.exec(s))) {
    d = +m[1];
    mo = MONTHS[m[2]] ?? 0;
    y = +m[3];
  } else if ((m = /^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(s))) {
    mo = MONTHS[m[1]] ?? 0;
    d = +m[2];
    y = +m[3];
  } else return null;
  const iso = `${y}-${pad(mo)}-${pad(d)}`;
  return y >= 1900 && y <= 2200 && isIsoDate(iso) ? iso : null;
}

/** The first email address in a cell ("Dana <dana@x.com>; other@x.com" gives dana@x.com), lower case. "" when there is none. */
export function pickEmail(raw: string): string {
  const m = /[^\s@,;<>()"']+@[^\s@,;<>()"']+\.[^\s@,;<>()"']+/.exec(raw);
  const e = m ? m[0].toLowerCase().replace(/[.]+$/, "") : "";
  return e && e.length <= LIMITS.email && EMAIL.test(e) ? e : "";
}

/** A phone number kept as written but cleaned: one number, only digits and + - ( ) . and spaces. Excel's 6.28E+11 is turned back into digits. "" when nothing usable is left. */
export function pickPhone(raw: string): string {
  let s = raw.trim().split(/[;,/\n]|\s(?:atau|or|dan|and)\s/i)[0] ?? "";
  if (/^\d+(\.\d+)?e\+?\d+$/i.test(s.trim())) {
    const n = Number(s.trim());
    if (Number.isFinite(n) && n > 0 && n < 1e15) s = n.toFixed(0);
  }
  s = s.replace(/[^\d+\-().\s]/g, "").replace(/\s+/g, " ").trim();
  const digits = s.replace(/\D/g, "").length;
  return digits >= 6 && s.length <= LIMITS.phone && /^[\d+\-().\s]{3,40}$/.test(s) ? s : "";
}

// ---------------------------------------------------------------------------------------------- who is the same person

export const emailKey = (email: string) => email.trim().toLowerCase();
/** A phone number as digits, a leading 0 read as Indonesia's 62. "" when it is too short to compare. Same rule as crm_phone_key in the database. */
export function phoneKey(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length < 6) return "";
  return d.startsWith("0") ? `62${d.slice(1)}` : d;
}
export const nameKey = (name: string, company: string) => `${name.trim().toLowerCase().replace(/\s+/g, " ")}|${company.trim().toLowerCase().replace(/\s+/g, " ")}`;

// ---------------------------------------------------------------------------------------------- rows

export type ImportPerson = { name: string; company: string; email: string; phone: string; source: string; value: number | null; next_follow_up: string | null; summary: string; stage: string };

export type Fixes = {
  /** Cells that held something we could not read, and were left empty. */
  email: number;
  phone: number;
  value: number;
  followUp: number;
  /** A stage name that matches none of the brand's stages: the person starts in the first one. */
  stage: number;
  /** Rows with no name: called by their company or email instead. */
  namedByFallback: number;
};

const stageOf = (stages: readonly StageDef[], kind: Kind, cell: string): string | null => {
  const want = norm(cell);
  if (!want) return null;
  return stagesOf(stages, kind).find((s) => norm(s.label) === want || norm(s.key) === want)?.key ?? null;
};

/**
 * The table's data rows (heading row already removed) as people to add. Counts what was changed or left out so the person sees it
 * before importing: rows with nothing to call them by, and people repeated inside the file (the first one wins).
 */
export function toPeople(
  table: readonly (readonly string[])[],
  m: Mapping,
  opts: { kind: Kind; stages: readonly StageDef[]; defaultSource: string },
): { rows: ImportPerson[]; skipped: number; repeated: number; fixes: Fixes } {
  const cell = (r: readonly string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  const start = firstStage(opts.stages, opts.kind);
  const fixes: Fixes = { email: 0, phone: 0, value: 0, followUp: 0, stage: 0, namedByFallback: 0 };
  const fallbackSource = oneLine(opts.defaultSource, LIMITS.source);
  const out: ImportPerson[] = [];
  let skipped = 0;
  let repeated = 0;
  const seenEmail = new Set<string>();
  const seenPhone = new Set<string>();
  const seenName = new Set<string>();

  for (const r of table) {
    const company = oneLine(cell(r, m.company), LIMITS.company);
    const emailCell = cell(r, m.email);
    const email = pickEmail(emailCell);
    const phoneCell = cell(r, m.phone);
    const phone = pickPhone(phoneCell);
    let name = oneLine(cell(r, m.name) || `${cell(r, m.first)} ${cell(r, m.last)}`, LIMITS.name);
    let fallback = false;
    if (!name) {
      name = company || email;
      fallback = Boolean(name);
    }
    if (!name) {
      skipped++;
      continue;
    }

    const ek = emailKey(email);
    const pk = phoneKey(phone);
    const nk = nameKey(name, company);
    if ((ek && seenEmail.has(ek)) || (pk && seenPhone.has(pk)) || (!ek && !pk && seenName.has(nk))) {
      repeated++;
      continue;
    }
    if (ek) seenEmail.add(ek);
    if (pk) seenPhone.add(pk);
    seenName.add(nk);

    if (fallback) fixes.namedByFallback++;
    if (emailCell && !email) fixes.email++;
    if (phoneCell && !phone) fixes.phone++;

    const valueCell = cell(r, m.value);
    let value: number | null = null;
    if (valueCell) {
      const n = parseNumber(valueCell);
      if (n !== null && n >= 0 && n <= LIMITS.value) value = Math.round(n * 100) / 100;
      else fixes.value++;
    }

    const dueCell = cell(r, m.followUp);
    let due: string | null = null;
    if (dueCell) {
      due = parseDay(dueCell);
      if (!due) fixes.followUp++;
    }

    const stageCell = cell(r, m.stage);
    const stage = stageOf(opts.stages, opts.kind, stageCell) ?? start;
    if (stageCell && stageOf(opts.stages, opts.kind, stageCell) === null) fixes.stage++;

    out.push({
      name,
      company,
      email,
      phone,
      source: oneLine(cell(r, m.source), LIMITS.source) || fallbackSource,
      value,
      next_follow_up: due,
      // Notes keep their line breaks when the file had them.
      summary: cell(r, m.notes).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, LIMITS.summary),
      stage,
    });
  }
  return { rows: out, skipped, repeated, fixes };
}

/** A batch the browser sent, checked again on the server. null when anything is off. */
export function cleanImportRows(raw: unknown): ImportPerson[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > CHUNK) return null;
  const out: ImportPerson[] = [];
  for (const r of raw) {
    if (typeof r !== "object" || r === null) return null;
    const o = r as Record<string, unknown>;
    const str = (k: string, max: number): string | null => (typeof o[k] === "string" && (o[k] as string).length <= max ? (o[k] as string) : null);
    const name = str("name", LIMITS.name);
    const company = str("company", LIMITS.company);
    const email = str("email", LIMITS.email);
    const phone = str("phone", LIMITS.phone);
    const source = str("source", LIMITS.source);
    const summary = str("summary", LIMITS.summary);
    const stage = o.stage;
    if (name === null || company === null || email === null || phone === null || source === null || summary === null) return null;
    if (!name.trim() || /[\u0000-\u001f\u007f]/.test(name + company + email + phone + source)) return null;
    if (email.trim() && !EMAIL.test(email.trim())) return null;
    if (phone.trim() && !/^[\d+\-().\s]{3,40}$/.test(phone.trim())) return null;
    if (!isStageKey(stage)) return null;
    let value: number | null = null;
    if (o.value !== null && o.value !== undefined) {
      if (typeof o.value !== "number" || !Number.isFinite(o.value) || o.value < 0 || o.value > LIMITS.value) return null;
      value = Math.round(o.value * 100) / 100;
    }
    let due: string | null = null;
    if (o.next_follow_up !== null && o.next_follow_up !== undefined) {
      if (!isIsoDate(o.next_follow_up)) return null;
      due = o.next_follow_up;
    }
    out.push({ name: name.trim(), company: company.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), source: source.trim(), value, next_follow_up: due, summary: summary.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ""), stage });
  }
  return out;
}

export type ImportChunkResult = { ok: true; created: number; skipped: number } | { ok: false; error: string };
