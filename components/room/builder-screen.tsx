"use client";

// Builder tab: web and content builds for the active brand. A build starts from a failed check or to do,
// is versioned, and moves draft → review → published; publishing marks the to do done, writes the
// chronicle and saves the output back as an asset. The preview is a sandboxed iframe (no scripts).

import { useState } from "react";
import { Eye, Hammer } from "lucide-react";
import type { Build, Project } from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { NeedProject, ProjectSwitcher } from "./project-switcher";
import { useRoom } from "./room-provider";
import { Alert, Btn, Card, Chip, Dot, EmptyState, PageHeader, Sheet, pageX } from "./ui";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** A plain draft page built from the locked profile — stand-in for the real block renderer. */
export function previewHtml(p: Project, b: Build): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;margin:0;padding:24px;color:#1b2a4a;line-height:1.55}h1{font-size:22px;margin:10px 0 8px}h2{font-size:15px;margin:18px 0 4px;color:#475569}p{margin:0 0 8px}.tag{display:inline-block;font-size:11px;border:1px solid #cbd5e1;border-radius:999px;padding:2px 9px;color:#475569}</style></head><body><span class="tag">Draft v${b.version} · preview only</span><h1>${esc(b.title)}</h1><p>${esc(p.name)} — ${esc(p.profile.what ?? "")}</p><h2>Who it's for</h2><p>${esc(p.profile.who ?? "")}</p><h2>Where</h2><p>${esc(p.profile.where ?? "")}</p><h2>Why choose us</h2><p>${esc(p.profile.why ?? "")}</p></body></html>`;
}

const STAGES: { key: Build["stage"]; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "review", label: "Review" },
  { key: "published", label: "Published" },
];

const caps = "font-mono text-code uppercase text-ink-500";

export function BuilderScreen() {
  const { activeProject } = useRoom();
  if (!activeProject) return <NeedProject what="Builder" />;
  return <BuilderFor key={activeProject.id} project={activeProject} />;
}

function BuilderFor({ project }: { project: Project }) {
  const api = useRoom();
  const todos = api.state.todos[project.id] ?? [];
  const builds = api.state.builds[project.id] ?? [];
  const [preview, setPreview] = useState<Build | null>(null);
  const ready = todos.filter((t) => /builder/i.test(t.service ?? "") && !t.done && !builds.some((b) => b.todoId === t.id));

  if (!project.locked) {
    return (
      <div className={cn("mx-auto max-w-3xl py-10 sm:py-12", pageX)}>
        <PageHeader title="Builder" description={`Builds for ${project.name}`} action={<ProjectSwitcher />} />
        <Alert tone="warn">
          Builds read the locked profile, and {project.name} is still in intake mode. Lock the profile first (an admin approves the positioning line, then <span className="font-mono">/lock</span> in the chat).
        </Alert>
      </div>
    );
  }

  return (
    <div className={cn("mx-auto max-w-5xl py-10 sm:py-12", pageX)}>
      <PageHeader title="Builder" description={`Web and content builds for ${project.name}. Every build starts from a to do and is versioned.`} action={<ProjectSwitcher />} />

      <Alert tone="warn" title="Scope for version 1:" className="mb-8">
        single pages that fix failed checks (FAQ, About with the 5W, schema, titles) and content drafts from topics. Whole-site generation comes after the pilot shows demand.
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        {[
          { name: "Web builder", from: "A failed check or to do, such as a missing FAQ page or schema", out: "Page blocks rendered to HTML, with a preview", formats: "Page · FAQ · About · Landing page", publish: "The client's own domain through a hosting project, or export" },
          { name: "Content builder", from: "A topic from the topic bank, with channel and format", out: "Brief, copy and a visual spec per channel", formats: "Post · Short video script · FAQ · Blog", publish: "Export, or hand off to scheduling" },
        ].map((c) => (
          <section key={c.name} aria-label={c.name}>
            <Card className="h-full">
              <h2 className="font-title text-h3 text-ink-800">{c.name}</h2>
              <dl className="mt-5 space-y-4">
                {[["Starts from", c.from], ["Output", c.out], ["Formats", c.formats], ["Publish", c.publish]].map(([k, v]) => (
                  <div key={k} className="grid gap-1 sm:grid-cols-[6.5rem_1fr] sm:gap-4">
                    <dt className="label-caps text-ink-500 sm:pt-1">{k}</dt>
                    <dd className="text-[15px] leading-[1.5] text-ink-800">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </section>
        ))}
      </div>

      <section className="mt-16" aria-label="Ready to build">
        <h2 className={cn(caps, "mb-4 px-1")}>Ready to build · {ready.length}</h2>
        {ready.length === 0 ? (
          <EmptyState title="No open to do is waiting for a build." />
        ) : (
          <ul className="space-y-3">
            {ready.map((t) => (
              <li key={t.id}>
                <Card small className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="font-semibold">{t.title}</p>
                    <p className="mt-0.5 text-[14px] text-ink-500">{t.service} · fixes “{t.check}”</p>
                  </div>
                  {/* several rows, none is "the" main action — outline keeps Orange rare */}
                  <Btn size="sm" variant="secondary" onClick={() => api.startBuild(project.id, t)}>
                    <Hammer className="size-4" aria-hidden /> Start build
                  </Btn>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-16" aria-label="Builds">
        <h2 className={cn(caps, "mb-4 px-1")}>Builds · {builds.length}</h2>
        {builds.length === 0 ? (
          <EmptyState title="No builds yet." hint="Start one from a to do above, or with /build in the chat." />
        ) : (
          <ul className="space-y-3">
            {builds.map((b) => {
              const at = STAGES.findIndex((s) => s.key === b.stage);
              return (
                <li key={b.id}>
                  <Card small>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <p className="min-w-0 flex-1 basis-56 font-semibold">{b.title}</p>
                      <Chip tone="neutral">
                        {b.kind === "web" ? "Web" : "Content"} · <span className="font-mono">v{b.version}</span>
                      </Chip>
                    </div>
                    <ol className="mt-4 flex flex-wrap items-center gap-2" aria-label="Stage">
                      {STAGES.map((s, i) => (
                        <li key={s.key} className="flex items-center gap-2" aria-current={i === at ? "step" : undefined}>
                          <Chip tone={i < at || (i === at && b.stage === "published") ? "ok" : i === at ? "brand" : "neutral"}>{s.label}</Chip>
                          {i < STAGES.length - 1 && <span aria-hidden className="h-px w-5 bg-ink-200" />}
                        </li>
                      ))}
                    </ol>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Btn size="sm" variant="secondary" onClick={() => setPreview(b)}>
                        <Eye className="size-4" aria-hidden /> Open preview
                      </Btn>
                      {b.stage !== "published" ? (
                        <Btn size="sm" variant="dark" onClick={() => { api.advanceBuild(project.id, b.id); api.toast(b.stage === "draft" ? "Sent to review" : "Published — to do marked done, saved to Assets"); }}>
                          {b.stage === "draft" ? "Send to review" : "Publish build"}
                        </Btn>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-[14px] text-ink-500">
                          <Dot className="bg-success" /> To do marked done · output saved to Assets · chronicle updated
                        </span>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Sheet open={!!preview} onClose={() => setPreview(null)} title="Preview — draft page">
        {preview && (
          <>
            <iframe title="Build preview" sandbox="" srcDoc={previewHtml(project, preview)} className="h-[50dvh] w-full rounded-field border border-hairline bg-paper-0" />
            <p className="mt-4 text-[13px] leading-[1.5] text-ink-500">Sandboxed preview: scripts, forms and navigation are blocked, so generated HTML is safe to look at before it is published.</p>
          </>
        )}
      </Sheet>
    </div>
  );
}
