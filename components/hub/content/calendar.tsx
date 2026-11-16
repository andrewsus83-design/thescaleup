import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Chip } from "@/components/brand/primitives";
import { iconBtnCls, segItem, segWrap } from "@/components/brand/styles";
import type { ContentCard } from "@/lib/hub/content/data";
import { CHANNEL_LABEL, STATUS_LABEL, STATUS_TONE, groupByDay, type Status } from "@/lib/hub/content/model";
import { monthGrid } from "@/lib/hub/tasks/calendar";
import { fmtDay, monthLabel, shiftMonth, WEEKDAYS_SHORT } from "@/lib/hub/tasks/dates";
import { cn } from "@/lib/utils";

const DOT: Record<Status, string> = { idea: "bg-ink-300", draft: "bg-info", review: "bg-warning", approved: "bg-success", posted: "bg-ink-500" };

function Piece({ it, slug }: { it: ContentCard; slug: string }) {
  const where = it.channel ? CHANNEL_LABEL[it.channel] : "No channel";
  return (
    <Link href={`/hub/b/${slug}/content/${it.id}`} title={`${it.title} (${where}, ${STATUS_LABEL[it.status]})`} className={cn("flex min-h-6 items-center gap-1.5 rounded-lg px-1.5 text-caption hover:bg-paper-100", it.status === "posted" ? "text-ink-500" : "text-ink-800")}>
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", DOT[it.status])} />
      <span className="sr-only">{STATUS_LABEL[it.status]}: </span>
      <span className="truncate">{it.title}</span>
    </Link>
  );
}

/** A month of planned pieces: a grid from tablet width up, a day-by-day agenda on phones. Pieces with no day are listed underneath. */
export function ContentCalendar({ slug, items, month, today, unscheduled }: { slug: string; items: ContentCard[]; month: string; today: string; unscheduled: { items: ContentCard[]; total: number } }) {
  const grid = monthGrid(month);
  const days = groupByDay(items);
  const agenda = [...days.keys()].filter((d) => d.startsWith(month)).sort();
  const href = (m: string) => `/hub/b/${slug}/content?m=${m}`;
  const thisMonth = today.slice(0, 7);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-title text-h3 text-ink-800" aria-live="polite">
          {monthLabel(month)}
        </h2>
        <div className="flex items-center gap-2">
          <Link href={href(shiftMonth(month, -1))} className={iconBtnCls("quiet")} aria-label="Previous month">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <nav className={segWrap}>
            <Link href={href(thisMonth)} aria-current={month === thisMonth ? "date" : undefined} className={segItem(month === thisMonth, "sm")}>
              Today
            </Link>
          </nav>
          <Link href={href(shiftMonth(month, 1))} className={iconBtnCls("quiet")} aria-label="Next month">
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        </div>
      </div>

      <div role="grid" aria-label={monthLabel(month)} className="hidden overflow-hidden rounded-card border border-hairline bg-hairline shadow-raised md:grid md:grid-cols-7 md:gap-px">
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d} role="columnheader" className="bg-paper-50 px-3 py-2 text-caption font-semibold text-ink-500">
            {d}
          </div>
        ))}
        {grid.flat().map(({ iso, inMonth }) => {
          const list = days.get(iso) ?? [];
          return (
            <div key={iso} role="gridcell" aria-label={fmtDay(iso)} className={cn("min-h-28 p-2", inMonth ? "bg-paper-0" : "bg-paper-50")}>
              <span className={cn("mb-1 inline-flex size-7 items-center justify-center rounded-full text-caption font-semibold", iso === today ? "bg-ink-800 text-paper-100" : inMonth ? "text-ink-800" : "text-ink-300")}>{Number(iso.slice(8))}</span>
              <div className="space-y-0.5">
                {list.slice(0, 3).map((it) => (
                  <Piece key={it.id} it={it} slug={slug} />
                ))}
                {list.length > 3 && <p className="px-1.5 text-caption font-semibold text-ink-500">+{list.length - 3} more that day</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-6 md:hidden">
        {agenda.length === 0 && <p className="rounded-card border-control border-dashed border-ink-200 px-5 py-10 text-center text-body text-ink-500">Nothing is planned in {monthLabel(month)}.</p>}
        {agenda.map((d) => (
          <section key={d}>
            <h3 className={cn("mb-2 text-small font-semibold", d === today ? "text-brand-700" : "text-ink-800")}>{d === today ? `Today, ${fmtDay(d)}` : fmtDay(d)}</h3>
            <ul className="divide-y divide-hairline overflow-hidden rounded-bubble border border-hairline bg-paper-0 px-2 py-1">
              {days.get(d)!.map((it) => (
                <li key={it.id} className="py-1">
                  <Piece it={it} slug={slug} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {unscheduled.total > 0 && (
        <section className="mt-10" aria-labelledby="no-day">
          <h3 id="no-day" className="font-title text-h4 text-ink-800">
            No day yet <span className="font-mono text-small text-ink-500">{unscheduled.total}</span>
          </h3>
          <p className="mt-1 text-small text-ink-500">Open one and pick a day to put it on the calendar.</p>
          <ul className="mt-3 divide-y divide-hairline overflow-hidden rounded-bubble border border-hairline bg-paper-0">
            {unscheduled.items.map((it) => (
              <li key={it.id}>
                <Link href={`/hub/b/${slug}/content/${it.id}`} className="flex min-h-14 items-center justify-between gap-3 px-5 py-3 hover:bg-paper-100">
                  <span className="min-w-0 truncate text-body text-ink-800">{it.title}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {it.channel && <span className="hidden text-caption text-ink-500 sm:inline">{CHANNEL_LABEL[it.channel]}</span>}
                    <Chip tone={STATUS_TONE[it.status]}>{STATUS_LABEL[it.status]}</Chip>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {unscheduled.total > unscheduled.items.length && <p className="mt-2 text-caption text-ink-500">Showing the newest {unscheduled.items.length}.</p>}
        </section>
      )}
    </div>
  );
}
