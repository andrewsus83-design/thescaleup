import type { Metadata } from "next";
import { Alert, PageHeader } from "@/components/brand/primitives";
import { AddPanel } from "@/components/hub/tasks/add-panel";
import { Board, type BoardCard } from "@/components/hub/tasks/board";
import { CalendarView } from "@/components/hub/tasks/calendar-view";
import { ListView } from "@/components/hub/tasks/list-view";
import { Toolbar, type Query, type View } from "@/components/hub/tasks/toolbar";
import { requireFunction } from "@/lib/hub/access";
import { getWorkflow, hasAiKey, listMembers, listTasks } from "@/lib/hub/tasks/data";
import { monthGrid, parseMonth } from "@/lib/hub/tasks/calendar";
import { addDays, dayIn, hubTz, isIsoDate, todayIn } from "@/lib/hub/tasks/dates";
import { allowedStatuses, canCreate, canDecide, canSeeStage } from "@/lib/hub/tasks/rules";

export const metadata: Metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TasksPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { user, brand, actor, access } = await requireFunction(slug, "tasks");
  const who = { actor, level: access.tasks, userId: user.id };
  const tz = hubTz();
  const today = todayIn(tz);
  const [workflow, members] = await Promise.all([getWorkflow(brand.id), listMembers(brand.id)]);

  const rawView = one(sp.v);
  const v: View = rawView === "board" || rawView === "calendar" ? rawView : "list";
  const due = one(sp.due);
  const month = parseMonth(one(sp.m), today);
  const query: Query = {
    v,
    q: one(sp.q)?.slice(0, 80),
    assignee: one(sp.assignee),
    status: one(sp.status),
    priority: one(sp.priority),
    m: v === "calendar" && one(sp.m) ? month : undefined,
    due: due && isIsoDate(due) ? due : undefined,
  };
  const base = { userId: user.id, q: query.q, assignee: query.assignee, priority: query.priority };
  const filtered = !!(query.q || query.assignee || query.status || query.priority || query.due);
  const canAdd = canCreate(who);
  const visible = workflow.statuses.filter((s) => canSeeStage(actor, s.stage));

  let body: React.ReactNode;
  if (v === "calendar") {
    const grid = monthGrid(month);
    const [tasks, loose] = await Promise.all([
      listTasks(brand.id, actor, { ...base, dueFrom: grid[0][0].iso, dueTo: grid[grid.length - 1][6].iso }),
      listTasks(brand.id, actor, { ...base, noDue: true, limit: 1000 }),
    ]);
    const unscheduled = loose.filter((t) => t.stage !== "closed" && t.stage !== "rejected").length;
    body = <CalendarView slug={slug} tasks={tasks} month={month} today={today} query={query} workflow={workflow} unscheduled={unscheduled} />;
  } else if (v === "board") {
    const all = await listTasks(brand.id, actor, base);
    // Finished work piles up: the board keeps the last 30 days, and the list has the rest.
    const since = addDays(today, -30);
    const tasks = all.filter((t) => t.stage !== "closed" || dayIn(tz, t.completed_at ?? t.updated_at) >= since);
    const email = new Map(members.map((m) => [m.userId, m.email]));
    const cards: BoardCard[] = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due: t.due_date,
      assigneeEmail: t.assignee_id ? (email.get(t.assignee_id) ?? null) : null,
      tags: t.tags,
      moves: allowedStatuses(who, t, workflow).map((s) => s.key),
      closed: t.stage === "closed",
    }));
    body = (
      <>
        <Board slug={slug} brandId={brand.id} columns={visible} cards={cards} today={today} />
        {all.length > tasks.length && <p className="mt-4 text-caption text-ink-500">Done shows the last 30 days. Older finished tasks are in the List view.</p>}
      </>
    );
  } else {
    const tasks = await listTasks(brand.id, actor, { ...base, status: query.status, due: query.due });
    body = <ListView slug={slug} brandId={brand.id} tasks={tasks} workflow={workflow} members={members} today={today} canDecide={canDecide(who)} filtered={filtered} />;
  }

  return (
    <div>
      <PageHeader title="Tasks" description={access.tasks === "view" ? "You can see tasks here. Ask the founder if you need to change them." : "Add work, move it along, and approve what the team proposes."} />
      {canAdd && <AddPanel brandId={brand.id} members={members} withAi={await hasAiKey(brand.id)} />}
      {!canAdd && actor === "ops" && (
        <div className="mb-6">
          <Alert tone="info">You see the tasks assigned to you and the rest of the team&apos;s approved work. You can move your own tasks and comment.</Alert>
        </div>
      )}
      <Toolbar slug={slug} query={query} members={members} statuses={visible} />
      {body}
    </div>
  );
}
