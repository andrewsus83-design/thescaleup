import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert, PageHeader } from "@/components/brand/primitives";
import { BackLink } from "@/components/hub/back-link";
import { RepeatManager, type RepeatRow } from "@/components/hub/tasks/repeat-manager";
import { requireFunction } from "@/lib/hub/access";
import { getWorkflow, listMembers } from "@/lib/hub/tasks/data";
import { hubTz, todayIn } from "@/lib/hub/tasks/dates";
import { describe, nextLabel } from "@/lib/hub/tasks/recurrence-model";
import { listRepeats } from "@/lib/hub/tasks/recurrence-data";
import { makeDueTasks } from "@/lib/hub/tasks/recurrence-run";
import { canRepeat, canSeeRepeats } from "@/lib/hub/tasks/rules";
import { shortName } from "@/lib/hub/tasks/model";

export const metadata: Metadata = { title: "Repeating tasks" };
export const dynamic = "force-dynamic";

export default async function RepeatPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, brand, actor, access } = await requireFunction(slug, "tasks");
  const who = { actor, level: access.tasks, userId: user.id };
  if (!canSeeRepeats(who)) notFound();
  const today = todayIn(hubTz());
  await makeDueTasks({ brandId: brand.id, today });
  const [workflow, members, { ready, rows }] = await Promise.all([getWorkflow(brand.id), listMembers(brand.id), listRepeats(brand.id)]);
  const manage = canRepeat(who, workflow);
  const email = new Map(members.map((m) => [m.userId, m.email]));
  const items: RepeatRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    assigneeId: r.assignee_id,
    priority: r.priority,
    tags: r.tags,
    items: r.items,
    freq: r.freq,
    every: r.every,
    weekdays: r.weekdays,
    monthDay: r.month_day,
    dueInDays: r.due_in_days,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    active: r.active,
    summary: describe(r),
    next: nextLabel(r, today),
    who: r.assignee_id && email.get(r.assignee_id) ? shortName(email.get(r.assignee_id)!) : "Unassigned",
  }));

  return (
    <div className="w-full">
      <BackLink href={`/hub/b/${slug}/tasks`}>Tasks</BackLink>
      <PageHeader title="Repeating tasks" description="Work that comes round again. A normal task appears on the board on each day, with its checklist, and can be edited like any other." />
      {!ready ? (
        <Alert tone="warn" title="Repeating tasks need their database step first.">
          Ask the person who runs the database updates to run 20261117420000_recurring_tasks.sql.
        </Alert>
      ) : (
        <>
          {!manage && (
            <div className="mb-6">
              <Alert tone="info">{workflow.approvalRequired ? "Only the founder can set up or change repeating tasks, because they go straight onto the board." : "You can see these but not change them."}</Alert>
            </div>
          )}
          <RepeatManager brandId={brand.id} members={members} rows={items} canManage={manage} today={today} />
        </>
      )}
    </div>
  );
}
