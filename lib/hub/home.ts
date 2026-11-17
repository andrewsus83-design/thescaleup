// Pure rules for the Home screen: the greeting, and which "needs you" cards to show from a few counts. No I/O, so it is easy to test.

import type { TabKey } from "./tabs";

/** The hour (0-23) in a time zone. */
export function hourIn(tz: string, now: Date = new Date()): number {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(now));
  return Number.isFinite(h) ? h % 24 : 12;
}

export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

/** How many of the person's open tasks are late and how many fall on `today`. Only work in progress or in review counts. */
export function dueSummary(tasks: readonly { stage: string; due_date: string | null }[], today: string): { overdue: number; today: number } {
  let overdue = 0;
  let due = 0;
  for (const t of tasks) {
    if ((t.stage !== "active" && t.stage !== "review") || !t.due_date) continue;
    if (t.due_date < today) overdue++;
    else if (t.due_date === today) due++;
  }
  return { overdue, today: due };
}

export type Signal = { key: string; menu: TabKey; title: string; detail?: string; href: string };

const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** The cards for "Needs you". A null means the person cannot see that menu or the lookup failed, so nothing is said about it. */
export type Counts = { tasks: { overdue: number; today: number } | null; unread: number | null; stock: { low: number; out: number } | null; followUps?: { lead: number; client: number } | null };

export function buildSignals(base: string, i: Counts): Signal[] {
  const out: Signal[] = [];
  const t = i.tasks;
  if (t && (t.overdue > 0 || t.today > 0)) {
    out.push({
      key: "tasks",
      menu: "tasks",
      title: t.overdue > 0 ? `${n(t.overdue, "task")} ${t.overdue === 1 ? "is" : "are"} late` : `${n(t.today, "task")} due today`,
      detail: t.overdue > 0 && t.today > 0 ? `and ${t.today} due today` : undefined,
      href: `${base}/tasks?assignee=me`,
    });
  }
  if (i.unread && i.unread > 0) {
    out.push({ key: "mail", menu: "mail", title: `${n(i.unread, "unread email")}`, detail: "Waiting in Mail", href: `${base}/mail` });
  }
  const f = i.followUps;
  if (f && f.lead + f.client > 0) {
    out.push({
      key: "crm",
      menu: "crm",
      title: `${n(f.lead + f.client, "person", "people")} to follow up`,
      detail: f.lead > 0 && f.client > 0 ? `${n(f.lead, "lead")} and ${n(f.client, "client")}` : f.lead > 0 ? "Leads due today or late" : "Clients due today or late",
      href: `${base}/crm${f.lead > 0 ? "" : "/clients"}?due=1`,
    });
  }
  const s = i.stock;
  if (s && (s.out > 0 || s.low > 0)) {
    out.push({
      key: "products",
      menu: "products",
      title: s.out > 0 ? `${n(s.out, "product")} out of stock` : `${n(s.low, "product")} running low`,
      detail: s.out > 0 && s.low > 0 ? `and ${s.low} running low` : undefined,
      href: `${base}/products?show=${s.out > 0 ? "out" : "low"}`,
    });
  }
  return out;
}

/** The short line under a menu tile ("3 late", "5 unread"), or undefined when there is nothing to say. */
export function tileNote(menu: TabKey, i: Counts): string | undefined {
  if (menu === "tasks" && i.tasks) return i.tasks.overdue > 0 ? `${i.tasks.overdue} late` : i.tasks.today > 0 ? `${i.tasks.today} due today` : undefined;
  if (menu === "mail" && i.unread) return `${i.unread} unread`;
  if (menu === "crm" && i.followUps && i.followUps.lead + i.followUps.client > 0) return `${i.followUps.lead + i.followUps.client} to follow up`;
  if (menu === "products" && i.stock) return i.stock.out > 0 ? `${i.stock.out} out of stock` : i.stock.low > 0 ? `${i.stock.low} running low` : undefined;
  return undefined;
}
