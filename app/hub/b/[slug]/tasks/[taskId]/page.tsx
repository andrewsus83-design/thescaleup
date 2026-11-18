import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Btn, Card } from "@/components/brand/primitives";
import { BackLink } from "@/components/hub/back-link";
import { Checklist } from "@/components/hub/tasks/checklist";
import { Comments } from "@/components/hub/tasks/comments";
import { DoWithAi } from "@/components/hub/tasks/do-with-ai";
import { Avatar, DueLabel, PriorityMark, SourceTag, StatusLabel, TagList } from "@/components/hub/tasks/parts";
import { CommentComposer, DecisionPanel, SummarizeButton, TaskForm } from "@/components/hub/tasks/task-detail";
import { requireFunction } from "@/lib/hub/access";
import { deleteTask } from "@/lib/hub/task-actions";
import { pickJob } from "@/lib/hub/tasks/do-ai";
import { getTask, getWorkflow, hasAiKey, listComments, listItems, listMembers } from "@/lib/hub/tasks/data";
import { fmtDay, hubTz, todayIn } from "@/lib/hub/tasks/dates";
import { shortName } from "@/lib/hub/tasks/model";
import { allowedStatuses, canComment, canDecide, canDelete, canEditFields } from "@/lib/hub/tasks/rules";
import { atLeast } from "@/lib/hub/permissions";

export const metadata: Metadata = { title: "Task" };
export const dynamic = "force-dynamic";
// "Do with AI" is a server action called from this page: it runs under this limit.
export const maxDuration = 120;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-caption font-semibold text-ink-500">{label}</dt>
      <dd className="mt-1 text-body text-ink-800">{children}</dd>
    </div>
  );
}

export default async function TaskPage({ params }: { params: Promise<{ slug: string; taskId: string }> }) {
  const { slug, taskId } = await params;
  const { user, brand, actor, access } = await requireFunction(slug, "tasks");
  const task = await getTask(brand.id, taskId, actor);
  if (!task) notFound();

  const who = { actor, level: access.tasks, userId: user.id };
  const tz = hubTz();
  const today = todayIn(tz);
  const [workflow, members, comments, items] = await Promise.all([getWorkflow(brand.id), listMembers(brand.id), listComments(brand.id, task.id), listItems(brand.id, task.id)]);
  const status = workflow.statuses.find((s) => s.key === task.status);
  const assignee = members.find((m) => m.userId === task.assignee_id);
  const statuses = allowedStatuses(who, task, workflow);
  const editFields = canEditFields(who, task);
  const editable = editFields || statuses.length > 1;
  const canTick = editFields || (actor === "ops" && atLeast(access.tasks, "edit") && task.assignee_id === user.id);
  const aiReady = canComment(who) && (await hasAiKey(brand.id));
  const doAi = canComment(who) && task.stage !== "rejected";

  return (
    <div className="w-full">
      <BackLink href={`/hub/b/${slug}/tasks`}>Tasks</BackLink>

      <header className="mb-8">
        <h1 className="font-title text-balance text-h2 text-ink-800">{task.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {status && <StatusLabel label={status.label} stage={task.stage} />}
          <PriorityMark priority={task.priority} />
          <DueLabel due={task.due_date} today={today} closed={task.stage === "closed"} />
          <SourceTag source={task.source} />
        </div>
        <div className="mt-3">
          <TagList tags={task.tags} />
        </div>
      </header>

      <div className="space-y-10">
        {task.stage === "proposed" && canDecide(who) && <DecisionPanel brandId={brand.id} taskId={task.id} />}

        <section aria-labelledby="details">
          <h2 id="details" className="mb-4 font-title text-h3 text-ink-800">
            Details
          </h2>
          {editable ? (
            <TaskForm
              brandId={brand.id}
              fields={editFields}
              members={members}
              statuses={statuses}
              values={{
                id: task.id,
                title: task.title,
                description: task.description ?? "",
                status: task.status,
                assigneeId: task.assignee_id ?? "",
                priority: task.priority,
                startDate: task.start_date ?? "",
                dueDate: task.due_date ?? "",
                tags: task.tags.join(", "),
              }}
            />
          ) : (
            <Card small>
              <dl className="grid gap-5 sm:grid-cols-2">
                <Fact label="Assignee">
                  <span className="inline-flex items-center gap-2">
                    <Avatar person={assignee} size="sm" />
                    {assignee ? shortName(assignee.email) : "Unassigned"}
                  </span>
                </Fact>
                <Fact label="Due">{task.due_date ? fmtDay(task.due_date) : "No due date"}</Fact>
                {task.start_date && <Fact label="Start">{fmtDay(task.start_date)}</Fact>}
              </dl>
              {task.description && <p className="mt-5 whitespace-pre-wrap break-words text-body text-ink-800">{task.description}</p>}
            </Card>
          )}
          {editable && !editFields && (
            <p className="mt-3 text-caption text-ink-500">You can change the status of tasks assigned to you. The founder or staff change the rest.</p>
          )}
        </section>

        {(items.length > 0 || editFields || canTick) && (
          <section aria-labelledby="checklist">
            <h2 id="checklist" className="mb-4 font-title text-h3 text-ink-800">
              Checklist
            </h2>
            <Checklist brandId={brand.id} taskId={task.id} initial={items} canEdit={editFields} canTick={canTick} />
          </section>
        )}

        {doAi && (
          <section aria-labelledby="do-ai">
            <h2 id="do-ai" className="mb-4 font-title text-h3 text-ink-800">
              Do with AI
            </h2>
            {aiReady ? (
              <DoWithAi
                brandId={brand.id}
                taskId={task.id}
                taskTitle={task.title}
                slug={slug}
                startJob={pickJob(task.title, [task.description ?? "", ...items.map((i) => i.body)])}
                canWiki={atLeast(access.wiki, "edit")}
              />
            ) : (
              <p className="text-small text-ink-500">Add an Anthropic key in Settings → Integrations to use AI on tasks.</p>
            )}
          </section>
        )}

        <section aria-labelledby="comments" className="space-y-6">
          <h2 id="comments" className="font-title text-h3 text-ink-800">
            Comments
          </h2>
          <Comments comments={comments} members={members} tz={tz} />
          {canComment(who) && <CommentComposer brandId={brand.id} taskId={task.id} />}
          {aiReady && <SummarizeButton brandId={brand.id} taskId={task.id} />}
        </section>

        {canDelete(who, task) && (
          <section aria-labelledby="danger">
            <h2 id="danger" className="sr-only">
              Delete
            </h2>
            <details className="rounded-field border-control border-ink-200 p-4">
              <summary className="min-h-11 cursor-pointer list-none text-small font-semibold text-danger [&::-webkit-details-marker]:hidden">Delete this task</summary>
              <form action={deleteTask} className="mt-3 space-y-3">
                <input type="hidden" name="brandId" value={brand.id} />
                <input type="hidden" name="taskId" value={task.id} />
                <p className="text-small text-ink-500">This removes the task, its checklist and its comments for everyone. It cannot be undone.</p>
                <Btn type="submit" variant="danger">
                  Delete task
                </Btn>
              </form>
            </details>
          </section>
        )}
      </div>
    </div>
  );
}
