// Pure rules for the CRM: leads and clients, their stages, what a form may contain, and how a list is filtered and ordered. No I/O.

import { parseNumber } from "../products/model";
import { addDays, isIsoDate } from "../tasks/dates";

export const KINDS = ["lead", "client"] as const;
export type Kind = (typeof KINDS)[number];
export const isKind = (v: unknown): v is Kind => v === "lead" || v === "client";

export const LEAD_STAGES = ["new", "contacted", "qualified", "proposal", "lost"] as const;
export const CLIENT_STAGES = ["active", "paused", "churned"] as const;
export type Stage = (typeof LEAD_STAGES)[number] | (typeof CLIENT_STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal sent",
  lost: "Lost",
  active: "Active",
  paused: "Paused",
  churned: "Left",
};

export const stagesFor = (kind: Kind): readonly Stage[] => (kind === "lead" ? LEAD_STAGES : CLIENT_STAGES);
export const isStageFor = (kind: Kind, v: unknown): v is Stage => typeof v === "string" && (stagesFor(kind) as readonly string[]).includes(v);
export const firstStage = (kind: Kind): Stage => (kind === "lead" ? "new" : "active");
/** A lead still being worked, or a client who is still with the brand: the ones a follow-up makes sense for. */
export const isOpen = (kind: Kind, stage: string) => (kind === "lead" ? stage !== "lost" : stage !== "churned");

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
export function followState(p: Pick<Person, "kind" | "stage" | "next_follow_up">, today: string): FollowState | null {
  if (!p.next_follow_up || !isOpen(p.kind, p.stage)) return null;
  if (p.next_follow_up < today) return "late";
  if (p.next_follow_up === today) return "today";
  return p.next_follow_up <= addDays(today, 7) ? "soon" : "later";
}

/** How many open people need a follow-up today or are late. */
export function followUpsDue(people: readonly Pick<Person, "kind" | "stage" | "next_follow_up">[], today: string): number {
  let n = 0;
  for (const p of people) {
    const s = followState(p, today);
    if (s === "late" || s === "today") n++;
  }
  return n;
}

export type Filter = { q: string; stage?: Stage | "open"; due?: boolean };

const fold = (s: string) => s.toLowerCase();

/** Filters a list and orders it: follow-ups first (soonest on top), then the most recently touched. */
export function filterPeople(people: readonly Person[], f: Filter, today: string): Person[] {
  const q = fold(f.q.trim());
  const out = people.filter((p) => {
    if (f.stage === "open") {
      if (!isOpen(p.kind, p.stage)) return false;
    } else if (f.stage && p.stage !== f.stage) return false;
    if (f.due) {
      const s = followState(p, today);
      if (s !== "late" && s !== "today") return false;
    }
    if (!q) return true;
    return fold(`${p.name} ${p.company} ${p.email} ${p.phone} ${p.source}`).includes(q);
  });
  return out.sort((a, b) => {
    const A = a.next_follow_up && isOpen(a.kind, a.stage) ? a.next_follow_up : "9999-12-31";
    const B = b.next_follow_up && isOpen(b.kind, b.stage) ? b.next_follow_up : "9999-12-31";
    if (A !== B) return A < B ? -1 : 1;
    return a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : a.name.localeCompare(b.name);
  });
}

/** Counts per stage, how many are open, and what the open ones are worth in total. */
export function summarize(people: readonly Person[]): { byStage: Partial<Record<Stage, number>>; open: number; openValue: number } {
  const byStage: Partial<Record<Stage, number>> = {};
  let open = 0;
  let openValue = 0;
  for (const p of people) {
    byStage[p.stage] = (byStage[p.stage] ?? 0) + 1;
    if (isOpen(p.kind, p.stage)) {
      open++;
      openValue += p.value ?? 0;
    }
  }
  return { byStage, open, openValue: Math.round(openValue * 100) / 100 };
}

/** The day a quick follow-up button sets: `days` from today (1, 3 or 7). */
export const followUpIn = (today: string, days: number) => addDays(today, Math.min(Math.max(Math.trunc(days), 1), 60));
