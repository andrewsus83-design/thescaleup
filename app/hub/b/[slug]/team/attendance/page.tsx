import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { Alert, Card, EmptyState, PageHeader } from "@/components/brand/primitives";
import { btnCls, rowHeadCls, tableCls, tableWrapCls, tbodyCls, tdCls, thCls, theadCls } from "@/components/brand/styles";
import { BackLink } from "@/components/hub/back-link";
import { WorkSettingsForm } from "@/components/hub/hr/forms";
import { requireFunction } from "@/lib/hub/access";
import { getSettings, listClockIns, listLeave, listPeople, personForUser } from "@/lib/hub/hr/data";
import { attendanceFor, lastDayOf, WORKDAYS_LABEL } from "@/lib/hub/hr/model";
import { atLeast } from "@/lib/hub/permissions";
import { cn } from "@/lib/utils";
import { addDays, fmtDuration, hubTz, isMonthKey, monthKey, monthLabel, shiftMonth, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";

export default async function AttendancePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ m?: string | string[] }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { user, brand, access } = await requireFunction(slug, "team");
  const manages = atLeast(access.team, "edit");
  const tz = hubTz();
  const today = todayIn(tz);
  const asked = Array.isArray(sp.m) ? sp.m[0] : sp.m;
  const thisMonth = monthKey(today);
  // Any month up to this one; a month that has not started has nothing to show.
  const month = isMonthKey(asked) && asked <= thisMonth && asked >= shiftMonth(thisMonth, -36) ? asked : thisMonth;
  const first = `${month}-01`;
  const last = lastDayOf(month);

  const [settings, mine, everyone] = await Promise.all([getSettings(brand.id), personForUser(brand.id, user.id), manages ? listPeople(brand.id) : Promise.resolve([])]);
  // Attendance comes from clock-ins, so it only exists for people whose record is linked to a sign-in.
  // Someone who manages the team sees everyone; everyone else sees their own month.
  const people = (manages ? everyone : mine ? [mine] : []).filter((p) => p.userId && (p.status === "active" || (p.endDate ?? "") >= first));
  const unlinked = manages ? everyone.filter((p) => p.status === "active" && !p.userId).length : 0;
  const [clockIns, leave] = await Promise.all([
    // a day of slack on each side: the month is in the brand's time zone, the query is in UTC
    people.length ? listClockIns(brand.id, `${addDays(first, -1)}T00:00:00Z`, `${addDays(last, 2)}T00:00:00Z`, manages ? undefined : user.id) : Promise.resolve([]),
    people.length ? listLeave(brand.id, first, manages ? undefined : mine?.id) : Promise.resolve([]),
  ]);
  const rows = people.map((p) => ({
    p,
    a: attendanceFor({
      clockIns: clockIns.filter((e) => e.user_id === p.userId),
      month,
      today,
      tz,
      settings,
      leave: leave.filter((l) => l.personId === p.id && l.status === "approved"),
      startDate: p.startDate,
      endDate: p.status === "left" ? p.endDate : null,
    }),
  }));
  const href = (m: string) => `/hub/b/${slug}/team/attendance?m=${m}`;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <BackLink href={`/hub/b/${slug}/team`}>Team</BackLink>
      <PageHeader title="Attendance" description={manages ? "The team's month, counted from their clock-ins." : "Your month, counted from your clock-ins."} />

      <nav aria-label="Month" className="mb-6 flex flex-wrap items-center gap-3">
        <Link href={href(shiftMonth(month, -1))} className={btnCls("secondary", "sm")}>
          Earlier
        </Link>
        <p className="font-title text-h4 text-ink-800" aria-live="polite">
          {monthLabel(month)}
        </p>
        {month < thisMonth && (
          <Link href={href(shiftMonth(month, 1))} className={btnCls("secondary", "sm")}>
            Later
          </Link>
        )}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck className="size-6" aria-hidden />}
          title={manages ? "No one to count yet" : "No attendance for you yet"}
          hint={manages ? "Attendance is counted for people whose record is linked to a sign-in. Add people under Team, People and link their sign-in." : "Ask whoever manages the team to add your people record and link it to your sign-in."}
        />
      ) : (
        <div className={tableWrapCls}>
          <table className={cn(tableCls, "min-w-xl")}>
            <caption className="sr-only">Attendance in {monthLabel(month)}</caption>
            <thead className={theadCls}>
              <tr>
                {["Person", "Days present", "Late", "On leave", "No clock-in", "Hours"].map((h, i) => (
                  <th key={h} scope="col" className={thCls(i > 0)}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={tbodyCls}>
              {rows.map(({ p, a }) => (
                <tr key={p.id}>
                  <th scope="row" className={rowHeadCls}>
                    {manages ? (
                      <Link href={`/hub/b/${slug}/team/people/${p.id}`} className="underline underline-offset-4">
                        {p.name}
                      </Link>
                    ) : (
                      p.name
                    )}
                  </th>
                  <td className={tdCls(true)}>{a.present}</td>
                  <td className={tdCls(true)}>{a.late}</td>
                  <td className={tdCls(true)}>{a.onLeave}</td>
                  <td className={tdCls(true)}>{a.noClockIn}</td>
                  <td className={tdCls(true)}>{fmtDuration(a.minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 space-y-3">
        <p className="text-small text-ink-500">
          Late means the first clock-in of the day came more than {settings.lateAfterMin} minutes after {settings.workStart}. Working days are {WORKDAYS_LABEL[settings.workdays].toLowerCase()}.
        </p>
        <p className="text-small text-ink-500">No clock-in counts working days before today with no clock-in and no approved leave. The hub does not know public holidays, and people forget to clock in, so treat it as a reason to ask, not as an absence.</p>
        {unlinked > 0 && (
          <Alert tone="info">
            {unlinked === 1 ? "One active person has" : `${unlinked} active people have`} no sign-in linked, so they are not counted here.
          </Alert>
        )}
      </div>

      {manages && (
        <section aria-labelledby="att-set" className="mt-10">
          <h2 id="att-set" className="mb-3 font-title text-h3 text-ink-800">
            Working hours
          </h2>
          <Card>
            <WorkSettingsForm brandId={brand.id} settings={settings} />
          </Card>
        </section>
      )}
    </div>
  );
}
