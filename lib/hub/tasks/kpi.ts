// The KPI index: how reliably a person delivers the work that was given to them with a date.
// Pure and small on purpose, so anyone can read the formula and check a number.
//
//   Deliverable   a task assigned to the person, with a due date inside the window, that was approved (not a proposal, not rejected).
//   On time       closed on or before its due day.
//   Late          closed after its due day.
//   Missed        not closed, and the due day has passed.
//   Pending       not closed, due today: the day is not over, so it is left out of the score.
//
// The window is the last N days up to today, so work due after today is not part of it yet.
//
//   index = (onTime + 0.5 × late) ÷ (onTime + late + missed) × 100
//
// Hours worked are shown next to the index and never inside it: long hours are not a result, and counting them would reward
// the wrong thing. With fewer than MIN_JUDGED judged deliverables there is no index, only the counts.

import { dayIn, DEFAULT_TZ } from "./dates";
import type { Task } from "./model";

export const MIN_JUDGED = 3;
/** A single clock entry longer than this is treated as a forgotten clock-out and kept out of the hours. */
export const MAX_ENTRY_MINUTES = 16 * 60;

export type KpiTask = Pick<Task, "assignee_id" | "due_date" | "completed_at" | "stage">;
export type Kpi = { onTime: number; late: number; missed: number; pending: number; judged: number; index: number | null };

export type Window = { from: string; to: string }; // inclusive days, YYYY-MM-DD

export function windowFor(days: number, today: string): Window {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return { from: d.toISOString().slice(0, 10), to: today };
}

type Verdict = "onTime" | "late" | "missed" | "pending" | null;

/** One task's verdict inside a window, or null when it is not a deliverable there. */
export function verdict(t: KpiTask, win: Window, today: string, tz: string = DEFAULT_TZ): Verdict {
  if (!t.assignee_id || !t.due_date) return null;
  if (t.due_date < win.from || t.due_date > win.to) return null;
  if (t.stage === "proposed" || t.stage === "rejected") return null;
  if (t.stage === "closed") {
    const doneOn = t.completed_at ? dayIn(tz, t.completed_at) : null;
    if (!doneOn) return null; // closed without a time: cannot be judged
    return doneOn <= t.due_date ? "onTime" : "late";
  }
  return t.due_date < today ? "missed" : "pending";
}

export function scoreOf(c: Pick<Kpi, "onTime" | "late" | "missed">): number | null {
  const judged = c.onTime + c.late + c.missed;
  if (judged < MIN_JUDGED) return null;
  return Math.round(((c.onTime + 0.5 * c.late) / judged) * 100);
}

function tally(tasks: readonly KpiTask[], win: Window, today: string, tz: string): Kpi {
  const k = { onTime: 0, late: 0, missed: 0, pending: 0 };
  for (const t of tasks) {
    const v = verdict(t, win, today, tz);
    if (v) k[v]++;
  }
  const judged = k.onTime + k.late + k.missed;
  return { ...k, judged, index: scoreOf(k) };
}

/** The index for the whole team and for each person who has deliverables in the window. */
export function computeKpi(tasks: readonly KpiTask[], win: Window, today: string, tz: string = DEFAULT_TZ): { team: Kpi; people: Map<string, Kpi> } {
  const byPerson = new Map<string, KpiTask[]>();
  for (const t of tasks) {
    if (!t.assignee_id) continue;
    const list = byPerson.get(t.assignee_id);
    if (list) list.push(t);
    else byPerson.set(t.assignee_id, [t]);
  }
  const people = new Map<string, Kpi>();
  for (const [id, list] of byPerson) {
    const k = tally(list, win, today, tz);
    if (k.judged + k.pending > 0) people.set(id, k);
  }
  return { team: tally(tasks, win, today, tz), people };
}

// ---------------------------------------------------------------------------------------------- hours
export type Entry = { user_id: string; clock_in: string; clock_out: string | null };

/** Minutes worked per person inside the window. Open entries and entries over MAX_ENTRY_MINUTES are reported, not counted. */
export function hoursByPerson(entries: readonly Entry[], win: Window, tz: string = DEFAULT_TZ, now: number = Date.now()): { minutes: Map<string, number>; needsReview: Map<string, number> } {
  const minutes = new Map<string, number>();
  const needsReview = new Map<string, number>();
  for (const e of entries) {
    const day = dayIn(tz, e.clock_in);
    if (day < win.from || day > win.to) continue;
    const span = e.clock_out ? (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 60_000 : null;
    if (span === null || span > MAX_ENTRY_MINUTES) {
      // an entry that is still open is fine for a few hours; only the stale ones need a look
      const age = (now - new Date(e.clock_in).getTime()) / 60_000;
      if (span !== null || age > MAX_ENTRY_MINUTES) needsReview.set(e.user_id, (needsReview.get(e.user_id) ?? 0) + 1);
      continue;
    }
    minutes.set(e.user_id, (minutes.get(e.user_id) ?? 0) + Math.max(0, span));
  }
  return { minutes, needsReview };
}
