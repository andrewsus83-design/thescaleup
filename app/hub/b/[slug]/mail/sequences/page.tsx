import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Repeat } from "lucide-react";
import { Alert, Chip, EmptyState, type Tone } from "@/components/brand/primitives";
import { btnCls, cardCls } from "@/components/brand/styles";
import { MailShell } from "@/components/hub/mail/shell";
import { requireFunction } from "@/lib/hub/access";
import { listSequences, type SequenceRow } from "@/lib/hub/email/sequence-data";
import { countUnread, listAddresses, listDomains } from "@/lib/hub/mail/data";
import { atLeast } from "@/lib/hub/permissions";
import { fmtStamp, hubTz, todayIn } from "@/lib/hub/tasks/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Sequences" };
export const dynamic = "force-dynamic";

const STATUS: Record<SequenceRow["status"], { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  active: { label: "Running", tone: "ok" },
  paused: { label: "Paused", tone: "warn" },
};

export default async function SequencesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, access } = await requireFunction(slug, "mail");
  const domains = await listDomains(brand.id);
  const [addresses, unread, { ready, rows }] = await Promise.all([listAddresses(brand.id, domains), countUnread(brand.id), listSequences(brand.id)]);
  const canWrite = atLeast(access.mail, "edit");
  const tz = hubTz();
  const today = todayIn(tz);
  const base = `/hub/b/${slug}/mail/sequences`;
  return (
    <MailShell slug={slug} active={null} unread={unread} addresses={addresses} canCompose={canWrite} sequences>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-title text-h2 text-ink-800">Sequences</h1>
        {canWrite && ready && (
          <Link href={`${base}/new`} className={btnCls("primary", "md")}>
            <Plus className="size-5" aria-hidden />
            New sequence
          </Link>
        )}
      </div>
      {!ready ? (
        <Alert tone="warn" title="Sequences need their database step first.">
          Ask the person who runs the database updates to run 20261117400000_email_sequences.sql.
        </Alert>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Repeat className="size-6" aria-hidden />} title="No sequences yet" hint="A sequence is a short series of emails, like a welcome or a follow-up, sent to each person on their own schedule. It stops for anyone who writes back or unsubscribes.">
          {canWrite && (
            <Link href={`${base}/new`} className={btnCls("primary", "md")}>
              Write the first one
            </Link>
          )}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`${base}/${r.id}`} className={cn(cardCls(true, true), "flex flex-wrap items-center justify-between gap-3")}>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink-800">{r.name}</span>
                  <span className="block text-caption text-ink-500">
                    {r.steps} {r.steps === 1 ? "email" : "emails"}
                    {r.auto_enroll ? " · adds new people automatically" : ""} · edited {fmtStamp(r.updated_at, tz, today)}
                  </span>
                </span>
                <Chip tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Chip>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </MailShell>
  );
}
