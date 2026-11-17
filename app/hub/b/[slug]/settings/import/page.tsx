import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, DatabaseZap } from "lucide-react";
import { Card, Chip, EmptyState } from "@/components/brand/primitives";
import { RequestForm } from "@/components/hub/import/request-form";
import { SettingsShell } from "@/components/hub/settings-shell";
import { indexFor, listAllOpenRequests, listRequests } from "@/lib/hub/import/data";
import { REQUEST_LABEL, SOURCES, type RequestStatus } from "@/lib/hub/import/model";
import { canManageTeam } from "@/lib/hub/rules";
import { requireBrand } from "@/lib/hub/session";
import { fmtStamp, hubTz, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Import" };
export const dynamic = "force-dynamic";

const TONE: Record<RequestStatus, "neutral" | "info" | "ok" | "warn"> = { open: "neutral", planned: "info", done: "ok", declined: "warn" };

export default async function ImportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, actor } = await requireBrand(slug);
  if (!canManageTeam(actor)) notFound();
  const tz = hubTz();
  const today = todayIn(tz);
  const [indexes, mine, all] = await Promise.all([
    Promise.all(SOURCES.map((s) => indexFor(brand.id, s.id))),
    listRequests(brand.id),
    actor === "owner" ? listAllOpenRequests() : Promise.resolve([]),
  ]);

  return (
    <SettingsShell
      slug={slug}
      title="Import"
      description="Bring what you already have into this hub, from the tools you used before. Nothing is changed or deleted in the tool you import from."
    >
      <section aria-labelledby="sources" className="space-y-3">
        <h2 id="sources" className="text-h3 font-semibold text-ink-800">
          Ready to use
        </h2>
        {SOURCES.map((s, i) => {
          const ix = indexes[i];
          const total = ix ? ix.pages + ix.tasks + ix.leads + ix.content : 0;
          return (
            <Link key={s.id} href={s.href(slug)} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <Card interactive>
                <div className="flex items-center gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-paper-100 text-ink-700">
                    <DatabaseZap className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-800">{s.name}</p>
                    <p className="text-small text-ink-500">{s.brings}</p>
                    {ix && total > 0 ? (
                      <p className="mt-1 text-caption text-ink-500">
                        Already here: {ix.pages} wiki pages, {ix.tasks} tasks, {ix.leads} leads, {ix.content} content items
                        {ix.last ? `. Last import ${fmtStamp(ix.last, tz, today)}.` : "."}
                      </p>
                    ) : (
                      <p className="mt-1 text-caption text-ink-500">Nothing imported yet.</p>
                    )}
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-ink-300" aria-hidden />
                </div>
              </Card>
            </Link>
          );
        })}
        <p className="text-small text-ink-500">
          The hub remembers what it has already brought over, by its ID in the other tool. Run an import again and only what is new or still missing is added, so you never start from zero.
        </p>
      </section>

      <section aria-labelledby="request" className="space-y-3">
        <h2 id="request" className="text-h3 font-semibold text-ink-800">
          Need something else?
        </h2>
        <p className="text-small text-ink-500">Tell us where your work lives today. We read every request and decide what to build next. A request is not a promise, but it is how the list grows.</p>
        <Card>
          <RequestForm brandId={brand.id} />
        </Card>
      </section>

      {mine.length > 0 && (
        <section aria-labelledby="mine" className="space-y-3">
          <h2 id="mine" className="text-h3 font-semibold text-ink-800">
            Your requests
          </h2>
          <ul className="space-y-2">
            {mine.map((r) => (
              <li key={r.id}>
                <Card small>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-800">{r.source}</p>
                      {r.note && <p className="mt-1 whitespace-pre-line text-small text-ink-600">{r.note}</p>}
                      <p className="mt-1 text-caption text-ink-500">{fmtStamp(r.created_at, tz, today)}</p>
                    </div>
                    <Chip tone={TONE[r.status]}>{REQUEST_LABEL[r.status]}</Chip>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {actor === "owner" && (
        <section aria-labelledby="agency" className="space-y-3">
          <h2 id="agency" className="text-h3 font-semibold text-ink-800">
            Open requests from every brand
          </h2>
          {all.length === 0 ? (
            <EmptyState title="No open requests" hint="When a brand asks for a new source, it shows here." />
          ) : (
            <ul className="space-y-2">
              {all.map((r) => (
                <li key={r.id}>
                  <Card small>
                    <p className="font-semibold text-ink-800">
                      {r.source} <span className="font-normal text-ink-500">from {r.brand}</span>
                    </p>
                    {r.note && <p className="mt-1 whitespace-pre-line text-small text-ink-600">{r.note}</p>}
                    <p className="mt-1 text-caption text-ink-500">{fmtStamp(r.created_at, tz, today)}</p>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </SettingsShell>
  );
}
