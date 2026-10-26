// The to do board's vocabulary: four statuses (the Trello-style lists) and four horizons. Pure, so the board, the project
// cards, the Builder, the chat context and the chronicle all agree on what each status means and what counts as "open".

import type { Todo, TodoGroup, TodoStatus } from "./types";

/** Board order, left to right. */
export const TODO_STATUSES: { key: TodoStatus; label: string }[] = [
  { key: "progress", label: "On progress" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "done", label: "Done" },
];

/** Horizons, nearest first. A card shows its horizon as a tag; inside a list the nearest horizon comes first. */
export const TODO_GROUPS: { key: TodoGroup; label: string }[] = [
  { key: "week1", label: "Week 1" },
  { key: "d30", label: "30 days" },
  { key: "d90", label: "90 days" },
  { key: "manual", label: "Manual" },
];

export const statusLabel = (s: TodoStatus) => TODO_STATUSES.find((x) => x.key === s)?.label ?? s;
export const groupLabel = (g: TodoGroup) => TODO_GROUPS.find((x) => x.key === g)?.label ?? g;

/** Still has work in it: On progress or Approved. Done is finished and Rejected is closed without being done, so neither is open. */
export const isOpen = (t: Todo) => t.status === "progress" || t.status === "approved";

/** Nearest horizon first; the original order inside a horizon. */
export function sortByHorizon(todos: Todo[]): Todo[] {
  const rank = (g: TodoGroup) => TODO_GROUPS.findIndex((x) => x.key === g);
  return [...todos].sort((a, b) => rank(a.group) - rank(b.group));
}

const VERB: Record<TodoStatus, string> = { progress: "back on progress", approved: "approved", rejected: "rejected", done: "done" };

/** The chronicle line for a move, e.g. "To do approved: Add a FAQ page". Every status change is written, so decisions can't be forgotten. */
export const statusChronicle = (status: TodoStatus, title: string) => `To do ${VERB[status]}: ${title}`;
