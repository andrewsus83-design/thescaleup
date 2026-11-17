// Pure rules for the CRM: leads and clients, a brand's own stages, what a form may contain, and how a list is filtered and
// ordered. No I/O.

import { parseNumber } from "../products/model";
import { addDays, isIsoDate } from "../tasks/dates";

export const KINDS = ["lead", "client"] as const;
export type Kind = (typeof KINDS)[number];
export const isKind = (v: unknown): v is Kind => v === "lead" || v === "client";

// ---------------------------------------------------------------------------------------------- stages
/** A stage's key never changes (people are stored under it); the label is what the brand calls it. `open` = still being worked (a lead) or still with the brand (a client). */
export type StageDef = { key: string; label: string; kind: Kind; open: boolean };
export type Stage = string;

/** What a brand starts with, and what it falls back to if its own list is missing or unusable. */
export const DEFAULT_STAGES: readonly StageDef[] = [
  { key: "new", label: "New", kind: "lead", open: true },
  { key: "contacted", label: "Contacted", kind: "lead", open: true },
  { key: "qualified", label: "Qualified", kind: "lead", open: true },
  { key: "proposal", label: "Proposal sent", kind: "lead", open: true },
  { key: "lost", label: "Lost", kind: "lead", open: false },
  { key: "active", label: "Active", kind: "client", open: true },
  { key: "paused", label: "Paused", kind: "client", open: true },
  { key: "churned", label: "Left", kind: "client", open: false },
];

export const STAGE_LIMITS = { perKind: 12, label: 30, key: 40 } as const;
const KEY = /^[a-z0-9][a-z0-9_-]{0,39}$/;
export const isStageKey = (v: unknown): v is string => typeof v === "string" && KEY.test(v);

export const stagesOf = (stages: readonly StageDef[], kind: Kind) => stages.filter((s) => s.kind === kind);
export const stageDef = (stages: readonly StageDef[], key: string) => stages.find((s) => s.key === key);
/** The brand's name for a stage. A key that is no longer in the list shows as itself, so nothing breaks. */
export const labelOf = (stages: readonly StageDef[], key: string) => stageDef(stages, key)?.label ?? key;
export const isStageFor = (stages: readonly StageDef[], kind: Kind, v: unknown): v is string => typeof v === "string" && stages.some((s) => s.kind === kind && s.key === v);
/** Where a new lead or client starts, and where a lead who bought lands: the first open stage of that kind. */
export function firstStage(stages: readonly StageDef[], kind: Kind): string {
  const of = stagesOf(stages, kind);
  return (of.find((s) => s.open) ?? of[0])?.key ?? (kind === "lead" ? "new" : "active");
}
/** Still worth a follow-up. A stage that is no longer in the list counts as open, so nobody quietly drops out. */
export const isOpen = (stages: readonly StageDef[], kind: Kind, stage: string) => {
  const d = stages.find((s) => s.kind === kind && s.key === stage);
  return d ? d.open : true;
};
/** The stages of a kind that end the story (lost, left): their keys, for queries. */
export const closedKeys = (stages: readonly StageDef[]) => stages.filter((s) => !s.open).map((s) => s.key);

/** null when the list is usable. Every kind needs one open stage to start in; keys and names must not repeat. */
export function validateStages(stages: readonly StageDef[]): string | null {
  const keys = new Set<string>();
  for (const kind of KINDS) {
    const of = stagesOf(stages, kind);
    const word = kind === "lead" ? "lead" : "client";
    if (of.length > STAGE_LIMITS.perKind) return `Use at most ${STAGE_LIMITS.perKind} ${word} stages.`;
    if (!of.some((s) => s.open)) return `Keep at least one ${word} stage that is still active, so new ${word}s have somewhere to start.`;
    const names = new Set<string>();
    for (const s of of) {
      if (!s.label.trim()) return "Every stage needs a name.";
      if (s.label.length > STAGE_LIMITS.label) return `Keep a stage name under ${STAGE_LIMITS.label} characters.`;
      const n = s.label.trim().toLowerCase();
      if (names.has(n)) return `Two ${word} stages are both called "${s.label.trim()}".`;
      names.add(n);
    }
  }
  for (const s of stages) {
    if (!isStageKey(s.key)) return "A stage has an invalid key.";
    if (keys.has(s.key)) return "Two stages share a key.";
    keys.add(s.key);
  }
  return null;
}

/** A brand's stages as stored. An empty, odd or invalid list gives the standard stages. */
export function parseStages(raw: unknown): StageDef[] {
  if (!Array.isArray(raw)) return [...DEFAULT_STAGES];
  const out: StageDef[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    if (!isStageKey(o.key) || typeof o.label !== "string" || !o.label.trim() || !isKind(o.kind) || typeof o.open !== "boolean" || seen.has(o.key)) continue;
    seen.add(o.key);
    out.push({ key: o.key, label: o.label.trim().slice(0, STAGE_LIMITS.label), kind: o.kind, open: o.open });
  }
  return validateStages(out) === null ? out : [...DEFAULT_STAGES];
}

/** A key for a new stage from its name: "Demo booked!" becomes "demo-booked". Never one that is taken. */
export function newStageKey(label: string, taken: ReadonlySet<string>): string {
  const base =
    label
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "stage";
  let key = base;
  for (let i = 2; taken.has(key); i++) key = `${base}-${i}`;
  return key;
}

/** The editor's submitted list (JSON). Rows with a known key keep it, even if renamed; new rows get a key from their name. */
export function parseStagesInput(json: string, current: readonly StageDef[]): { ok: true; stages: StageDef[] } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "The stages could not be read. Reload the page and try again." };
  }
  if (!Array.isArray(raw) || raw.length > STAGE_LIMITS.perKind * KINDS.length) return { ok: false, error: "The stages could not be read. Reload the page and try again." };
  const known = new Map(current.map((s) => [s.key, s]));
  const taken = new Set<string>(current.map((s) => s.key));
  const out: StageDef[] = [];
  const used = new Set<string>();
  for (const r of raw) {
    const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    if (!isKind(o.kind) || typeof o.label !== "string" || typeof o.open !== "boolean") return { ok: false, error: "A stage could not be read. Reload the page and try again." };
    const label = o.label.replace(/\s+/g, " ").trim();
    if (!label) return { ok: false, error: "Every stage needs a name." };
    let key: string;
    if (typeof o.key === "string" && o.key) {
      const prev = known.get(o.key);
      if (!prev || used.has(o.key)) return { ok: false, error: "The stages are out of date. Reload the page and try again." };
      if (prev.kind !== o.kind) return { ok: false, error: "A stage cannot move between leads and clients." };
      key = o.key;
    } else {
      key = newStageKey(label, taken);
      taken.add(key);
    }
    used.add(key);
    out.push({ key, label, kind: o.kind, open: o.open });
  }
  const err = validateStages(out);
  return err ? { ok: false, error: err } : { ok: true, stages: out };
}

// ---------------------------------------------------------------------------------------------- people
export const LIMITS = { name: 120, company: 120, email: 254, phone: 40, source: 60, summary: 2000, note: 2000, value: 1e12, list: 500 } as const;

export type Person = {
  id: string;
  kind: Kind;
  name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  stage: Stage;
  value: number | null;
  next_follow_up: string | null;
  summary: string;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PersonInput = { name: string; company: string; email: string; phone: string; source: string; value: number | null; next_follow_up: string | null; summary: string };

// Control characters and line breaks have no place in a single-line field.
const oneLine = (s: string, max: number) => s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Reads the person form. The kind and stage are not here: they come from the page and from the stage buttons. */
export function parsePerson(get: (k: string) => string): { ok: true; value: PersonInput } | { ok: false; error: string } {
  const name = oneLine(get("name"), LIMITS.name);
  if (!name) return { ok: false, error: "Give them a name." };
  if (get("name").trim().length > LIMITS.name) return { ok: false, error: `Keep the name under ${LIMITS.name} characters.` };
  const email = oneLine(get("email"), LIMITS.email).toLowerCase();
  if (email && !EMAIL.test(email)) return { ok: false, error: "That email address does not look right." };
  const phone = oneLine(get("phone"), LIMITS.phone);
  if (phone && !/^[\d+\-().\s]{3,40}$/.test(phone)) return { ok: false, error: "A phone number has only digits, spaces and + - ( )." };
  const rawValue = get("value").trim();
  let value: number | null = null;
  if (rawValue) {
    value = parseNumber(rawValue);
    if (value === null || value < 0 || value > LIMITS.value) return { ok: false, error: "The value must be a number, zero or more." };
    value = Math.round(value * 100) / 100;
  }
  const due = get("next_follow_up").trim();
  if (due && !isIsoDate(due)) return { ok: false, error: "Pick the follow-up day from the calendar." };
  return {
    ok: true,
    value: {
      name,
      company: oneLine(get("company"), LIMITS.company),
      email,
      phone,
      source: oneLine(get("source"), LIMITS.source),
      value,
      next_follow_up: due || null,
      // Notes keep their line breaks.
      summary: get("summary").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, LIMITS.summary),
    },
  };
}

export function parseNote(body: string): { ok: true; value: string } | { ok: false; error: string } {
  const v = body.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if (!v) return { ok: false, error: "Write the note first." };
  if (v.length > LIMITS.note) return { ok: false, error: `Keep a note under ${LIMITS.note} characters.` };
  return { ok: true, value: v };
}

/** How soon a follow-up is, for someone who is still open. `null` when there is none or the person is closed. */
export type FollowState = "late" | "today" | "soon" | "later";
export function followState(p: Pick<Person, "kind" | "stage" | "next_follow_up">, today: string, stages: readonly StageDef[]): FollowState | null {
  if (!p.next_follow_up || !isOpen(stages, p.kind, p.stage)) return null;
  if (p.next_follow_up < today) return "late";
  if (p.next_follow_up === today) return "today";
  return p.next_follow_up <= addDays(today, 7) ? "soon" : "later";
}

/** How many open people need a follow-up today or are late. */
export function followUpsDue(people: readonly Pick<Person, "kind" | "stage" | "next_follow_up">[], today: string, stages: readonly StageDef[]): number {
  let n = 0;
  for (const p of people) {
    const s = followState(p, today, stages);
    if (s === "late" || s === "today") n++;
  }
  return n;
}

export type Filter = { q: string; stage?: Stage | "open"; due?: boolean };

const fold = (s: string) => s.toLowerCase();

/** Filters a list and orders it: follow-ups first (soonest on top), then the most recently touched. */
export function filterPeople(people: readonly Person[], f: Filter, today: string, stages: readonly StageDef[]): Person[] {
  const q = fold(f.q.trim());
  const out = people.filter((p) => {
    if (f.stage === "open") {
      if (!isOpen(stages, p.kind, p.stage)) return false;
    } else if (f.stage && p.stage !== f.stage) return false;
    if (f.due) {
      const s = followState(p, today, stages);
      if (s !== "late" && s !== "today") return false;
    }
    if (!q) return true;
    return fold(`${p.name} ${p.company} ${p.email} ${p.phone} ${p.source}`).includes(q);
  });
  return out.sort((a, b) => {
    const A = a.next_follow_up && isOpen(stages, a.kind, a.stage) ? a.next_follow_up : "9999-12-31";
    const B = b.next_follow_up && isOpen(stages, b.kind, b.stage) ? b.next_follow_up : "9999-12-31";
    if (A !== B) return A < B ? -1 : 1;
    return a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : a.name.localeCompare(b.name);
  });
}

/** Counts per stage, how many are open, and what the open ones are worth in total. */
export function summarize(people: readonly Person[], stages: readonly StageDef[]): { byStage: Record<string, number>; open: number; openValue: number } {
  const byStage: Record<string, number> = {};
  let open = 0;
  let openValue = 0;
  for (const p of people) {
    byStage[p.stage] = (byStage[p.stage] ?? 0) + 1;
    if (isOpen(stages, p.kind, p.stage)) {
      open++;
      openValue += p.value ?? 0;
    }
  }
  return { byStage, open, openValue: Math.round(openValue * 100) / 100 };
}

/** The day a quick follow-up button sets: `days` from today (1 to 60). */
export const followUpIn = (today: string, days: number) => addDays(today, Math.min(Math.max(Math.trunc(days), 1), 60));

// ---------------------------------------------------------------------------------------------- funnel numbers
export type LogRow = { person_id: string; kind: Kind; from_stage: string | null; to_stage: string; converted: boolean; at: string };
export type StageStat = {
  key: string;
  label: string;
  open: boolean;
  /** People who entered this stage in the period (each counted once). */
  entered: number;
  /** People in it right now. */
  now: number;
  /** Of those who entered the first stage, how many reached this one, in percent (one decimal). null when nobody entered the first. */
  reached: number | null;
  /** Average days people stayed here before moving on, for stays that started in the period. null when none finished. */
  avgDays: number | null;
};

/** The funnel for one kind from the stage log (rows already limited to the period) and who is where now. */
export function funnelStats(stages: readonly StageDef[], kind: Kind, log: readonly LogRow[], people: readonly Pick<Person, "kind" | "stage">[]): { rows: StageStat[]; converted: number; started: number } {
  const of = stagesOf(stages, kind);
  const entered = new Map<string, Set<string>>();
  const stay = new Map<string, { sum: number; n: number }>();
  const byPerson = new Map<string, LogRow[]>();
  for (const r of log) {
    const list = byPerson.get(r.person_id);
    if (list) list.push(r);
    else byPerson.set(r.person_id, [r]);
  }
  for (const [pid, rows] of byPerson) {
    rows.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    rows.forEach((r, i) => {
      if (r.kind !== kind) return;
      if (!entered.has(r.to_stage)) entered.set(r.to_stage, new Set());
      entered.get(r.to_stage)!.add(pid);
      const next = rows[i + 1];
      if (next) {
        const days = Math.max(0, (Date.parse(next.at) - Date.parse(r.at)) / 86_400_000);
        if (Number.isFinite(days)) {
          const s = stay.get(r.to_stage) ?? { sum: 0, n: 0 };
          s.sum += days;
          s.n += 1;
          stay.set(r.to_stage, s);
        }
      }
    });
  }
  // Everyone who became a client in the period, whichever kind of funnel is being read.
  let converted = 0;
  for (const r of log) if (r.converted && r.kind === "client") converted++;
  const nowBy = new Map<string, number>();
  for (const p of people) if (p.kind === kind) nowBy.set(p.stage, (nowBy.get(p.stage) ?? 0) + 1);
  const first = of.find((s) => s.open) ?? of[0];
  const started = first ? (entered.get(first.key)?.size ?? 0) : 0;
  const rows: StageStat[] = of.map((s) => {
    const e = entered.get(s.key)?.size ?? 0;
    const st = stay.get(s.key);
    return {
      key: s.key,
      label: s.label,
      open: s.open,
      entered: e,
      now: nowBy.get(s.key) ?? 0,
      reached: started > 0 ? Math.round((e / started) * 1000) / 10 : null,
      avgDays: st && st.n > 0 ? Math.round((st.sum / st.n) * 10) / 10 : null,
    };
  });
  return { rows, converted, started };
}

/** The moment `days` ago, as an ISO string, for "the last 30 days". */
export const daysAgoIso = (days: number, now: number = Date.now()) => new Date(now - days * 86_400_000).toISOString();
