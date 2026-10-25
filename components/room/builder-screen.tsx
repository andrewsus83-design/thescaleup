"use client";

// Builder tab: web and content builds for the active brand. A build starts from a failed check or to do,
// is versioned, and moves draft → review → published; publishing marks the to do done, writes the
// chronicle and saves the output back as an asset. The preview is a sandboxed iframe (no scripts).

import { useState } from "react";
import { Check, Eye, Hammer, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import type { Build, Project } from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { NeedProject, ProjectSwitcher } from "./project-switcher";
import { useRoom } from "./room-provider";
import { Btn, Chip, Sheet } from "./ui";

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
      <div className="mx-auto max-w-3xl px-5 py-8">
        <PageHeader title="Builder" description={`Builds for ${project.name}`} action={<ProjectSwitcher />} />
        <p className="rounded-2xl border border-warn/30 bg-warn/10 px-4 py-4 text-sm text-warn">
          Builds read the locked profile, and {project.name} is still in intake mode. Lock the profile first (an admin approves the positioning line, then /lock in the chat).
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <PageHeader title="Builder" description={`Web and content builds for ${project.name}. Every build starts from a to do and is versioned.`} action={<ProjectSwitcher />} />

      <p className="mb-6 flex items-start gap-3 rounded-2xl border border-warn/25 bg-warn/5 px-4 py-3.5 text-sm text-warn">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          <strong>Scope for version 1:</strong> single pages that fix failed checks (FAQ, About with the 5W, schema, titles) and content drafts from topics. Whole-site generation comes after the pilot shows demand.
        </span>
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { name: "Web builder", from: "A failed check or to do, such as a missing FAQ page or schema", out: "Page blocks rendered to HTML, with a preview", formats: "Page · FAQ · About · Landing page", publish: "The client's own domain through a hosting project, or export" },
          { name: "Content builder", from: "A topic from the topic bank, with channel and format", out: "Brief, copy and a visual spec per channel", formats: "Post · Short video script · FAQ · Blog", publish: "Export, or hand off to scheduling" },
        ].map((c) => (
          <section key={c.name} className="rounded-2xl border border-white/8 bg-card/40 p-5" aria-label={c.name}>
            <h2 className="font-display text-base font-bold">{c.name}</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {[["Starts from", c.from], ["Output", c.out], ["Formats", c.formats], ["Publish", c.publish]].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[88px_1fr] gap-3">
                  <dt className="text-xs text-slate-400">{k}</dt>
                  <dd className="text-slate-100">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <section className="mt-8" aria-label="Ready to build">
        <h2 className="mb-3 font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-slate-400">Ready to build · {ready.length}</h2>
        {ready.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-400">No open to do is waiting for a build.</p>
        ) : (
          <ul className="space-y-2.5">
            {ready.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-card/40 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t.title}</p>
                  <p className="text-xs text-slate-400">{t.service} · fixes “{t.check}”</p>
                </div>
                <Btn size="sm" variant="primary" onClick={() => api.startBuild(project.id, t)}>
                  <Hammer className="h-3.5 w-3.5" aria-hidden /> Start build
                </Btn>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8" aria-label="Builds">
        <h2 className="mb-3 font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-slate-400">Builds · {builds.length}</h2>
        {builds.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-400">No builds yet. Start one from a to do above, or with /build in the chat.</p>
        ) : (
          <ul className="space-y-3">
            {builds.map((b) => {
              const at = STAGES.findIndex((s) => s.key === b.stage);
              return (
                <li key={b.id} className="rounded-2xl border border-white/8 bg-card/40 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="min-w-0 flex-1 font-semibold">{b.title}</p>
                    <Chip tone="neutral">{b.kind === "web" ? "Web" : "Content"} · v{b.version}</Chip>
                  </div>
                  <ol className="mt-3 flex items-center gap-2" aria-label="Stage">
                    {STAGES.map((s, i) => (
                      <li key={s.key} className="flex items-center gap-2" aria-current={i === at ? "step" : undefined}>
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", i < at || (i === at && b.stage === "published") ? "border-good/30 bg-good/10 text-good" : i === at ? "border-coral/40 bg-coral/10 text-coral" : "border-white/10 text-slate-400")}>
                          {(i < at || (i === at && b.stage === "published")) && <Check className="h-3 w-3" aria-hidden />}
                          {s.label}
                        </span>
                        {i < STAGES.length - 1 && <span aria-hidden className="h-px w-5 bg-white/15" />}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Btn size="sm" variant="secondary" onClick={() => setPreview(b)}>
                      <Eye className="h-3.5 w-3.5" aria-hidden /> Preview
                    </Btn>
                    {b.stage !== "published" ? (
                      <Btn size="sm" variant="primary" onClick={() => { api.advanceBuild(project.id, b.id); api.toast(b.stage === "draft" ? "Sent to review" : "Published — to do marked done, saved to Assets"); }}>
                        {b.stage === "draft" ? "Send to review" : "Publish"}
                      </Btn>
                    ) : (
                      <span className="text-xs text-good">To do marked done · output saved to Assets · chronicle updated</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Sheet open={!!preview} onClose={() => setPreview(null)} title="Preview — draft page">
        {preview && (
          <>
            <iframe title="Build preview" sandbox="" srcDoc={previewHtml(project, preview)} className="h-[50dvh] w-full rounded-xl border border-white/10 bg-white" />
            <p className="mt-3 text-xs text-slate-400">Sandboxed preview: scripts, forms and navigation are blocked, so generated HTML is safe to look at before it is published.</p>
          </>
        )}
      </Sheet>
    </div>
  );
}
