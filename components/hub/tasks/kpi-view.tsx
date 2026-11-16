import { Target } from "lucide-react";
import { BudgetPanel, Chip, EmptyState } from "@/components/brand/primitives";
import { fmtDuration } from "@/lib/hub/tasks/dates";
import { MIN_JUDGED, type Kpi } from "@/lib/hub/tasks/kpi";
import { shortName, type Member } from "@/lib/hub/tasks/model";
import { Avatar } from "./parts";

function counts(k: Kpi) {
  return [`${k.onTime} on time`, `${k.late} late`, `${k.missed} missed`].join(", ") + (k.pending ? `, ${k.pending} due today` : "");
}

type Props = {
  /** The founder sees the team and everyone in it; everyone else sees only their own numbers. */
  manager: boolean;
  team: Kpi;
  people: ReadonlyMap<string, Kpi>;
  members: Member[];
  minutes: ReadonlyMap<string, number>;
  needsReview: ReadonlyMap<string, number>;
  userId: string;
};

const NONE: Kpi = { onTime: 0, late: 0, missed: 0, pending: 0, judged: 0, index: null };

/** The index panel and one row per person, alphabetical. Never sorted by score: this is a mirror, not a scoreboard. */
export function KpiView({ manager, team, people, members, minutes, needsReview, userId }: Props) {
  if (team.judged + team.pending === 0) {
    return <EmptyState icon={<Target className="size-6" aria-hidden />} title="No deliverables in this window" hint="Give approved tasks an assignee and a due date. When they are done or overdue they count here." />;
  }
  const hero = manager ? team : (people.get(userId) ?? NONE);
  const shown = (manager ? members : members.filter((m) => m.userId === userId)).slice().sort((a, b) => a.email.localeCompare(b.email));
  return (
    <div className="space-y-8">
      <BudgetPanel label={manager ? "Team index" : "Your index"} figure={hero.index ?? "–"} unit={hero.index === null ? undefined : "of 100"}>
        <p className="text-small text-paper-100">{counts(hero)}.</p>
        {hero.index === null && <p className="mt-1 text-caption text-ink-300">The index needs at least {MIN_JUDGED} finished or missed deliverables. Until then only the counts show.</p>}
      </BudgetPanel>

      <ul className="space-y-3" aria-label="People">
        {shown.map((m) => {
          const k = people.get(m.userId);
          const mins = minutes.get(m.userId) ?? 0;
          const review = needsReview.get(m.userId) ?? 0;
          return (
            <li key={m.userId} className="rounded-card border-control border-ink-200 bg-paper-0 p-4">
              <div className="flex items-center gap-4">
                <Avatar person={m} />
                <p className="min-w-0 flex-1 truncate text-body font-semibold text-ink-800">{shortName(m.email)}</p>
                <p className="shrink-0 text-right">
                  <span className="font-title text-h3 text-ink-800">{k?.index ?? "–"}</span>
                  {k?.index != null && <span className="ml-1 text-caption text-ink-500">of 100</span>}
                </p>
              </div>
              <p className="mt-3 text-small text-ink-500">{k ? `${counts(k)}.` : "No deliverables in this window."}</p>
              <p className="mt-1 text-small text-ink-500">
                Hours clocked: <span className="font-semibold text-ink-800">{mins > 0 ? fmtDuration(mins) : "none"}</span>
              </p>
              {review > 0 && (
                <p className="mt-3">
                  <Chip tone="warn">{review === 1 ? "1 clock entry needs review" : `${review} clock entries need review`}</Chip>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
