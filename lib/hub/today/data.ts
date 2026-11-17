import "server-only";
import type { Access } from "../permissions";
import { listDue } from "../crm/data";
import { listPlanned } from "../content/data";
import { countUnread } from "../mail/data";
import type { Actor } from "../rules";
import { listTasks } from "../tasks/data";
import { LIMITS, pickTasks, type Today } from "./model";

/**
 * Everything that falls on `day` for one person: their open tasks that are late or due (or the whole team's), CRM follow-ups,
 * content planned for the day and unread mail. Only the menus they can open are read, and a failed read becomes null.
 */
export async function loadToday(opts: { brandId: string; actor: Actor | null; userId: string; access: Pick<Access, "tasks" | "crm" | "content" | "mail">; day: string; scope: "me" | "team" }): Promise<Today> {
  const { brandId, actor, userId, access, day, scope } = opts;
  const [tasks, people, content, unread] = await Promise.all([
    access.tasks !== "none"
      ? listTasks(brandId, actor, { userId, assignee: scope === "me" ? "me" : undefined, dueTo: day, limit: 300 }).then((r) => pickTasks(r, day)).catch(() => null)
      : null,
    access.crm !== "none"
      ? listDue(brandId, day, LIMITS.page).then((r) => ({
          total: r.total,
          items: r.items.flatMap((p) => (p.next_follow_up ? [{ id: p.id, name: p.name, company: p.company, kind: p.kind, stage: p.stage, next_follow_up: p.next_follow_up, late: p.next_follow_up < day }] : [])),
        })).catch(() => null)
      : null,
    access.content !== "none"
      ? listPlanned(brandId, day, day).then((r) => ({ items: r.filter((c) => c.status !== "posted").map((c) => ({ id: c.id, title: c.title, channel: c.channel, status: c.status })) })).catch(() => null)
      : null,
    access.mail !== "none" ? countUnread(brandId).catch(() => null) : null,
  ]);
  return { day, tasks, people, content, unread };
}
