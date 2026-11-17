import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Btn, Chip, PageHeader } from "@/components/brand/primitives";
import { btnCls, cardCls } from "@/components/brand/styles";
import { AnswerForm } from "@/components/hub/wiki/build-forms";
import { Markdown } from "@/components/hub/wiki/markdown";
import { TypeChip, wikiBase } from "@/components/hub/wiki/parts";
import { requireFunction } from "@/lib/hub/access";
import { deleteBuild, reviewDrafts } from "@/lib/hub/wiki-ai-actions";
import { getBuild } from "@/lib/hub/wiki/builds";
import { UUID } from "@/lib/hub/tasks/context";

export const metadata: Metadata = { title: "Wiki · Build with AI" };
export const dynamic = "force-dynamic";
// Writing the pages makes several AI calls in a row.
export const maxDuration = 120;

export default async function WikiBuildPage({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ failed?: string }> }) {
  const [{ slug, id }, sp] = await Promise.all([params, searchParams]);
  const { brand } = await requireFunction(slug, "wiki", "edit");
  if (!UUID.test(id)) notFound();
  const build = await getBuild(brand.id, id);
  if (!build) notFound();
  const base = wikiBase(slug);
  const fresh = build.drafts.filter((d) => d.state === "new");
  const failed = Math.max(0, Number(sp.failed) || 0);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <PageHeader
        title="Build with AI"
        description={build.status === "ready" ? "Read each draft, then add it to the Wiki or skip it." : "Answer what you can. The pages say “To confirm” where something is missing."}
        action={
          <Link href={`${base}/build`} className="text-small font-semibold text-brand-700 underline underline-offset-4">
            All runs
          </Link>
        }
      />

      <section aria-labelledby="read" className={`${cardCls()} space-y-3`}>
        <h2 id="read" className="font-title text-h3 text-ink-800">
          What was read
        </h2>
        <ul className="space-y-2">
          {build.read.map((r, i) => (
            <li key={`${r.url}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small">
              <Chip tone={r.ok ? "ok" : "warn"}>{r.ok ? "Read" : "Not read"}</Chip>
              <span className="font-semibold text-ink-800">{r.label}</span>
              <span className="text-ink-500">{r.ok ? `${r.chars.toLocaleString("en-US")} characters` : r.note}</span>
            </li>
          ))}
          {build.sources.notes && (
            <li className="flex flex-wrap items-center gap-x-3 text-small">
              <Chip tone="ok">Read</Chip>
              <span className="font-semibold text-ink-800">Your notes</span>
            </li>
          )}
        </ul>
        {build.read.some((r) => !r.ok) && <p className="text-caption text-ink-500">For anything that was not read, answer the questions or start a new run with its bio and a few captions in the notes.</p>}
      </section>

      {build.status === "ready" ? (
        <section aria-labelledby="drafts" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="drafts" className="font-title text-h3 text-ink-800">
              Drafted pages
            </h2>
            {fresh.length > 1 && (
              <form action={reviewDrafts}>
                <input type="hidden" name="brandId" value={brand.id} />
                <input type="hidden" name="id" value={build.id} />
                <input type="hidden" name="all" value="1" />
                <Btn type="submit" variant="primary" size="md">
                  Add all {fresh.length} to the Wiki
                </Btn>
              </form>
            )}
          </div>
          {failed > 0 && (
            <Alert tone="warn">
              {failed} {failed === 1 ? "page" : "pages"} could not be written this time. Write the pages again below to try them again.
            </Alert>
          )}
          <p className="text-small text-ink-500">Added pages carry an &ldquo;ai-draft&rdquo; tag. Check them against what you know, edit them, then remove the tag.</p>
          <ul className="space-y-4">
            {build.drafts.map((d) => (
              <li key={d.id} className={`${cardCls()} space-y-3`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h3 className="font-title text-h4 text-ink-800">{d.title}</h3>
                  <TypeChip type={d.type} />
                  {d.state === "added" && <Chip tone="ok">Added</Chip>}
                  {d.state === "skipped" && <Chip>Skipped</Chip>}
                </div>
                {d.summary && <p className="text-small text-ink-500">{d.summary}</p>}
                <details className="group">
                  <summary className="min-h-11 cursor-pointer text-small font-semibold text-brand-700 underline underline-offset-4">Read the draft</summary>
                  <div className="mt-3 space-y-4 rounded-field bg-paper-100 p-4">
                    <Markdown text={d.body} />
                  </div>
                </details>
                <div className="flex flex-wrap items-center gap-3">
                  {d.state === "added" && d.slug ? (
                    <Link href={`${base}/${d.slug}`} className={btnCls("secondary", "sm")}>
                      Open the page
                    </Link>
                  ) : (
                    <>
                      <form action={reviewDrafts}>
                        <input type="hidden" name="brandId" value={brand.id} />
                        <input type="hidden" name="id" value={build.id} />
                        <input type="hidden" name="draftId" value={d.id} />
                        <Btn type="submit" variant="primary" size="sm">
                          Add to the Wiki
                        </Btn>
                      </form>
                      {d.state === "new" && (
                        <form action={reviewDrafts}>
                          <input type="hidden" name="brandId" value={brand.id} />
                          <input type="hidden" name="id" value={build.id} />
                          <input type="hidden" name="draftId" value={d.id} />
                          <input type="hidden" name="skip" value="1" />
                          <Btn type="submit" variant="ghost" size="sm">
                            Skip
                          </Btn>
                        </form>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <details className={`${cardCls()}`}>
            <summary className="min-h-11 cursor-pointer font-title text-h4 text-ink-800">Change the answers and write again</summary>
            <div className="mt-4">
              <AnswerForm brandId={brand.id} id={build.id} questions={build.questions} answers={build.answers} again />
            </div>
          </details>
        </section>
      ) : (
        <section aria-labelledby="questions" className={`${cardCls()} space-y-4`}>
          <h2 id="questions" className="font-title text-h3 text-ink-800">
            {build.questions.length ? `${build.questions.length} ${build.questions.length === 1 ? "question" : "questions"} for the client` : "No questions"}
          </h2>
          <AnswerForm brandId={brand.id} id={build.id} questions={build.questions} answers={build.answers} />
        </section>
      )}

      <form action={deleteBuild} className="pt-2">
        <input type="hidden" name="brandId" value={brand.id} />
        <input type="hidden" name="id" value={build.id} />
        <Btn type="submit" variant="ghost" size="sm">
          Delete this run
        </Btn>
      </form>
    </div>
  );
}
