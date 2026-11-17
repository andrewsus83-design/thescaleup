import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Alert, Card } from "@/components/brand/primitives";
import { segItem, segWrap } from "@/components/brand/styles";
import { SequenceBuilder } from "@/components/hub/email/sequence-builder";
import { SequenceControl } from "@/components/hub/email/sequence-control";
import { SequencePeople, type PersonLine } from "@/components/hub/email/sequence-people";
import { MailShell } from "@/components/hub/mail/shell";
import { requireFunction } from "@/lib/hub/access";
import { getStages } from "@/lib/hub/crm/data";
import { maskEmail } from "@/lib/hub/crm/mask";
import { builderData } from "@/lib/hub/email/builder-data";
import { getSequence, listEnrollments, sequenceStats, type EnrollmentRow } from "@/lib/hub/email/sequence-data";
import { dayOffsets, scheduleText, sequenceProblems, STOP_LABEL } from "@/lib/hub/email/sequence-model";
import { countUnread } from "@/lib/hub/mail/data";
import { atLeast, canSeeContacts } from "@/lib/hub/permissions";
import { fmtDay, fmtStamp, hubTz, todayIn } from "@/lib/hub/tasks/dates";
import { UUID } from "@/lib/hub/tasks/context";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Sequence" };
export const dynamic = "force-dynamic";
// "Send what is due now" runs from this page and can take a while when many emails are due.
export const maxDuration = 60;

const SHOW = ["active", "done", "stopped"] as const;
const SHOW_LABEL: Record<(typeof SHOW)[number], string> = { active: "In it now", done: "Got every email", stopped: "Left early" };
const PAGE = 50;

export default async function SequencePage({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug, id }, sp] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const { brand, access } = await requireFunction(slug, "mail");
  const canWrite = atLeast(access.mail, "edit");
  const seq = await getSequence(brand.id, id);
  if (!seq) notFound();
  const tz = hubTz();
  const today = todayIn(tz);
  const [data, unread, stats, stages] = await Promise.all([builderData(brand.id), countUnread(brand.id), sequenceStats(id, today), getStages(brand.id)]);
  const base = `/hub/b/${slug}/mail/sequences/${id}`;
  const tab = one(sp.tab) === "emails" ? "emails" : one(sp.tab) === "overview" ? "overview" : seq.status === "draft" ? "emails" : "overview";
  const show = SHOW.find((s) => s === one(sp.show)) ?? "active";
  const hasPeople = stats.active + stats.done + stats.stopped > 0;

  const problems = sequenceProblems(seq.steps);
  const senderOk = data.addresses.some((a) => a.id === seq.address_id);
  const startBlocker = data.blocker || (problems.length ? problems[0] : !senderOk ? "Pick an address to send from, then save. Its domain must be verified in Settings, Mailbox." : "");
  const days = dayOffsets(seq.steps);
  const lines = seq.steps.map((s, i) => {
    const row = stats.steps.find((x) => x.step === i);
    return { day: days[i], subject: s.doc.subject, sent: row?.sent ?? 0, bounced: row?.bounced ?? 0, failed: row?.failed ?? 0 };
  });

  const back = (
    <Link href={`/hub/b/${slug}/mail/sequences`} className="mb-4 inline-flex min-h-11 items-center gap-2 text-small font-semibold text-ink-500 hover:text-ink-800">
      <ArrowLeft className="size-4" aria-hidden />
      Sequences
    </Link>
  );

  // Only people who may see contact details see addresses here; everyone else gets them hidden, as in the CRM.
  const reveal = canSeeContacts(access);
  const rows = tab === "overview" && hasPeople ? await listEnrollments(brand.id, id, show, PAGE) : [];
  const total = show === "active" ? stats.active : show === "done" ? stats.done : stats.stopped;
  const lineOf = (r: EnrollmentRow): PersonLine => ({
    id: r.id,
    name: r.name,
    email: reveal ? r.email : maskEmail(r.email),
    progress: `${r.sent_count} of ${seq.steps.length} sent`,
    when: r.status === "active" ? (r.next_on ? (r.next_on <= today ? "next email due today" : `next email ${fmtDay(r.next_on)}`) : "") : r.status === "done" ? "got every email" : r.stop_reason ? STOP_LABEL[r.stop_reason].toLowerCase() : "stopped",
    canStop: canWrite && r.status === "active",
  });

  return (
    <MailShell slug={slug} active={null} unread={unread} addresses={data.allAddresses} canCompose={canWrite} sequences>
      {back}
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-title text-h2 text-ink-800">{seq.name}</h1>
      </div>
      <p className="mb-6 text-small text-ink-500">
        {scheduleText(seq.steps)}. Last edited {fmtStamp(seq.updated_at, tz, today)}.
      </p>
      <nav aria-label="Sequence sections" className={cn(segWrap, "mb-8 w-fit")}>
        {(["overview", "emails"] as const).map((t) => (
          <Link key={t} href={`${base}?tab=${t}`} aria-current={tab === t ? "page" : undefined} className={segItem(tab === t, "sm")}>
            {t === "overview" ? "Overview" : "Emails and settings"}
          </Link>
        ))}
      </nav>

      {tab === "overview" ? (
        <div className="space-y-8">
          <SequenceControl
            brandId={brand.id}
            slug={slug}
            id={id}
            brandName={brand.name}
            status={seq.status}
            canWrite={canWrite}
            startBlocker={startBlocker}
            autoEnroll={seq.auto_enroll}
            autoSince={seq.auto_since ? fmtStamp(seq.auto_since, tz, today) : ""}
            counts={{ active: stats.active, due: stats.due, done: stats.done, stopped: stats.stopped }}
            reasons={stats.reasons}
            lines={lines}
          />
          {hasPeople && (
            <section aria-label="People" className="space-y-4">
              <h2 className="text-small font-semibold text-ink-800">People</h2>
              <nav aria-label="Which people" className={cn(segWrap, "w-fit")}>
                {SHOW.map((s) => (
                  <Link key={s} href={`${base}?tab=overview&show=${s}`} aria-current={show === s ? "page" : undefined} className={segItem(show === s, "sm")}>
                    {SHOW_LABEL[s]}
                  </Link>
                ))}
              </nav>
              <SequencePeople brandId={brand.id} rows={rows.map(lineOf)} empty="Nobody here." more={total > rows.length ? `Showing the newest ${rows.length} of ${total.toLocaleString("en")}.` : ""} />
              {!reveal && <p className="text-caption text-ink-500">Email addresses are hidden for your role.</p>}
            </section>
          )}
        </div>
      ) : canWrite ? (
        <SequenceBuilder
          brandId={brand.id}
          slug={slug}
          brandName={brand.name}
          id={seq.id}
          hasPeople={hasPeople}
          initial={{ name: seq.name, addressId: seq.address_id ?? (data.addresses.length === 1 ? data.addresses[0].id : ""), steps: seq.steps, audience: seq.audience, stopStages: seq.stop_stages }}
          addresses={data.addresses}
          stages={data.stages}
          stageOptions={[...new Map(stages.map((s) => [s.key, { key: s.key, label: s.label }])).values()]}
          tags={data.tags}
          blocker={data.blocker}
        />
      ) : (
        <div className="space-y-4">
          <Alert tone="info">You can read this sequence, but only people who can edit Mail can change it.</Alert>
          <ol className="space-y-3">
            {seq.steps.map((s, i) => (
              <li key={i}>
                <Card small>
                  <p className="text-caption text-ink-500">
                    Email {i + 1} · day {days[i]}
                  </p>
                  <p className="font-semibold text-ink-800">{s.doc.subject || "No subject yet"}</p>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      )}
    </MailShell>
  );
}
