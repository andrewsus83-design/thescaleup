import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { Chip, EmptyState, PageHeader } from "@/components/brand/primitives";
import { BackLink } from "@/components/hub/back-link";
import { PersonForm } from "@/components/hub/hr/forms";
import { InkFigure, InkPanel, InkStats, Panel, panelRowsCls, Split, SplitMain, SplitSide } from "@/components/hub/panels";
import { requireFunction } from "@/lib/hub/access";
import { listPeople } from "@/lib/hub/hr/data";
import { EMPLOYMENT_LABEL, type Person } from "@/lib/hub/hr/model";
import { atLeast } from "@/lib/hub/permissions";
import { listMembers } from "@/lib/hub/tasks/data";
import { cn } from "@/lib/utils";

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
        <span aria-hidden className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-full font-title text-body font-bold", p.status === "left" ? "bg-paper-100 text-ink-600" : "bg-(--acc-tint) text-(--acc-ink)")}>
          {(p.name.trim()[0] ?? "?").toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-semibold text-ink-800">
            {p.name}
            {p.userId === user.id ? " (you)" : ""}
          </span>
          <span className="block text-small text-ink-500">
            {p.title || "No job title yet"}
            {/* On a phone the kind of employment joins this line, so the name keeps the row's width. */}
            <span className="sm:hidden">, {EMPLOYMENT_LABEL[p.employment].toLowerCase()}</span>
          </span>
        </span>
        <Chip tone="neutral" className="hidden sm:inline-flex">
          {EMPLOYMENT_LABEL[p.employment]}
        </Chip>
        {canOpen && <ChevronRight className="size-5 shrink-0 text-ink-400" aria-hidden />}
      </>
    );
    return (
      <li>
        {canOpen ? (
          <Link href={`${base}/${p.id}`} className="-mx-3 flex min-h-16 items-center gap-4 rounded-field px-3 py-3 hover:bg-paper-100">
            {body}
          </Link>
        ) : (
          <div className="flex min-h-16 items-center gap-4 py-3">{body}</div>
        )}
      </li>
    );
  };

  const addHint = unlinked.length > 0 ? `${unlinked.length === 1 ? "One member of this brand has" : `${unlinked.length} members of this brand have`} no people record yet: ${unlinked.map((m) => m.email).join(", ")}.` : "A record holds the job title, the kind of employment, the dates and an emergency contact.";

  return (
    <div>
      <BackLink href={`/hub/b/${slug}/team`}>Team</BackLink>
      <PageHeader title="People" description={manages ? "Everyone the brand employs, with or without a sign-in to the hub." : "Who works here and what they do."} />

      <Split>
        <SplitMain>
          {people.length === 0 ? (
            <EmptyState icon={<Users className="size-6" aria-hidden />} title="No people records yet" hint={manages ? "Add the first person with the form on this page. A record holds the job title, the kind of employment, the dates and an emergency contact." : "Whoever manages the team has not added anyone yet."} />
          ) : (
            <>
              {active.length > 0 && (
                <Panel id="ppl-active" title="Working here" hint={`${active.length} ${active.length === 1 ? "person" : "people"}`}>
                  <ul className={panelRowsCls}>
                    {active.map((p) => (
                      <Row key={p.id} p={p} />
                    ))}
                  </ul>
                </Panel>
              )}
              {manages && left.length > 0 && (
                <Panel id="ppl-left" title="Left the company" hint={`${left.length} ${left.length === 1 ? "person" : "people"}`}>
                  <ul className={panelRowsCls}>
                    {left.map((p) => (
                      <Row key={p.id} p={p} />
                    ))}
                  </ul>
                </Panel>
              )}
            </>
          )}
        </SplitMain>
        <SplitSide>
          <StatTilesCard active={active.length} linked={active.filter((p) => p.userId).length} left={manages ? left.length : null} />
          {manages && (
            <Panel id="ppl-add" title="Add a person" hint={addHint}>
              <PersonForm brandId={brand.id} members={unlinked.map((m) => ({ userId: m.userId, email: m.email }))} />
            </Panel>
          )}
        </SplitSide>
      </Split>
    </div>
  );
}

/** How many people there are, on the dark panel. */
function StatTilesCard({ active, linked, left }: { active: number; linked: number; left: number | null }) {
  return (
    <InkPanel label="The team">
      <InkFigure label={active === 1 ? "person works here" : "people work here"} value={active} />
      {/* Who has a sign-in and who left is for whoever manages the team. */}
      {left !== null && <InkStats items={[{ label: "With a sign-in", value: linked }, { label: "Left the company", value: left }]} />}
    </InkPanel>
  );
}
