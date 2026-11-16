import type { Metadata } from "next";
import { PageHeader } from "@/components/brand/primitives";
import { BackLink } from "@/components/hub/back-link";
import { KpiView } from "@/components/hub/tasks/kpi-view";
import { parseDays, WindowSwitch } from "@/components/hub/tasks/window-switch";
import { requireFunction } from "@/lib/hub/access";
import { listEntries, listMembers, listTasks } from "@/lib/hub/tasks/data";
import { addDays, fmtDay, hubTz, todayIn } from "@/lib/hub/tasks/dates";
import { computeKpi, hoursByPerson, MIN_JUDGED, windowFor } from "@/lib/hub/tasks/kpi";

export const metadata: Metadata = { title: "KPI and deliverables" };
export const dynamic = "force-dynamic";

export default async function KpiPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ d?: string | string[] }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { user, brand, actor } = await requireFunction(slug, "tasks");
  const days = parseDays(Array.isArray(sp.d) ? sp.d[0] : sp.d);
  const tz = hubTz();
  const today = todayIn(tz);
  const win = windowFor(days, today);
  // The founder sees the whole team. Everyone else sees only their own numbers: this is a mirror, not a scoreboard.
  const manager = actor === "owner" || actor === "founder";

  const [members, tasks, entries] = await Promise.all([
    listMembers(brand.id),
    listTasks(brand.id, actor, { userId: user.id, dueFrom: win.from, dueTo: win.to, assignee: manager ? undefined : "me", limit: 1000 }),
    listEntries(brand.id, `${addDays(win.from, -1)}T00:00:00Z`, manager ? undefined : user.id),
  ]);
  const { team, people } = computeKpi(tasks, win, today, tz);
  const { minutes, needsReview } = hoursByPerson(entries, win, tz);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <BackLink href={`/hub/b/${slug}/team`}>Team</BackLink>
      <PageHeader title="KPI and deliverables" description={`Work with a due date, ${fmtDay(win.from)} to ${fmtDay(win.to)}.`} />
      <div className="mb-8">
        <WindowSwitch href={`/hub/b/${slug}/team/kpi`} days={days} />
      </div>

      <KpiView manager={manager} team={team} people={people} members={members} minutes={minutes} needsReview={needsReview} userId={user.id} />

      <details className="mt-10 rounded-field border-control border-ink-200 p-4">
        <summary className="min-h-11 cursor-pointer list-none text-small font-semibold text-ink-800 [&::-webkit-details-marker]:hidden">How the index is calculated</summary>
        <div className="mt-3 space-y-3 text-small text-ink-500">
          <p>A deliverable is an approved task with an assignee and a due date inside the window. Proposals and rejected tasks never count.</p>
          <p>
            On time means it was closed on or before its due day. Late means it was closed after. Missed means it is still open and the due day has passed. Tasks due today are not judged until the day is over.
          </p>
          <p>
            Index = (on time + half of late) ÷ (on time + late + missed) × 100. It shows once there are at least {MIN_JUDGED} judged deliverables.
          </p>
          <p>Hours are shown next to the index and are not part of it. People are listed alphabetically, not ranked.</p>
        </div>
      </details>
    </div>
  );
}
