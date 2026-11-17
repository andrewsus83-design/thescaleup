import { Flag, ListChecks, UserRound } from "lucide-react";
import { dueInfo } from "@/lib/hub/tasks/dates";
import { initials, PRIORITY_LABEL, SOURCE_LABEL, type Member, type Priority, type Stage, type TaskSource } from "@/lib/hub/tasks/model";
import { cn } from "@/lib/utils";

// Small pieces shared by the list, board, calendar and task page. No hooks and no "use client": any component can use them.
// Colour is never the only signal: every status has a dot AND a word, every priority a flag AND a word.

export const STAGE_DOT: Record<Stage, string> = {
  proposed: "bg-warning",
  active: "bg-info",
  review: "bg-brand-500",
  closed: "bg-success",
  rejected: "bg-danger",
};

export function StatusLabel({ label, stage, className }: { label: string; stage: Stage; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-caption font-semibold text-ink-800", className)}>
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", STAGE_DOT[stage])} />
      {label}
    </span>
  );
}

export function PriorityMark({ priority }: { priority: Priority }) {
  if (priority === "normal") return null;
  const tone = priority === "urgent" ? "text-danger" : priority === "high" ? "text-brand-700" : "text-ink-500";
  return (
    <span className={cn("inline-flex items-center gap-1 text-caption font-semibold", tone)}>
      <Flag className="size-3.5" aria-hidden />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function DueLabel({ due, today, closed }: { due: string | null; today: string; closed?: boolean }) {
  if (!due) return null;
  const { label, tone } = dueInfo(due, today, closed);
  return <span className={cn("text-caption", tone === "bad" ? "font-semibold text-danger" : tone === "warn" ? "font-semibold text-ink-800" : "text-ink-500")}>{label}</span>;
}

export function Avatar({ person, size = "md" }: { person: Pick<Member, "email"> | null | undefined; size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-6 text-micro" : "size-8 text-micro";
  if (!person) {
    return (
      <span role="img" aria-label="Unassigned" title="Unassigned" className={cn("inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-ink-200 text-ink-300", box)}>
        <UserRound className={size === "sm" ? "size-3" : "size-4"} aria-hidden />
      </span>
    );
  }
  return (
    <span role="img" aria-label={person.email} title={person.email} className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-paper-200 font-semibold text-ink-800", box)}>
      {initials(person.email)}
    </span>
  );
}

export function SourceTag({ source }: { source: TaskSource }) {
  if (source === "manual") return null;
  return <span className="inline-flex h-6 items-center rounded-full bg-paper-200 px-2.5 text-micro font-semibold text-ink-500">{SOURCE_LABEL[source]}</span>;
}

export function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
      {tags.map((t) => (
        <li key={t} className="inline-flex h-6 items-center rounded-full bg-paper-200 px-2.5 text-micro font-medium text-ink-500">
          {t}
        </li>
      ))}
    </ul>
  );
}

/** Compact field styles for the filter bar and the task form (the brand Input is 56px, too tall for a toolbar). */
export const compactField =
  "h-11 rounded-full border-control border-ink-200 bg-paper-0 px-4 text-small text-ink-800 outline-none placeholder:text-ink-500 focus-visible:border-ink-800 focus-visible:shadow-focus";

/** "3/5" with a checklist icon, for a card or a row. Nothing when the task has no checklist. */
export function ChecklistChip({ progress }: { progress?: { done: number; total: number } }) {
  if (!progress || progress.total === 0) return null;
  const all = progress.done === progress.total;
  return (
    <span className={cn("inline-flex items-center gap-1 text-caption", all ? "text-success" : "text-ink-500")}>
      <ListChecks className="size-3.5" aria-hidden />
      <span aria-hidden>
        {progress.done}/{progress.total}
      </span>
      <span className="sr-only">
        {progress.done} of {progress.total} checklist items done
      </span>
    </span>
  );
}
