import type { Metadata } from "next";
import { CalendarCheck, CalendarDays, CalendarOff, CheckSquare, Clock, Target, Users } from "lucide-react";
import { PageHeader } from "@/components/brand/primitives";
import { Split, SplitMain, SplitSide } from "@/components/hub/panels";
import { SectionList, type SectionItem } from "@/components/hub/section-list";
import { ClockCard } from "@/components/hub/tasks/clock-card";
import { requireFunction } from "@/lib/hub/access";
import { getOpenEntry } from "@/lib/hub/tasks/data";
import { fmtStamp, hubTz, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, brand, access } = await requireFunction(slug, "team");
  const open = await getOpenEntry(brand.id, user.id);
  const tz = hubTz();
  const base = `/hub/b/${slug}`;
  // Tasks, the calendar and the KPI index all come from the tasks, so they follow the Tasks access, not Team access.
  const seesTasks = access.tasks !== "none";
  const items: SectionItem[] = [];
  if (seesTasks) items.push({ key: "tasks", title: "Team tasks", hint: "Who is working on what, and what is overdue", icon: CheckSquare, href: `${base}/team/tasks` });
  items.push({ key: "clock", title: "Hours", hint: "Your clock-ins, and the team's if you manage it", icon: Clock, href: `${base}/team/clock` });
  if (seesTasks) {
    items.push({ key: "kpi", title: "KPI and deliverables", hint: "Tasks done on time, late and missed", icon: Target, href: `${base}/team/kpi` });
    items.push({ key: "calendar", title: "Calendar", hint: "Task deadlines by day", icon: CalendarDays, href: `${base}/tasks?v=calendar` });
  }
  items.push({ key: "people", title: "People", hint: "Who works here: job, employment and dates", icon: Users, href: `${base}/team/people` });
  items.push({ key: "leave", title: "Leave", hint: "Ask for time off, see what was decided", icon: CalendarOff, href: `${base}/team/leave` });
  items.push({ key: "attendance", title: "Attendance", hint: "Days present, late and on leave, month by month", icon: CalendarCheck, href: `${base}/team/attendance` });
  // Salary and payroll is not built yet, so it is not shown.
  return (
    <div>
      <PageHeader title="Team" description="Tasks, hours, people and leave in one place." />
      <Split>
        {/* Clocking in is what most people open this page for, so on a phone it comes first. */}
        <SplitSide first>
          <ClockCard brandId={brand.id} sinceLabel={open ? fmtStamp(open.clock_in, tz, todayIn(tz)) : null} ink />
        </SplitSide>
        <SplitMain>
          <SectionList items={items} twoAtMost />
        </SplitMain>
      </Split>
    </div>
  );
}
