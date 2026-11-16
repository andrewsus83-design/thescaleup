import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { iconBtnCls, segItem, segWrap } from "@/components/brand/styles";
import { byDay, monthGrid } from "@/lib/hub/tasks/calendar";
import { fmtDay, monthLabel, shiftMonth, WEEKDAYS_SHORT } from "@/lib/hub/tasks/dates";
import type { Task, Workflow } from "@/lib/hub/tasks/model";
import { cn } from "@/lib/utils";
import { STAGE_DOT } from "./parts";
import { tasksHref, type Query } from "./toolbar";

type Props = { slug: string; tasks: Task[]; month: string; today: string; query: Query; workflow: Workflow; unscheduled: number };

function TaskLink({ t, slug, today }: { t: Task; slug: string; today: string }) {
  const overdue = t.stage !== "closed" && !!t.due_date && t.due_date < today;
  return (
    <Link
      href={`/hub/b/${slug}/tasks/${t.id}`}
      title={t.title}
      className={cn("flex min-h-6 items-center gap-1.5 rounded-lg px-1.5 text-caption hover:bg-paper-100", overdue ? "font-semibold text-danger" : t.stage === "closed" ? "text-ink-500 line-through" : "text-ink-800")}
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", STAGE_DOT[t.stage])} />
      <span className="truncate">{t.title}</span>
    </Link>
  );
}

/** A month of due dates. A grid from tablet width up; on phones a day-by-day agenda reads better than seven tiny columns. */
export function CalendarView({ slug, tasks, month, today, query, unscheduled }: Props) {
  const grid = monthGrid(month);
  const days = byDay(tasks);
  const nav = (m: string) => tasksHref(slug, { ...query, v: "calendar", m });
  const agenda = [...days.keys()].filter((d) => d.startsWith(month)).sort();
  const thisMonth = today.slice(0, 7);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-title text-h3 text-ink-800" aria-live="polite">
          {monthLabel(month)}
        </h2>
        <div className="flex items-center gap-2">
          <Link href={nav(shiftMonth(month, -1))} className={iconBtnCls("quiet")} aria-label="Previous month">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <nav className={segWrap}>
            <Link href={nav(thisMonth)} aria-current={month === thisMonth ? "date" : undefined} className={segItem(month === thisMonth, "sm")}>
              Today
            </Link>
          </nav>
          <Link href={nav(shiftMonth(month, 1))} className={iconBtnCls("quiet")} aria-label="Next month">
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        </div>
      </div>

      {/* tablet and up: the grid */}
      <div role="grid" aria-label={monthLabel(month)} className="hidden overflow-hidden rounded-card border border-hairline bg-hairline shadow-raised md:grid md:grid-cols-7 md:gap-px">
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d} role="columnheader" className="bg-paper-50 px-3 py-2 text-caption font-semibold text-ink-500">
            {d}
          </div>
        ))}
        {grid.flat().map(({ iso, inMonth }) => {
          const list = days.get(iso) ?? [];
          const isToday = iso === today;
          return (
            <div key={iso} role="gridcell" aria-label={fmtDay(iso)} className={cn("min-h-28 p-2", inMonth ? "bg-paper-0" : "bg-paper-50")}>
              <span className={cn("mb-1 inline-flex size-7 items-center justify-center rounded-full text-caption font-semibold", isToday ? "bg-ink-800 text-paper-100" : inMonth ? "text-ink-800" : "text-ink-300")}>{Number(iso.slice(8))}</span>
              <div className="space-y-0.5">
                {list.slice(0, 3).map((t) => (
                  <TaskLink key={t.id} t={t} slug={slug} today={today} />
                ))}
                {list.length > 3 && (
                  <Link href={tasksHref(slug, { ...query, v: "list", due: iso })} className="block px-1.5 text-caption font-semibold text-brand-700 underline underline-offset-4">
                    +{list.length - 3} more
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* phones: the agenda */}
      <div className="space-y-6 md:hidden">
        {agenda.length === 0 && <p className="rounded-card border-control border-dashed border-ink-200 px-5 py-10 text-center text-body text-ink-500">Nothing is due in {monthLabel(month)}.</p>}
        {agenda.map((d) => (
          <section key={d}>
            <h3 className={cn("mb-2 text-small font-semibold", d === today ? "text-brand-700" : "text-ink-800")}>{d === today ? `Today, ${fmtDay(d)}` : fmtDay(d)}</h3>
            <ul className="divide-y divide-hairline overflow-hidden rounded-bubble border border-hairline bg-paper-0 px-2 py-1">
              {days.get(d)!.map((t) => (
                <li key={t.id} className="py-1">
                  <TaskLink t={t} slug={slug} today={today} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {unscheduled > 0 && (
        <p className="mt-4 text-small text-ink-500">
          {unscheduled} {unscheduled === 1 ? "task has" : "tasks have"} no due date and {unscheduled === 1 ? "does" : "do"} not show here.{" "}
          <Link href={tasksHref(slug, { ...query, v: "list" })} className="font-semibold text-brand-700 underline underline-offset-4">
            See them in the list
          </Link>
        </p>
      )}
    </div>
  );
}
