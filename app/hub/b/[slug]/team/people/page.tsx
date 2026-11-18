import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { Card, Chip, EmptyState, PageHeader } from "@/components/brand/primitives";
import { listCls } from "@/components/brand/styles";
import { BackLink } from "@/components/hub/back-link";
import { PersonForm } from "@/components/hub/hr/forms";
import { requireFunction } from "@/lib/hub/access";
import { listPeople } from "@/lib/hub/hr/data";
import { EMPLOYMENT_LABEL, type Person } from "@/lib/hub/hr/model";
import { atLeast } from "@/lib/hub/permissions";
import { listMembers } from "@/lib/hub/tasks/data";

export const metadata: Metadata = { title: "People" };
export const dynamic = "force-dynamic";

export default async function PeoplePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, brand, access } = await requireFunction(slug, "team");
  const manages = atLeast(access.team, "edit");
  const [people, members] = await Promise.all([listPeople(brand.id), manages ? listMembers(brand.id) : Promise.resolve([])]);
  const active = people.filter((p) => p.status === "active");
  const left = people.filter((p) => p.status === "left");
  const linked = new Set(people.map((p) => p.userId).filter(Boolean));
  const unlinked = members.filter((m) => !linked.has(m.userId));
  const base = `/hub/b/${slug}/team/people`;

  const Row = ({ p }: { p: Person }) => {
    // The full record opens for whoever manages the team, and for the person it is about.
    const canOpen = manages || p.userId === user.id;
    const body = (
      <>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-semibold text-ink-800">
            {p.name}
            {p.userId === user.id ? " (you)" : ""}
          </span>
          <span className="block text-small text-ink-500">{p.title || "No job title yet"}</span>
        </span>
        <Chip tone="neutral">{EMPLOYMENT_LABEL[p.employment]}</Chip>
        {canOpen && <ChevronRight className="size-5 shrink-0 text-ink-400" aria-hidden />}
      </>
    );
    return (
      <li>
        {canOpen ? (
          <Link href={`${base}/${p.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-paper-100">
            {body}
          </Link>
        ) : (
          <div className="flex min-h-16 items-center gap-3 px-4 py-3">{body}</div>
        )}
      </li>
    );
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <BackLink href={`/hub/b/${slug}/team`}>Team</BackLink>
      <PageHeader title="People" description={manages ? "Everyone the brand employs, with or without a sign-in to the hub." : "Who works here and what they do."} />

      {people.length === 0 ? (
        <EmptyState icon={<Users className="size-6" aria-hidden />} title="No people records yet" hint={manages ? "Add the first person below. A record holds the job title, the kind of employment, the dates and an emergency contact." : "Whoever manages the team has not added anyone yet."} />
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <ul className={listCls} aria-label="Active people">
              {active.map((p) => (
                <Row key={p.id} p={p} />
              ))}
            </ul>
          )}
          {manages && left.length > 0 && (
            <section aria-labelledby="ppl-left">
              <h2 id="ppl-left" className="mb-3 font-title text-h4 text-ink-800">
                Left the company
              </h2>
              <ul className={listCls}>
                {left.map((p) => (
                  <Row key={p.id} p={p} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {manages && (
        <section aria-labelledby="ppl-add" className="mt-10">
          <h2 id="ppl-add" className="mb-3 font-title text-h3 text-ink-800">
            Add a person
          </h2>
          {unlinked.length > 0 && (
            <p className="mb-4 text-small text-ink-500">
              {unlinked.length === 1 ? "One member of this brand has" : `${unlinked.length} members of this brand have`} no people record yet: {unlinked.map((m) => m.email).join(", ")}.
            </p>
          )}
          <Card>
            <PersonForm brandId={brand.id} members={unlinked.map((m) => ({ userId: m.userId, email: m.email }))} />
          </Card>
        </section>
      )}
    </div>
  );
}
