import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { Chip, EmptyState, PageHeader } from "@/components/brand/primitives";
import { BackLink } from "@/components/hub/back-link";
import { ClockCard } from "@/components/hub/tasks/clock-card";
import { parseDays, WindowSwitch } from "@/components/hub/tasks/window-switch";
import { requireFunction } from "@/lib/hub/access";
import { getOpenEntry, listEntries, listMembers } from "@/lib/hub/tasks/data";
import { addDays, dayIn, fmtDay, fmtDuration, fmtStamp, fmtTime, hubTz, todayIn } from "@/lib/hub/tasks/dates";
import { hoursByPerson, MAX_ENTRY_MINUTES, windowFor } from "@/lib/hub/tasks/kpi";
import { shortName } from "@/lib/hub/tasks/model";

export const metadata: Metadata = { title: "Hours" };
export const dynamic = "force-dynamic";

export default async function ClockPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ d?: string | string[] }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { user, brand, actor } = await requireFunction(slug, "team");
  const days = parseDays(Array.isArray(sp.d) ? sp.d[0] : sp.d);
  const tz = hubTz();
  const today = todayIn(tz);
  const win = windowFor(days, today);
  // Hours are pay-adjacent, so only the founder (and the agency) see other people's. Everyone else sees their own.
  const manager = actor === "owner" || actor === "founder";
  const [open, entries, members] = await Promise.all([
    getOpenEntry(brand.id, user.id),
    // one day of slack on the left: the window is in the brand's time zone, the query is in UTC
    listEntries(brand.id, `${addDays(win.from, -1)}T00:00:00Z`, manager ? undefined : user.id),
    listMembers(brand.id),
  ]);
  const inWindow = entries.filter((e) => {
    const d = dayIn(tz, e.clock_in);
    return d >= win.from && d <= win.to;
  });
  const { minutes, needsReview } = hoursByPerson(inWindow, win, tz);
  const name = new Map(members.map((m) => [m.userId, shortName(m.email)]));
  const people = [...new Set(inWindow.map((e) => e.user_id))].sort((a, b) => (name.get(a) ?? "").localeCompare(name.get(b) ?? ""));

  return (
    <div className="mx-auto w-full max-w-2xl">
      <BackLink href={`/hub/b/${slug}/team`}>Team</BackLink>
      <PageHeader title="Hours" description={manager ? "Clock-ins for the whole team." : "Your clock-ins."} />
      <div className="mb-8 space-y-6">
        <ClockCard brandId={brand.id} sinceLabel={open ? fmtStamp(open.clock_in, tz, today) : null} />
        <WindowSwitch href={`/hub/b/${slug}/team/clock`} days={days} />
      </div>

      {!inWindow.length ? (
        <EmptyState icon={<Clock className="size-6" aria-hidden />} title="No hours in this window" hint="Clock in when you start and clock out when you stop. It shows up here." />
      ) : (
        <div className="space-y-8">
          {people.map((id) => {
            const rows = inWindow.filter((e) => e.user_id === id);
            const flagged = needsReview.get(id) ?? 0;
            return (
              <section key={id} aria-label={name.get(id) ?? "Former member"}>
                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {manager && <h2 className="font-title text-h3 text-ink-800">{name.get(id) ?? "Former member"}</h2>}
                  <p className="text-small text-ink-500">
                    <span className="font-semibold text-ink-800">{fmtDuration(minutes.get(id) ?? 0)}</span> in {days} days
                  </p>
                  {flagged > 0 && <Chip tone="warn">{flagged === 1 ? "1 entry needs review" : `${flagged} entries need review`}</Chip>}
                </div>
                <ul className="divide-y divide-ink-100 rounded-field border-control border-ink-200">
                  {rows.map((e) => {
                    const span = e.clock_out ? (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 60_000 : null;
                    const stale = span === null ? (Date.now() - new Date(e.clock_in).getTime()) / 60_000 > MAX_ENTRY_MINUTES : span > MAX_ENTRY_MINUTES;
                    return (
                      <li key={e.id} className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-small">
                        <span className="text-ink-800">{fmtDay(dayIn(tz, e.clock_in))}</span>
                        <span className="text-ink-500">
                          {fmtTime(e.clock_in, tz)} to {e.clock_out ? fmtTime(e.clock_out, tz) : "now"}
                        </span>
                        <span className="font-semibold text-ink-800">
                          {stale ? "Needs review" : span === null ? "Running" : fmtDuration(span)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
