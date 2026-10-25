"use client";

// One project: Report, To do and Chronicle next to the project's chat (Assets and Builder are their own tabs).

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Hammer, Images, MessagesSquare, Play, Send, ShieldCheck } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import type { ChronicleKind, Project } from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { useRoom } from "../room-provider";
import { Bar, Btn, Chip, Sheet, inputCls } from "../ui";
import { ScoreChip } from "./projects-screen";

type Tab = "report" | "todo" | "chronicle";
const TABS: { key: Tab; label: string }[] = [
  { key: "report", label: "Report" },
  { key: "todo", label: "To do" },
  { key: "chronicle", label: "Chronicle" },
];

export function ProjectDetail({ id }: { id: string }) {
  const { state, href, open } = useRoom();
  const router = useRouter();
  const project = state.projects.find((p) => p.id === id && p.status === "active");
  const [tab, setTab] = useState<Tab>("report");
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ report: null, todo: null, chronicle: null });

  if (!project) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10">
        <EmptyState title="That project doesn't exist" hint="It may still be a draft — drafts live on the Chat start screen until you create the brand." />
        <Link href={href("/projects")} className="mt-4 inline-flex items-center gap-2 text-sm text-coral hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Project
        </Link>
      </div>
    );
  }

  const onTabKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.key === tab);
    const next = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length : -1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next].key);
    tabRefs.current[TABS[next].key]?.focus();
  };

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <Link href={href("/projects")} className="mb-4 inline-flex items-center gap-1.5 rounded text-sm text-slate-300 hover:text-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Project
      </Link>
      <PageHeader
        title={project.name}
        description={`${project.website} · ${project.locked ? `Profile v${project.profileVersion} locked` : "Intake mode"}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Btn
              variant="secondary"
              onClick={() => {
                open(project.id);
                router.push(href("/chat"));
              }}
            >
              <MessagesSquare className="h-4 w-4" aria-hidden /> Open chat
            </Btn>
            <Btn
              variant="secondary"
              onClick={() => {
                open(project.id);
                router.push(href("/assets"));
              }}
            >
              <Images className="h-4 w-4" aria-hidden /> Assets
            </Btn>
          </div>
        }
      />

      <div role="tablist" aria-label="Project sections" onKeyDown={onTabKey} className="mb-6 flex gap-1 border-b border-white/8">
        {TABS.map((t) => (
          <button
            key={t.key}
            ref={(el) => {
              tabRefs.current[t.key] = el;
            }}
            id={`tab-${t.key}`}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70",
              tab === t.key ? "border-coral text-coral" : "border-transparent text-slate-300 hover:text-mist",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="focus-visible:outline-none">
        {tab === "report" && <ReportTab project={project} goTodo={() => setTab("todo")} />}
        {tab === "todo" && <TodoTab project={project} />}
        {tab === "chronicle" && <ChronicleTab project={project} />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------ Report
const COST_LINES: [string, string][] = [
  ["Website + competitor crawl", "$1.20"],
  ["Search and AI-answer sampling", "$0.90"],
  ["Analysis and report writing", "$0.60"],
  ["Reserve", "$0.30"],
];

function ReportTab({ project, goTodo }: { project: Project; goTodo: () => void }) {
  const api = useRoom();
  const { state } = api;
  const report = state.reports[project.id];
  const approved = !!state.approved[project.id];
  const running = state.audit?.projectId === project.id ? state.audit : null;
  const isAdmin = state.role === "admin";
  const [runOpen, setRunOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shared, setShared] = useState<{ email: string; lang: string } | null>(null);
  const [email, setEmail] = useState("");
  const [lang, setLang] = useState<"id" | "en">("id");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState<string | undefined>();

  const runAudit = () => {
    api.startAudit(project.id);
    setRunOpen(false);
    api.toast("Audit started");
  };

  if (!report) {
    return (
      <>
        <EmptyState
          icon={<ShieldCheck className="h-5 w-5" />}
          title="No audit yet"
          hint={project.locked ? "Run the first audit to get a scorecard, ranked insights and a Week 1 plan." : "An audit needs a locked profile. An admin approves the positioning line, then locks it (/lock in the chat)."}
        />
        {project.locked && (
          <div className="mt-4 text-center">
            <Btn variant="primary" disabled={!!running} onClick={() => setRunOpen(true)}>
              <Play className="h-4 w-4" aria-hidden /> Run the first audit
            </Btn>
          </div>
        )}
        <RunSheet open={runOpen} onClose={() => setRunOpen(false)} onRun={runAudit} />
        {running && <AuditProgress pct={running.pct} />}
      </>
    );
  }

  const self = report.scorecard.find((s) => s.self);
  const send = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr("Enter the client's email address.");
    setShared({ email: email.trim(), lang });
    setShareOpen(false);
    setErr(undefined);
    api.addChronicle(project.id, "report", `Report #${report.audit} shared with ${email.trim()}`);
    api.toast("Link ready — in the real product this emails the client");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-lg font-bold">
          Audit #{report.audit} <span className="font-normal text-slate-300">· {report.date}</span>
        </h2>
        <ScoreChip score={report.score} />
        {approved ? <Chip tone="good" icon={<Check className="h-3 w-3" aria-hidden />}>Approved</Chip> : <Chip tone="warn">Draft — not shareable</Chip>}
        <div className="ml-auto flex flex-wrap gap-2">
          <Btn variant="secondary" disabled={!!running} onClick={() => setRunOpen(true)}>
            <Play className="h-4 w-4" aria-hidden /> Run a new audit
          </Btn>
          {!approved ? (
            <Btn variant="primary" disabled={!isAdmin} title={isAdmin ? undefined : "Only an admin can approve a report"} onClick={() => { api.approveReport(project.id); api.toast("Report approved"); }}>
              <Check className="h-4 w-4" aria-hidden /> Approve report
            </Btn>
          ) : (
            <Btn variant="primary" disabled={!isAdmin} title={isAdmin ? undefined : "Only an admin can share a report"} onClick={() => setShareOpen(true)}>
              <Send className="h-4 w-4" aria-hidden /> Share with client
            </Btn>
          )}
        </div>
      </div>
      {!isAdmin && <p className="-mt-3 text-xs text-slate-400">Approving and sharing a report is admin-only. A finished report stays a draft until an admin approves it.</p>}

      {running && <AuditProgress pct={running.pct} />}
      {shared && (
        <p role="status" className="flex flex-wrap items-center gap-2 rounded-xl border border-good/25 bg-good/5 px-4 py-3 text-sm text-good">
          <Check className="h-4 w-4 shrink-0" aria-hidden />
          Shared with {shared.email} ({shared.lang === "id" ? "Bahasa Indonesia" : "English"}) · read-only link, expires in 30 days.
          <button type="button" onClick={() => { setShared(null); api.toast("Link revoked"); }} className="ml-auto rounded px-2 py-1 text-xs font-semibold underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70">
            Revoke
          </button>
        </p>
      )}

      <section aria-label="Scorecard" className="rounded-2xl border border-white/8 bg-card/40">
        <h3 className="px-5 pt-4 font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-slate-400">Scorecard · Must · Nice · Try</h3>
        <div className="overflow-x-auto px-2 pb-3 pt-2">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th scope="col" className="px-3 py-2 font-medium">Brand</th>
                {["Must", "Nice", "Try"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>
                ))}
                <th scope="col" className="px-3 py-2 font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {report.scorecard.map((r) => (
                <tr key={r.name} className={cn("border-t border-white/8", r.self && "bg-coral/5")}>
                  <th scope="row" className="px-3 py-3 text-left font-semibold">
                    {r.name} {r.self && <Chip tone="coral" className="ml-1">You</Chip>}
                  </th>
                  {[r.must, r.nice, r.try].map((v, i) => (
                    <td key={i} className="px-3 py-3">
                      <div className="w-24">
                        <span className="font-mono text-sm font-semibold">{v}</span>
                        <div className="mt-1">
                          <Bar value={v} label={`${r.name} ${["Must", "Nice", "Try"][i]}`} tone={r.self ? "coral" : "good"} />
                        </div>
                      </div>
                    </td>
                  ))}
                  <td className="px-3 py-3 font-mono">{Math.round(r.coverage * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {self && <p className="px-5 pb-4 text-xs text-slate-400">Coverage is how much of the checklist could actually be measured for each brand — a low number means &ldquo;not measured&rdquo;, never &ldquo;failed&rdquo;.</p>}
      </section>

      <section aria-label="Insights">
        <h3 className="mb-3 font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-slate-400">Insights, ranked by priority</h3>
        <ul className="space-y-2.5">
          {report.insights.map((i) => (
            <li key={i.id} className="rounded-2xl border border-white/8 bg-card/40 px-4 py-3.5">
              <div className="flex flex-wrap items-start gap-3">
                <Chip tone={i.priority === 1 ? "bad" : i.priority === 2 ? "warn" : "neutral"}>P{i.priority}</Chip>
                <p className="min-w-0 flex-1 font-semibold">{i.title}</p>
                {i.todoId && (
                  <button type="button" onClick={goTodo} className="rounded px-2 py-1 text-xs font-semibold text-coral hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70">
                    See the to do
                  </button>
                )}
              </div>
              <details className="mt-2 text-sm text-slate-300">
                <summary className="cursor-pointer text-xs font-semibold text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70">Evidence</summary>
                <p className="mt-1.5">{i.evidence}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <RunSheet open={runOpen} onClose={() => setRunOpen(false)} onRun={runAudit} />
      <Sheet open={shareOpen} onClose={() => setShareOpen(false)} title="Share report with the client">
        <div className="space-y-4 text-sm">
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-slate-300">Language</legend>
            <div className="flex gap-2">
              {(["id", "en"] as const).map((l) => (
                <label key={l} className={cn("flex-1 cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm font-medium", lang === l ? "border-coral/50 bg-coral/10 text-coral" : "border-white/12 text-slate-200")}>
                  <input type="radio" name="lang" value={l} checked={lang === l} onChange={() => setLang(l)} className="sr-only" />
                  {l === "id" ? "Bahasa Indonesia" : "English"}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="client-email" className="mb-1.5 block text-xs font-semibold text-slate-300">Client&apos;s email</label>
            <input id="client-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="owner@kopisenja.id" />
            {err && <p role="alert" className="mt-1.5 text-xs text-bad">{err}</p>}
          </div>
          <div>
            <label htmlFor="client-msg" className="mb-1.5 block text-xs font-semibold text-slate-300">Message (optional)</label>
            <textarea id="client-msg" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} className={inputCls} />
          </div>
          <p className="text-xs text-slate-400">The client needs no account. The link opens a read-only page, expires after 30 days, records when it is first opened, and can be revoked.</p>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setShareOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={send}>Send link</Btn>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function AuditProgress({ pct }: { pct: number }) {
  return (
    <div role="status" className="rounded-2xl border border-coral/25 bg-coral/5 p-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold">Audit running…</span>
        <span className="font-mono text-slate-200">${((pct / 100) * 2.4).toFixed(2)} of $3.00 budget</span>
      </div>
      <div className="mt-2.5">
        <Bar value={pct} label="Audit progress" />
      </div>
    </div>
  );
}

function RunSheet({ open, onClose, onRun }: { open: boolean; onClose: () => void; onRun: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Run a new audit">
      <div className="space-y-4 text-sm">
        <p className="text-slate-200">
          Every audit shows its cost before it runs. This one will spend <strong className="text-mist">up to $3.00</strong> for the brand and its competitors. If spend reaches the hard stop, the run ends and keeps what it measured.
        </p>
        <ul className="divide-y divide-white/8 rounded-xl border border-white/8 bg-ink/30">
          {COST_LINES.map(([k, v]) => (
            <li key={k} className="flex items-center justify-between px-3.5 py-2.5">
              <span className="text-slate-200">{k}</span>
              <span className="font-mono text-slate-100">{v}</span>
            </li>
          ))}
          <li className="flex items-center justify-between px-3.5 py-2.5 font-semibold">
            <span>Budget</span>
            <span className="font-mono">$3.00</span>
          </li>
        </ul>
        <p className="text-xs text-slate-400">Estimated split. An admin can change the budget and alert level in Setting → Cost.</p>
        <div className="flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={onRun}>
            <Play className="h-4 w-4" aria-hidden /> Run audit
          </Btn>
        </div>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------------------------------------ To do
const GROUPS: { key: "week1" | "d30" | "d90" | "manual"; label: string }[] = [
  { key: "week1", label: "Week 1" },
  { key: "d30", label: "30 days" },
  { key: "d90", label: "90 days" },
  { key: "manual", label: "Manual" },
];
const PEOPLE = ["Dewi", "Andre", "Sari"];

function TodoTab({ project }: { project: Project }) {
  const api = useRoom();
  const router = useRouter();
  const todos = api.state.todos[project.id] ?? [];
  const builds = api.state.builds[project.id] ?? [];
  if (!todos.length) return <EmptyState title="No to dos yet" hint="The first audit turns its insights into a Week 1 plan. You can also add one from the chat with /todo." />;

  return (
    <div className="space-y-7">
      {GROUPS.map((g) => {
        const items = todos.filter((t) => t.group === g.key);
        if (!items.length) return null;
        return (
          <section key={g.key} aria-label={g.label}>
            <h3 className="mb-3 font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-slate-400">
              {g.label} · {items.filter((t) => !t.done).length} open
            </h3>
            <ul className="space-y-2.5">
              {items.map((t) => {
                const canBuild = /builder/i.test(t.service ?? "") && !t.done && !builds.some((b) => b.todoId === t.id);
                return (
                  <li key={t.id} className="rounded-2xl border border-white/8 bg-card/40 px-4 py-3.5">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={t.done}
                        aria-label={`${t.done ? "Reopen" : "Mark done"}: ${t.title}`}
                        onClick={() => api.toggleTodo(project.id, t.id)}
                        className={cn("mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70", t.done ? "border-good/50 bg-good/15 text-good" : "border-white/25 text-transparent hover:border-white/50")}
                      >
                        <Check className="h-4 w-4" aria-hidden />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={cn("font-semibold", t.done && "text-slate-400 line-through")}>{t.title}</p>
                        {t.check && (
                          <dl className="mt-1.5 grid gap-x-4 gap-y-1 text-xs text-slate-300 sm:grid-cols-[auto_1fr]">
                            <dt className="text-slate-400">Failed check</dt>
                            <dd>{t.check}</dd>
                            <dt className="text-slate-400">Tip</dt>
                            <dd>{t.tip}</dd>
                            <dt className="text-slate-400">Fixed by</dt>
                            <dd>{t.service}</dd>
                          </dl>
                        )}
                        {!t.check && <p className="mt-1 text-xs text-slate-400">Manual item</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 pl-9">
                      <label className="flex items-center gap-2 text-xs text-slate-300">
                        Assign
                        <select
                          value={t.assignee ?? ""}
                          onChange={(e) => api.assignTodo(project.id, t.id, e.target.value)}
                          className="rounded-lg border border-white/12 bg-ink/40 px-2 py-1.5 text-xs text-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70"
                        >
                          <option value="">Unassigned</option>
                          {PEOPLE.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </label>
                      {canBuild && (
                        <Btn
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            api.startBuild(project.id, t);
                            api.open(project.id);
                            router.push(api.href("/builder"));
                          }}
                        >
                          <Hammer className="h-3.5 w-3.5" aria-hidden /> Start a build
                        </Btn>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------------------------------ Chronicle
const KINDS: { key: ChronicleKind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "profile", label: "Profile" },
  { key: "audit", label: "Audit" },
  { key: "report", label: "Report" },
  { key: "todo", label: "To do" },
  { key: "build", label: "Build" },
  { key: "decision", label: "Decision" },
  { key: "file", label: "File" },
  { key: "note", label: "Note" },
];

function ChronicleTab({ project }: { project: Project }) {
  const api = useRoom();
  const entries = api.state.chronicle[project.id] ?? [];
  const [kind, setKind] = useState<ChronicleKind | "all">("all");
  const [note, setNote] = useState("");
  const shown = entries.filter((e) => kind === "all" || e.kind === kind);

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!note.trim()) return;
          api.addChronicle(project.id, "note", note.trim());
          setNote("");
        }}
        className="flex gap-2"
      >
        <label htmlFor="chron-note" className="sr-only">Add a note</label>
        <input id="chron-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note to the chronicle" className={inputCls} />
        <Btn type="submit" variant="primary" disabled={!note.trim()}>Add</Btn>
      </form>

      <div role="group" aria-label="Filter by kind" className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            aria-pressed={kind === k.key}
            onClick={() => setKind(k.key)}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70", kind === k.key ? "border-coral/50 bg-coral/10 text-coral" : "border-white/12 text-slate-300 hover:bg-white/5")}
          >
            {k.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">Nothing of that kind yet.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-white/10 pl-5" aria-label="Timeline">
          {shown.map((e) => (
            <li key={e.id} className="relative">
              <span aria-hidden className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-obsidian bg-coral" />
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="neutral" className="capitalize">{e.kind}</Chip>
                <span className="text-xs text-slate-400">{e.when}</span>
              </div>
              <p className="mt-1 text-sm text-slate-100">{e.text}</p>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-slate-400">Profile locks, finished audits and completed to dos are written automatically, so they can&apos;t be forgotten. Notes and decisions are written by their actions.</p>
    </div>
  );
}
