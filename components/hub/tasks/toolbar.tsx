import Link from "next/link";
import { CalendarDays, KanbanSquare, List, Repeat, Search } from "lucide-react";
import { segItem, segWrap } from "@/components/brand/styles";
import type { Member, Priority, WorkflowStatus } from "@/lib/hub/tasks/model";
import { PRIORITIES, PRIORITY_LABEL } from "@/lib/hub/tasks/model";
import { cn } from "@/lib/utils";
import { compactField } from "./parts";

export type View = "list" | "board" | "calendar";
export type Query = { v: View; q?: string; assignee?: string; status?: string; priority?: string; m?: string; due?: string };

/** Builds ?v=…&q=… keeping only what is set, so every view is a shareable link. */
export function tasksHref(slug: string, q: Partial<Query>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v && !(k === "v" && v === "list")) p.set(k, String(v));
  const s = p.toString();
  return `/hub/b/${slug}/tasks${s ? `?${s}` : ""}`;
}

const VIEWS: { key: View; label: string; icon: typeof List }[] = [
  { key: "list", label: "List", icon: List },
  { key: "board", label: "Board", icon: KanbanSquare },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
];

export function Toolbar({ slug, query, members, statuses, repeats }: { slug: string; query: Query; members: Member[]; statuses: WorkflowStatus[]; /** Show the link to the repeating tasks page. */ repeats?: boolean }) {
  const { v, ...rest } = query;
  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Task views" className={cn(segWrap, "max-w-full")}>
          {VIEWS.map(({ key, label, icon: Icon }) => (
            <Link key={key} href={tasksHref(slug, { ...rest, v: key })} aria-current={v === key ? "page" : undefined} className={cn(segItem(v === key), "gap-2")}>
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        {repeats && (
          <Link href={`/hub/b/${slug}/tasks/repeat`} className="hit-44 inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-small font-semibold text-brand-700 hover:bg-paper-100">
            <Repeat className="size-4" aria-hidden />
            Repeating tasks
          </Link>
        )}
      </div>

      {/* A plain GET form: the filters live in the URL, so a view can be bookmarked or sent to someone. */}
      <form method="get" className="flex flex-wrap items-center gap-2" role="search">
        {v !== "list" && <input type="hidden" name="v" value={v} />}
        {query.m && <input type="hidden" name="m" value={query.m} />}
        <label className="relative min-w-0 flex-1 basis-48">
          <span className="sr-only">Search tasks</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
          <input type="search" name="q" defaultValue={query.q ?? ""} placeholder="Search tasks" maxLength={80} className={cn(compactField, "w-full pl-10")} />
        </label>
        <label>
          <span className="sr-only">Assignee</span>
          <select name="assignee" defaultValue={query.assignee ?? ""} className={compactField}>
            <option value="">Everyone</option>
            <option value="me">Assigned to me</option>
            <option value="none">Unassigned</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.email.split("@")[0]}
              </option>
            ))}
          </select>
        </label>
        {v !== "board" && (
          <label>
            <span className="sr-only">Status</span>
            <select name="status" defaultValue={query.status ?? ""} className={compactField}>
              <option value="">Any status</option>
              {statuses.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className="sr-only">Priority</span>
          <select name="priority" defaultValue={query.priority ?? ""} className={compactField}>
            <option value="">Any priority</option>
            {PRIORITIES.map((p: Priority) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="hit-44 inline-flex h-11 items-center rounded-full bg-ink-800 px-5 text-button font-semibold text-paper-100 hover:bg-ink-700">
          Filter
        </button>
        {(query.q || query.assignee || query.status || query.priority || query.due) && (
          <Link href={tasksHref(slug, { v, m: query.m })} className="inline-flex min-h-11 items-center px-2 text-small font-semibold text-brand-700 underline underline-offset-4">
            Clear
          </Link>
        )}
      </form>
    </div>
  );
}
