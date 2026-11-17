import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/brand/primitives";
import { btnCls } from "@/components/brand/styles";
import { GhostingView, HealthView, Overview, TrackerView } from "@/components/hub/chat/report-views";
import { ItemActions, type PersonOption } from "@/components/hub/chat/item-actions";
import { requireFunction } from "@/lib/hub/access";
import { deleteAudit } from "@/lib/hub/chat-actions";
import { getAudit } from "@/lib/hub/chat/data";
import { matchPerson } from "@/lib/hub/chat/model";
import { listPeople } from "@/lib/hub/crm/data";
import { atLeast } from "@/lib/hub/permissions";
import { fmtStamp, hubTz, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Chat audit" };
export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "tracker", label: "Follow-ups" },
  { key: "health", label: "Partnership health" },
  { key: "ghosting", label: "Ghosting and drop-off" },
  { key: "suggestions", label: "Suggestions" },
  { key: "chats", label: "Conversations" },
] as const;
type View = (typeof VIEWS)[number]["key"];

export default async function AuditPage({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ view?: string }> }) {
  const [{ slug, id }, { view: raw }] = await Promise.all([params, searchParams]);
  const { brand, access } = await requireFunction(slug, "inbox");
  const got = await getAudit(brand.id, id);
  if (!got) notFound();
  const { audit, items, done } = got;
  const view: View = VIEWS.some((v) => v.key === raw) ? (raw as View) : "tracker";
  const tz = hubTz();
  const today = todayIn(tz);
  const base = `/hub/b/${slug}/inbox/audit/${id}`;
  const canEdit = atLeast(access.inbox, "edit");
  const can = { tasks: atLeast(access.tasks, "edit"), crm: atLeast(access.crm, "edit"), content: atLeast(access.content, "edit") };

  // The CRM list is only read when the person may use the CRM and the Suggestions tab is open.
  let people: PersonOption[] = [];
  if (view === "suggestions" && can.crm) {
    const [leads, clients] = await Promise.all([listPeople(brand.id, "lead", 300), listPeople(brand.id, "client", 300)]);
    people = [...leads.items, ...clients.items].map((p) => ({ id: p.id, name: p.name, company: p.company, kind: p.kind }));
  }
  const doneFor = (itemId: string) => [...done].filter((k) => k.includes(`:${itemId}:`)).map((k) => k.replace(`:${itemId}:`, ":"));
  const actionable = items.filter((i) => i.findings.open_items.some((o) => o.owner === "us") || i.findings.content_ideas.length || i.findings.follow_up_message || i.findings.buying_intent !== "none" || i.findings.follow_up_date || i.findings.stalled_on === "them");

  return (
    <div className="space-y-8">
      <Link href={`/hub/b/${slug}/inbox/audit`} className="inline-flex min-h-11 items-center gap-2 text-small font-semibold text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Chat audit
      </Link>
      <PageHeader title={audit.name} description={`${items.length} ${items.length === 1 ? "conversation" : "conversations"}, run ${fmtStamp(audit.created_at, tz, today)}`} />
      <nav aria-label="Report" className="-mx-1 flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link key={v.key} href={`${base}?view=${v.key}`} aria-current={view === v.key ? "page" : undefined} className={btnCls(view === v.key ? "dark" : "secondary", "sm")}>
            {v.label}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <EmptyState title="No conversations in this audit" hint="Every conversation failed to run. Start a new audit and try again." />
      ) : view === "tracker" ? (
        <TrackerView items={items} today={today} base={base} />
      ) : view === "health" ? (
        <HealthView items={items} />
      ) : view === "ghosting" ? (
        <GhostingView items={items} />
      ) : view === "suggestions" ? (
        actionable.length === 0 ? (
          <EmptyState title="Nothing to suggest" hint="No open items, buying signals or follow-ups came out of these conversations." />
        ) : (
          <ul className="space-y-4">
            {actionable.map((i) => (
              <li key={i.id}>
                <Overview item={i}>
                  {canEdit && (
                    <ItemActions
                      brandId={brand.id}
                      itemId={i.id}
                      findings={i.findings}
                      personId={i.person_id}
                      people={people}
                      suggested={matchPerson(i.title, people)?.id ?? null}
                      done={doneFor(i.id)}
                      can={can}
                    />
                  )}
                </Overview>
              </li>
            ))}
          </ul>
        )
      ) : (
        <ul className="space-y-4">
          {items.map((i) => (
            <li key={i.id}>
              <Overview item={i} />
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form action={deleteAudit} className="border-t border-ink-100 pt-6">
          <input type="hidden" name="brandId" value={brand.id} />
          <input type="hidden" name="id" value={id} />
          <button type="submit" className={btnCls("secondary", "sm")}>
            Delete this audit
          </button>
          <p className="mt-2 text-caption text-ink-500">Tasks, notes, leads and content already made from it stay where they are.</p>
        </form>
      )}
    </div>
  );
}
