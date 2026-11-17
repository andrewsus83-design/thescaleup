import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/brand/primitives";
import { BackLink } from "@/components/hub/back-link";
import { Avatar } from "@/components/hub/tasks/parts";
import { requireFunction } from "@/lib/hub/access";
import { listMembers, listTasks } from "@/lib/hub/tasks/data";
import { addDays, hubTz, todayIn } from "@/lib/hub/tasks/dates";
import { shortName } from "@/lib/hub/tasks/model";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Team tasks" };
export const dynamic = "force-dynamic";

type Load = { open: number; overdue: number; soon: number; review: number };
const empty = (): Load => ({ open: 0, overdue: 0, soon: 0, review: 0 });

export default async function TeamTasksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, brand, actor } = await requireFunction(slug, "tasks");
  const today = todayIn(hubTz());
  const weekEnd = addDays(today, 7);
  const [members, tasks] = await Promise.all([listMembers(brand.id), listTasks(brand.id, actor, { userId: user.id, limit: 1000 })]);

  // Only approved, unfinished work counts as load. A proposal is not on anyone's plate until it is approved.
  const load = new Map<string, Load>();
  let unassigned = 0;
  for (const t of tasks) {
    if (t.stage === "closed" || t.stage === "rejected" || t.stage === "proposed") continue;
    if (!t.assignee_id) {
      unassigned++;
      continue;
    }
    const l = load.get(t.assignee_id) ?? empty();
    l.open++;
    if (t.stage === "review") l.review++;
    if (t.due_date && t.due_date < today) l.overdue++;
    else if (t.due_date && t.due_date <= weekEnd) l.soon++;
    load.set(t.assignee_id, l);
  }
  const href = (assignee: string) => `/hub/b/${slug}/tasks?assignee=${assignee}`;

  return (
    <div className="w-full">
      <BackLink href={`/hub/b/${slug}/team`}>Team</BackLink>
      <PageHeader title="Team tasks" description="Open work per person. Open a name to see the tasks." />
      {!members.length ? (
        <EmptyState icon={<Users className="size-6" aria-hidden />} title="No team members yet" hint="Invite people in Settings, then assign them tasks." />
      ) : (
        <ul className="space-y-3">
          {members.map((m) => {
            const l = load.get(m.userId) ?? empty();
            return (
              <li key={m.userId}>
                <Link href={href(m.userId)} className="flex min-h-16 items-center gap-4 rounded-card border-control border-ink-200 bg-paper-0 p-4 hover:border-ink-800">
                  <Avatar person={m} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-semibold text-ink-800">{shortName(m.email)}</span>
                    <span className="block text-small text-ink-500">
                      {l.open === 0 ? "Nothing open" : `${l.open} open`}
                      {l.review > 0 && `, ${l.review} in review`}
                      {l.soon > 0 && `, ${l.soon} due this week`}
                    </span>
                  </span>
                  {l.overdue > 0 && <span className={cn("shrink-0 text-small font-semibold text-danger")}>{l.overdue} overdue</span>}
                </Link>
              </li>
            );
          })}
          <li>
            <Link href={`/hub/b/${slug}/tasks?assignee=none`} className="flex min-h-16 items-center gap-4 rounded-card border-control border-dashed border-ink-200 p-4 hover:border-ink-800">
              <Avatar person={null} />
              <span className="min-w-0 flex-1">
                <span className="block text-body font-semibold text-ink-800">Unassigned</span>
                <span className="block text-small text-ink-500">{unassigned === 0 ? "Everything has an owner" : `${unassigned} open without an owner`}</span>
              </span>
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}
