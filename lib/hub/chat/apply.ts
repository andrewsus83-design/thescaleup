// Pure helpers for turning a finding into a task or a follow-up date. No I/O.

import { addDays } from "../tasks/dates";
import type { AuditItem, Findings, OpenItem } from "./model";

/** The audit's name travels with the item for descriptions and notes. */
export type ItemRow = { auditName: string; channel: string };

type Member = { userId: string; email: string };

/** The teammate a name or first name points to, when exactly one does. */
export function matchMember(pic: string | null, members: readonly Member[]): string | null {
  const p = (pic ?? "").trim().toLowerCase();
  if (p.length < 2) return null;
  const hits = members.filter((m) => {
    const local = m.email.split("@")[0].toLowerCase();
    return m.email.toLowerCase() === p || local === p || local.split(/[._-]/)[0] === p.split(/\s+/)[0];
  });
  return hits.length === 1 ? hits[0].userId : null;
}

export function taskDraft(item: Pick<AuditItem, "title" | "findings">, open: OpenItem, members: readonly Member[], auditName: string) {
  return {
    title: open.item.slice(0, 100),
    description: `From the chat audit "${auditName}", conversation "${item.title}".${open.pic ? ` Named in the chat: ${open.pic}.` : ""}`.slice(0, 600),
    priority: item.findings.risk === "high" ? ("high" as const) : ("normal" as const),
    due_date: open.due,
    assignee_id: matchMember(open.pic, members),
  };
}

/** The follow-up date to write on the person: the model's date, or three days out when we are waiting on them and it gave none. Only ever earlier than what is there, or filling an empty date. */
export function followUpFor(f: Findings, current: string | null, today: string): string | null {
  const proposed = f.follow_up_date ?? (f.stalled_on === "them" || f.status === "ghosting" ? addDays(today, 3) : null);
  if (!proposed || proposed < today) return null;
  return current === null || proposed < current ? proposed : null;
}
