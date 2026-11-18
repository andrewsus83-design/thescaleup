import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Chip, PageHeader, Stat, StatGrid } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { BackLink } from "@/components/hub/back-link";
import { PersonForm, StatusForm } from "@/components/hub/hr/forms";
import { requireFunction } from "@/lib/hub/access";
import { getPerson, getPrivate, getSettings, listLeave, listPeople } from "@/lib/hub/hr/data";
import { EMPLOYMENT_LABEL, leaveBalance } from "@/lib/hub/hr/model";
import { atLeast } from "@/lib/hub/permissions";
import { UUID } from "@/lib/hub/tasks/context";
import { listMembers } from "@/lib/hub/tasks/data";
import { fmtDay, hubTz, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Person" };
export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { user, brand, access } = await requireFunction(slug, "team");
  if (!UUID.test(id)) notFound();
  const person = await getPerson(brand.id, id);
  if (!person) notFound();
  const manages = atLeast(access.team, "edit");
  const own = person.userId === user.id;
  // A full record is for whoever manages the team and for the person it is about. Anyone else gets the same answer as for no record.
  if (!manages && !own) notFound();

  const today = todayIn(hubTz());
  const year = today.slice(0, 4);
  const [emergency, settings, leave, members, people] = await Promise.all([
    getPrivate(brand.id, person.id),
    getSettings(brand.id),
    listLeave(brand.id, `${year}-01-01`, person.id),
    manages ? listMembers(brand.id) : Promise.resolve([]),
    manages ? listPeople(brand.id) : Promise.resolve([]),
  ]);
  const balance = leaveBalance(leave, person.id, year, person.leaveDays ?? settings.leaveDays);
  // Sign-ins that can be linked here: this person's own, and members nobody else is linked to.
  const taken = new Set(people.filter((p) => p.id !== person.id).map((p) => p.userId));
  const linkable = members.filter((m) => !taken.has(m.userId)).map((m) => ({ userId: m.userId, email: m.email }));
  const base = `/hub/b/${slug}/team`;

  const facts: [string, string][] = [
    ["Job title", person.title || "Not set"],
    ["Employment", EMPLOYMENT_LABEL[person.employment]],
    ["Start date", person.startDate ? fmtDay(person.startDate) + " " + person.startDate.slice(0, 4) : "Not set"],
    ["Contract end date", person.endDate ? fmtDay(person.endDate) + " " + person.endDate.slice(0, 4) : "No end date"],
    ["Emergency contact", emergency || "Not set"],
  ];

  return (
    <div className="mx-auto w-full max-w-2xl">
      <BackLink href={`${base}/people`}>People</BackLink>
      <PageHeader title={person.name} description={person.title || undefined} action={person.status === "left" ? <Chip tone="neutral">Left the company</Chip> : undefined} />

      <section aria-labelledby="pp-leave" className="mb-8">
        <h2 id="pp-leave" className="mb-3 font-title text-h3 text-ink-800">
          Annual leave in {year}
        </h2>
        <Card>
          <StatGrid>
            <Stat label="Days left" value={balance.left} tone={balance.left < 0 ? "bad" : undefined} />
            <Stat label="Taken or approved" value={balance.used} />
            <Stat label="Waiting" value={balance.pending} />
          </StatGrid>
          <p className="mt-4 text-small text-ink-500">Out of {balance.allowance} days a year.</p>
          <Link href={`${base}/leave`} className={btnCls("secondary", "sm", "mt-4")}>
            Open leave
          </Link>
        </Card>
      </section>

      {manages ? (
        <section aria-labelledby="pp-edit" className="space-y-6">
          <h2 id="pp-edit" className="font-title text-h3 text-ink-800">
            Record
          </h2>
          <Card>
            <PersonForm key={person.id} brandId={brand.id} person={person} emergency={emergency} members={linkable} />
          </Card>
          <Card>
            <p className="mb-3 text-small text-ink-500">{person.status === "active" ? "When someone leaves, mark them as left. Their record and leave history are kept." : "This person is marked as left."}</p>
            <StatusForm brandId={brand.id} personId={person.id} status={person.status} />
          </Card>
        </section>
      ) : (
        <section aria-labelledby="pp-rec">
          <h2 id="pp-rec" className="mb-3 font-title text-h3 text-ink-800">
            Your record
          </h2>
          <Card>
            <dl className="divide-y divide-ink-100">
              {facts.map(([k, val]) => (
                <div key={k} className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-3 text-small">
                  <dt className="text-ink-500">{k}</dt>
                  <dd className="whitespace-pre-line text-ink-800">{val}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-small text-ink-500">Something wrong? Ask whoever manages the team to change it.</p>
          </Card>
        </section>
      )}
    </div>
  );
}
