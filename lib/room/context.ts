// What one chat turn can see — the "context bundle" (docs 4 · "What one chat turn can see").
// Core sections are always included; pinned knowledge fills whatever budget is left, workspace
// rules first. Anything that does not fit is dropped (and counted), never silently truncated.

import type { KnowledgeItem, Project, Todo } from "./types";

export const DEFAULT_BUDGET = 6000; // tokens — an admin setting in the real product

export type BundleSection = {
  id: "project" | "profile" | "report" | "todo" | "chronicle";
  label: string;
  detail: string;
  tokens: number;
};
export type PinnedRow = { item: KnowledgeItem; included: boolean };
export type Bundle = {
  /** False until the profile is locked: the project is in intake mode. */
  ready: boolean;
  budget: number;
  sections: BundleSection[];
  pinned: PinnedRow[];
  coreTokens: number;
  pinnedTokens: number;
  tokens: number;
  /** Pinned items that did not fit (they stay searchable on demand). */
  dropped: number;
};

export function buildBundle(input: {
  project: Project;
  todos: Todo[];
  hasReport: boolean;
  chronicleCount: number;
  knowledge: KnowledgeItem[];
  budget?: number;
}): Bundle {
  const budget = input.budget ?? DEFAULT_BUDGET;
  const { project } = input;
  const open = input.todos.filter((t) => !t.done);

  const sections: BundleSection[] = [
    { id: "project", label: "Project", detail: `${project.name} · ${project.status}`, tokens: 40 },
    project.locked
      ? { id: "profile", label: `Profile v${project.profileVersion ?? 1}`, detail: "Latest locked version: brand, website, Who, What, When, Where, Why", tokens: 500 }
      : { id: "profile", label: "Profile (draft)", detail: "Not locked yet — chat can only help complete and lock it", tokens: 150 },
  ];
  if (input.hasReport) sections.push({ id: "report", label: "Report", detail: "Latest finished audit: scores, coverage, top 5 gaps", tokens: 300 });
  if (open.length) sections.push({ id: "todo", label: `To do ${open.length}`, detail: "Up to 10 open items, nearest horizon first", tokens: Math.min(open.length, 10) * 30 });
  if (input.chronicleCount) sections.push({ id: "chronicle", label: "Chronicle", detail: "Last 10 entries", tokens: Math.min(input.chronicleCount, 10) * 20 });

  const coreTokens = sections.reduce((s, x) => s + x.tokens, 0);

  const candidates = input.knowledge
    .filter((k) => k.pinned && !k.failed && (k.scope === "workspace" || k.projectId === project.id))
    // workspace rules first, then this project's own (stable sort keeps list order within each)
    .sort((a, b) => (a.scope === b.scope ? 0 : a.scope === "workspace" ? -1 : 1));

  let left = Math.max(0, budget - coreTokens);
  let pinnedTokens = 0;
  const pinned: PinnedRow[] = candidates.map((item) => {
    const included = item.tokens <= left;
    if (included) {
      left -= item.tokens;
      pinnedTokens += item.tokens;
    }
    return { item, included };
  });

  return {
    ready: project.locked,
    budget,
    sections,
    pinned,
    coreTokens,
    pinnedTokens,
    tokens: coreTokens + pinnedTokens,
    dropped: pinned.filter((p) => !p.included).length,
  };
}
