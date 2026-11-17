import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card, Chip, PageHeader } from "@/components/brand/primitives";
import { CrmNav } from "@/components/hub/crm/parts";
import { ProtectRunner } from "@/components/hub/crm/protect-runner";
import { requireFunction } from "@/lib/hub/access";
import { protectionStatus } from "@/lib/hub/crm/protect-data";
import { atLeast } from "@/lib/hub/permissions";
import { fmtNum } from "@/lib/hub/products/model";
import { canManageTeam } from "@/lib/hub/rules";

export const metadata: Metadata = { title: "CRM · Protection" };
export const dynamic = "force-dynamic";

const H2 = "mb-3 font-title text-h3 text-ink-800";

export default async function CrmProtectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor, access } = await requireFunction(slug, "crm");
  if (!canManageTeam(actor) || !atLeast(access.crm, "edit")) notFound();
  const s = await protectionStatus(brand.id);
  const left = s.summaries + s.notes;
  return (
    <>
      <PageHeader title="CRM" description="How the text and contact details of your leads and clients are kept." />
      <CrmNav slug={slug} active="protection" manager />
      <div className="space-y-6">
        <Card>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="font-title text-h3 text-ink-800">Notes and summaries</h2>
            {s.ready ? <Chip tone={left === 0 && !s.failed ? "ok" : "warn"}>{s.failed ? "Could not check" : left === 0 ? "All protected" : "Some not yet"}</Chip> : <Chip tone="bad">Key missing</Chip>}
          </div>
          <p className="text-body text-ink-800">New notes and summaries are saved scrambled (AES-256), so a copy of the database or a backup does not show what was said about a customer. The hub unscrambles them when someone with access opens the person.</p>
          {!s.ready && (
            <Alert tone="bad" role="alert" className="mt-4">
              The server has no encryption key (SECRETS_KEY_1), so notes and summaries cannot be saved right now. Add the key to the server settings, then come back.
            </Alert>
          )}
          {s.ready && left > 0 && (
            <div className="mt-4 space-y-4">
              <p className="text-body text-ink-800">
                {fmtNum(s.notes)} {s.notes === 1 ? "note" : "notes"} and {fmtNum(s.summaries)} {s.summaries === 1 ? "summary" : "summaries"} saved earlier are still plain text. This wraps them in batches. Nobody sees a difference, and the dates on people do not change.
              </p>
              <ProtectRunner brandId={brand.id} left={left} />
            </div>
          )}
        </Card>

        <Card>
          <h2 className={H2}>Who sees email and phone</h2>
          <p className="text-body text-ink-800">
            The <strong>Contact details</strong> permission decides it, per role, in{" "}
            <Link href={`/hub/b/${slug}/settings/team`} className="font-semibold underline underline-offset-2">
              Settings, Team
            </Link>
            . Without it, email and phone show as <span className="font-mono">a•••@gmail.com</span> and <span className="font-mono">0812••••••90</span>, the search ignores them, and saving a person leaves them untouched. Staff can see them by default; the other roles cannot. Only the founder and the agency can download the CRM as a file, and every download is written to the audit trail.
          </p>
        </Card>

        <Card>
          <h2 className={H2}>What this does not cover</h2>
          <ul className="list-disc space-y-2 pl-5 text-body text-ink-800">
            <li>Email and phone are not scrambled in the database: the CRM needs them to search, avoid duplicates and send campaigns. They are hidden by role instead.</li>
            <li>Mail messages are not scrambled, because Mail searches inside them.</li>
            <li>Whoever holds the server&apos;s keys can read everything. Keep the Vercel and Supabase accounts to the few people who need them, with two-step sign-in on.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
