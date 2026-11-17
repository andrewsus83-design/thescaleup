// Pure rules for editing a brand's task workflow (Settings → Workflow): what a valid list of statuses is, how a new status gets its key,
// and what may not change. No I/O, so the editor, the server action and the tests all use it.

import { STAGES, isStage, type Stage, type WorkflowStatus } from "./model";

export const WORKFLOW_LIMITS = { statuses: 20, label: 40 } as const;

export const STAGE_LABEL: Record<Stage, string> = { proposed: "Waiting for approval", active: "Being worked on", review: "In review", closed: "Done", rejected: "Rejected" };
export const STAGE_HINT: Record<Stage, string> = {
  proposed: "New ideas wait here until the founder approves or rejects them.",
  active: "Work that has started or is ready to start.",
  review: "Finished work that someone should look at.",
  closed: "Finished. Counts as done in Team hours and reports.",
  rejected: "Ideas that were turned down. Hidden from most people.",
};

/** One row in the editor. `key` is null for a status that does not exist yet. */
export type Draft = { key: string | null; label: string; stage: string };

const cleanLabel = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, WORKFLOW_LIMITS.label) : "");

/** A key from a label: lower case letters, digits and underscores, starting with a letter, never one that is taken. */
export function keyFor(label: string, taken: ReadonlySet<string>): string {
  let base = label.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!/^[a-z]/.test(base)) base = `s_${base}`.replace(/_+$/, "");
  base = (base || "status").slice(0, 34);
  let key = base;
  for (let i = 2; taken.has(key); i++) key = `${base.slice(0, 36 - String(i).length - 1)}_${i}`;
  return key;
}

export type Checked = { ok: true; statuses: WorkflowStatus[] } | { ok: false; error: string };

/**
 * Turns the editor's rows into the saved list, or says what is wrong in words.
 * - `current` is what is saved now; `used` counts the tasks sitting in each status key.
 * - An existing status keeps its key and its stage (its tasks were filed under them); only its name and its place change.
 * - A status that tasks still use cannot be removed: move or finish them first.
 * - There must be a status to work in and a status that means done, or tasks could never be finished.
 */
export function checkWorkflow(drafts: readonly Draft[], current: readonly WorkflowStatus[], used: ReadonlyMap<string, number>): Checked {
  if (drafts.length === 0) return { ok: false, error: "Keep at least one status." };
  if (drafts.length > WORKFLOW_LIMITS.statuses) return { ok: false, error: `A workflow can have at most ${WORKFLOW_LIMITS.statuses} statuses.` };
  const byKey = new Map(current.map((s) => [s.key, s]));
  const seenKeys = new Set<string>();
  const seenLabels = new Set<string>();
  const taken = new Set(current.map((s) => s.key));
  const out: WorkflowStatus[] = [];
  for (const d of drafts) {
    const label = cleanLabel(d.label);
    if (!label) return { ok: false, error: "Every status needs a name." };
    const lower = label.toLowerCase();
    if (seenLabels.has(lower)) return { ok: false, error: `Two statuses are called “${label}”. Give each its own name.` };
    seenLabels.add(lower);
    if (d.key !== null) {
      const was = byKey.get(d.key);
      if (!was) return { ok: false, error: "The workflow changed while you were editing. Reload the page and try again." };
      if (seenKeys.has(d.key)) return { ok: false, error: "A status appears twice. Reload the page and try again." };
      seenKeys.add(d.key);
      if (d.stage !== was.stage) return { ok: false, error: `“${was.label}” keeps its meaning (${STAGE_LABEL[was.stage]}), because tasks are filed under it. Add a new status instead.` };
      out.push({ key: was.key, label, stage: was.stage });
    } else {
      if (!isStage(d.stage)) return { ok: false, error: `Pick what “${label}” means.` };
      const key = keyFor(label, taken);
      taken.add(key);
      out.push({ key, label, stage: d.stage });
    }
  }
  for (const s of current) {
    if (!seenKeys.has(s.key) && (used.get(s.key) ?? 0) > 0) {
      const n = used.get(s.key) ?? 0;
      return { ok: false, error: `“${s.label}” still has ${n} ${n === 1 ? "task" : "tasks"}. Move ${n === 1 ? "it" : "them"} to another status first, then remove it.` };
    }
  }
  if (!out.some((s) => s.stage === "active")) return { ok: false, error: "Keep a status that means “Being worked on”." };
  if (!out.some((s) => s.stage === "closed")) return { ok: false, error: "Keep a status that means “Done”." };
  return { ok: true, statuses: out };
}

export const stageOptions = STAGES.map((s) => ({ stage: s, label: STAGE_LABEL[s] }));
