import type { Metadata } from "next";
import { CalendarDays, CheckSquare, Clock, Landmark, Target } from "lucide-react";
import { PageHeader } from "@/components/brand/primitives";
import { SectionList, type SectionItem } from "@/components/hub/section-list";
import { requireFunction } from "@/lib/hub/access";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { access } = await requireFunction(slug, "team");
  const items: SectionItem[] = [
    { key: "tasks", title: "Team tasks", hint: "Who is working on what, and what is waiting", icon: CheckSquare, soon: true },
    { key: "clock", title: "Clock in and out", hint: "Start and end the working day from your phone", icon: Clock, soon: true },
    { key: "kpi", title: "KPI and deliverables", hint: "Tasks done on time and late, per person", icon: Target, soon: true },
    { key: "calendar", title: "Calendar", hint: "Deadlines, days off and shifts", icon: CalendarDays, soon: true },
  ];
  // Pay is sensitive: the row only shows to roles that were given access to it.
  if (access.payroll !== "none") items.push({ key: "payroll", title: "Salary and payroll", hint: "Pay, payslips and payroll runs", icon: Landmark, soon: true });
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Team" description="Keep it simple: tasks, hours, results and the calendar." />
      <SectionList items={items} />
    </div>
  );
}
