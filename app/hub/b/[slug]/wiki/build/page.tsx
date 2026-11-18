import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Chip, PageHeader } from "@/components/brand/primitives";
import { cardCls } from "@/components/brand/styles";
import { StartForm } from "@/components/hub/wiki/build-forms";
import { wikiBase } from "@/components/hub/wiki/parts";
import { requireFunction } from "@/lib/hub/access";
import { getProfile } from "@/lib/hub/brand-profile/data";
import { atLeast } from "@/lib/hub/permissions";
import { hasAiKey } from "@/lib/hub/tasks/data";
import { listBuilds } from "@/lib/hub/wiki/builds";

export const metadata: Metadata = { title: "Wiki · Build with AI" };
export const dynamic = "force-dynamic";
// Reading the sources and asking the first questions can take a minute.
export const maxDuration = 120;

export default async function WikiBuildStartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { brand, access } = await requireFunction(slug, "wiki", "edit");
  const [hasKey, builds, profile] = await Promise.all([hasAiKey(brand.id), listBuilds(brand.id), getProfile(brand.id)]);
  const saved = profile?.value;
  const hasLinks = !!saved && (!!saved.website || Object.keys(saved.handles).length > 0);
  const canSeeBrand = atLeast(access.brand, "view");
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <PageHeader
        title="Build with AI"
        description="Give it the brand's website and social accounts. It reads them, asks the client up to 10 questions, then drafts Wiki pages for you to add or skip."
        action={
          <Link href={wikiBase(slug)} className="text-small font-semibold text-brand-700 underline underline-offset-4">
            Back to the Wiki
          </Link>
        }
      />
      {!hasKey && (
        <Alert tone="warn">
          AI needs an Anthropic key. Add one in Settings → Integrations first.
        </Alert>
      )}
      <div className={cardCls()}>
        {hasLinks && (
          <p className="mb-6 text-small text-ink-500">
            Started from the website and accounts saved in the brand profile.{canSeeBrand && (
              <>
                {" "}
                <Link href={`/hub/b/${slug}/brand/profile`} className="font-semibold text-brand-700 underline underline-offset-4">
                  Open the profile
                </Link>
              </>
            )}
          </p>
        )}
        <StartForm brandId={brand.id} website={saved?.website ?? undefined} handles={saved?.handles} />
      </div>
      {builds.length > 0 && (
        <section aria-labelledby="earlier" className="space-y-3">
          <h2 id="earlier" className="font-title text-h3 text-ink-800">
            Earlier runs
          </h2>
          <ul className="space-y-2">
            {builds.map((b) => (
              <li key={b.id}>
                <Link href={`${wikiBase(slug)}/build/${b.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-field bg-paper-0 px-4 py-3 hover:bg-paper-100 focus-visible:shadow-focus focus-visible:outline-none">
                  <span className="text-body font-semibold text-ink-800">{b.website ? b.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : "Notes and social accounts"}</span>
                  <Chip tone={b.status === "ready" ? "ok" : "warn"}>{b.status === "ready" ? `${b.added} of ${b.total} added` : "Waiting for answers"}</Chip>
                  <span className="text-small text-ink-500">{new Date(b.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
