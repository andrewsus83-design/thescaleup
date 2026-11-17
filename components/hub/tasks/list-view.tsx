import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { EmptyState } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { approveInline } from "@/lib/hub/task-actions";
import type { Member, Task, Workflow, WorkflowStatus } from "@/lib/hub/tasks/model";
import { cn } from "@/lib/utils";
import { Avatar, ChecklistChip, DueLabel, PriorityMark, SourceTag, StatusLabel, TagList } from "./parts";

type Props = { slug: string; brandId: string; tasks: Task[]; workflow: Workflow; members: Member[]; today: string; canDecide: boolean; filtered: boolean; counts?: Map<string, { done: number; total: number }> };

/** One task per row. The whole row opens the task; the Approve button sits above that link. */
function Row({ t, slug, brandId, who, today, canDecide, progress }: { t: Task; slug: string; brandId: string; who: Member | undefined; today: string; canDecide: boolean; progress?: { done: number; total: number } }) {
  const closed = t.stage === "closed";
  return (
    <li className="relative flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 hover:bg-paper-50 sm:flex-nowrap">
      <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
        <Link
          href={`/hub/b/${slug}/tasks/${t.id}`}
          className={cn("block text-body font-medium after:absolute after:inset-0 hover:underline sm:truncate", closed ? "text-ink-500 line-through decoration-ink-300" : "text-ink-800")}
        >
          {t.title}
        </Link>
        {t.tags.length > 0 && (
          <div className="mt-1">
            <TagList tags={t.tags} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <SourceTag source={t.source} />
        <PriorityMark priority={t.priority} />
        <DueLabel due={t.due_date} today={today} closed={closed} />
        <ChecklistChip progress={progress} />
        <Avatar person={who} />
        {canDecide && t.stage === "proposed" && (
          <form action={approveInline} className="relative z-10">
            <input type="hidden" name="brandId" value={brandId} />
            <input type="hidden" name="taskId" value={t.id} />
            <button type="submit" className={btnCls("primary", "xs")}>
              Approve
            </button>
          </form>
        )}
      </div>
    </li>
  );
}

function Group({ status, count, collapsed, children }: { status: WorkflowStatus; count: number; collapsed: boolean; children: React.ReactNode }) {
  const head = (
    <span className="flex items-center gap-3">
      <StatusLabel label={status.label} stage={status.stage} className="text-body" />
      <span className="font-mono text-caption text-ink-500">{count}</span>
    </span>
  );
  const list = <ul className="divide-y divide-hairline overflow-hidden rounded-bubble border border-hairline bg-paper-0 shadow-raised">{children}</ul>;
  if (collapsed) {
    return (
      <details className="group">
        <summary className="mb-3 flex min-h-11 cursor-pointer list-none items-center rounded-full text-ink-800 [&::-webkit-details-marker]:hidden">{head}</summary>
        {list}
      </details>
    );
  }
  return (
    <section>
      <h2 className="mb-3 flex min-h-11 items-center">{head}</h2>
      {list}
    </section>
  );
}

export function ListView({ slug, brandId, tasks, workflow, members, today, canDecide, filtered, counts }: Props) {
  if (!tasks.length) {
    return (
      <EmptyState
        icon={<CheckSquare className="size-6" aria-hidden />}
        title={filtered ? "No tasks match these filters" : "No tasks yet"}
        hint={filtered ? "Clear a filter or search for something else." : "Add the first task, or paste notes and let AI draft them."}
      />
    );
  }
  const byStatus = new Map<string, Task[]>();
  for (const t of tasks) byStatus.set(t.status, [...(byStatus.get(t.status) ?? []), t]);
  const who = new Map(members.map((m) => [m.userId, m]));
  // Proposals first (they need a decision), then the workflow order; finished and rejected work starts collapsed.
  const order = [...workflow.statuses].sort((a, b) => Number(b.stage === "proposed") - Number(a.stage === "proposed"));
  return (
    <div className="space-y-8">
      {order.map((s) => {
        const rows = byStatus.get(s.key);
        if (!rows?.length) return null;
        return (
          <Group key={s.key} status={s} count={rows.length} collapsed={s.stage === "closed" || s.stage === "rejected"}>
            {rows.map((t) => (
              <Row key={t.id} t={t} slug={slug} brandId={brandId} who={t.assignee_id ? who.get(t.assignee_id) : undefined} today={today} canDecide={canDecide} progress={counts?.get(t.id)} />
            ))}
          </Group>
        );
      })}
    </div>
  );
}
