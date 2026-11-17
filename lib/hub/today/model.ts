// Pure rules for "What's today": which tasks count, and the plain-text summary that can go to a Telegram chat. No I/O.

import { fmtDay } from "../tasks/dates";

export const LIMITS = { tasks: 8, content: 5, page: 30 } as const;

export type TodayTask = { id: string; title: string; due: string; late: boolean; priority: string; assignee_id: string | null };
export type TodayPerson = { id: string; name: string; company: string; kind: "lead" | "client"; stage: string; next_follow_up: string; late: boolean };
export type TodayContent = { id: string; title: string; channel: string | null; status: string };

/** What one person may see for today. A null part means they cannot open that menu or it could not be read: nothing is said about it. */
export type Today = {
  day: string;
  tasks: { items: TodayTask[]; late: number; today: number } | null;
  people: { items: TodayPerson[]; total: number } | null;
  content: { items: TodayContent[] } | null;
  unread: number | null;
};

type Row = { id: string; title: string; stage: string; due_date: string | null; priority: string; assignee_id: string | null };

/** Open work (in progress or in review) due today or earlier: late first, oldest first, then by priority. */
export function pickTasks(rows: readonly Row[], day: string): { items: TodayTask[]; late: number; today: number } {
  const order: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  const open = rows
    .filter((t) => (t.stage === "active" || t.stage === "review") && t.due_date && t.due_date <= day)
    .map((t) => ({ id: t.id, title: t.title, due: t.due_date as string, late: (t.due_date as string) < day, priority: t.priority, assignee_id: t.assignee_id }))
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : (order[a.priority] ?? 2) - (order[b.priority] ?? 2)));
  const late = open.filter((t) => t.late).length;
  return { items: open, late, today: open.length - late };
}

const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
const oneLine = (s: string) => s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * The team's day as plain text for a group chat. Task and content titles are shared; people from the CRM are only counted,
 * because a team group is the wrong place for customer names.
 */
export function todayMessage(brandName: string, t: Today): string {
  const lines: string[] = [`${brandName}: ${fmtDay(t.day)}`];
  let any = false;
  if (t.tasks) {
    const { items, late, today } = t.tasks;
    if (items.length) {
      any = true;
      lines.push("", `Tasks: ${late ? `${late} late` : ""}${late && today ? ", " : ""}${today ? `${today} due today` : ""}`);
      for (const x of items.slice(0, LIMITS.tasks)) lines.push(`- ${x.late ? `Late (${fmtDay(x.due)})` : "Today"}: ${clip(oneLine(x.title), 80)}`);
      if (items.length > LIMITS.tasks) lines.push(`- and ${items.length - LIMITS.tasks} more`);
    }
  }
  if (t.people && t.people.total > 0) {
    any = true;
    lines.push("", `CRM: ${n(t.people.total, "follow-up")} due. Open the hub to see who.`);
  }
  if (t.content && t.content.items.length) {
    any = true;
    lines.push("", `Content planned today (${t.content.items.length}):`);
    for (const c of t.content.items.slice(0, LIMITS.content)) lines.push(`- ${c.channel ? `${c.channel}: ` : ""}${clip(oneLine(c.title), 80)}`);
    if (t.content.items.length > LIMITS.content) lines.push(`- and ${t.content.items.length - LIMITS.content} more`);
  }
  if (t.unread) {
    any = true;
    lines.push("", `Mail: ${t.unread} unread`);
  }
  if (!any) lines.push("", "Nothing is late, due or planned for today.");
  return lines.join("\n");
}

export const isEmpty = (t: Today): boolean => !(t.tasks?.items.length || t.people?.total || t.content?.items.length || t.unread);
