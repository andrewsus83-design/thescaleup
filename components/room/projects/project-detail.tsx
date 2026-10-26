"use client";

// One project: Report, To do and Chronicle next to the project's chat (Assets and Builder are their own tabs).

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, Hammer, Images, MessagesSquare, Play, Send, ShieldCheck } from "lucide-react";
import type { ChronicleKind, Project } from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { useRoom } from "../room-provider";
import { Alert, Bar, Btn, BudgetPanel, Card, Chip, EmptyState, PageHeader, Sheet, btnCls, errorCls, inputCls, labelCls, motion, pageX, pillCls, segItem, segWrap, textareaCls } from "../ui";
import { ScoreChip, ScoreNumber } from "./projects-screen";

type Tab = "report" | "todo" | "chronicle";
const TABS: { key: Tab; label: string }[] = [
  { key: "report", label: "Report" },
  { key: "todo", label: "To do" },
  { key: "chronicle", label: "Chronicle" },
];

/** Section label: Mono caps. */
const caps = "font-mono text-code uppercase text-ink-500";

export function ProjectDetail({ id }: { id: string }) {
  const { state, href, open } = useRoom();
  const router = useRouter();
  const project = state.projects.find((p) => p.id === id && p.status === "active");
  const [tab, setTab] = useState<Tab>("report");
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ report: null, todo: null, chronicle: null });

  if (!project) {
    return (
      <div className={cn("mx-auto max-w-3xl py-12", pageX)}>
        <EmptyState title="That project doesn't exist" hint="It may still be a draft — drafts live on the Chat start screen until you create the brand." />
        <Link href={href("/projects")} className={btnCls("ghost", "sm", "mt-4")}>
          <ArrowLeft className="size-4" aria-hidden /> Back to Project
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
    <div className={cn("mx-auto max-w-5xl py-10 sm:py-12", pageX)}>
      <Link href={href("/projects")} className={btnCls("ghost", "sm", "-ml-5 mb-2")}>
        <ArrowLeft className="size-4" aria-hidden /> Project
      </Link>
      <PageHeader
        title={project.name}
        description={project.locked ? `${project.website} · Profile v${project.profileVersion} locked` : `${project.website} · Intake mode`}
        action={
          <div className="flex flex-wrap gap-3">
            <Btn
              variant="secondary"
              className="hover:bg-paper-0"
              onClick={() => {
                open(project.id);
                router.push(href("/chat"));
              }}
            >
              <MessagesSquare className="size-4" aria-hidden /> Open chat
            </Btn>
            <Btn
              variant="secondary"
              className="hover:bg-paper-0"
              onClick={() => {
                open(project.id);
                router.push(href("/assets"));
              }}
            >
              <Images className="size-4" aria-hidden /> Open assets
            </Btn>
          </div>
        }
      />

      <div role="tablist" aria-label="Project sections" onKeyDown={onTabKey} className={cn(segWrap, "mb-8 flex max-w-full overflow-x-auto [scrollbar-width:none] sm:inline-flex")}>
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
            onClick={(e) => {
              setTab(t.key);
              e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" }); // keeps the chosen tab in view on a phone
            }}
            className={cn(segItem(tab === t.key), "shrink-0 px-4 sm:px-5")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="rounded-card">
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
          icon={<ShieldCheck className="size-5" />}
          title="No audit yet"
          hint={project.locked ? "Run the first audit to get a scorecard, ranked insights and a Week 1 plan." : "An audit needs a locked profile. An admin approves the positioning line, then locks it (/lock in the chat)."}
        >
          {project.locked && (
            <Btn size="lg" variant="primary" disabled={!!running} onClick={() => setRunOpen(true)}>
              <Play className="size-4" aria-hidden /> Run the first audit
            </Btn>
          )}
        </EmptyState>
        <RunSheet open={runOpen} onClose={() => setRunOpen(false)} onRun={runAudit} />
        {running && <div className="mt-6"><AuditProgress pct={running.pct} /></div>}
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
      <Card className="flex flex-wrap items-center gap-x-10 gap-y-6">
        <ScoreNumber score={report.score} className="text-display" />
        <div className="min-w-0 flex-1 basis-56">
          <h2 className="font-title text-h3 text-ink-800">
            Audit <span className="font-mono">#{report.audit}</span> <span className="font-normal text-ink-500">· {report.date}</span>
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <ScoreChip score={report.score} />
            {approved ? <Chip tone="ok">Approved</Chip> : <Chip tone="warn">Draft — not shareable</Chip>}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Btn variant="secondary" disabled={!!running} onClick={() => setRunOpen(true)}>
            <Play className="size-4" aria-hidden /> Run a new audit
          </Btn>
          {!approved ? (
            <Btn variant="primary" disabled={!isAdmin} title={isAdmin ? undefined : "Only an admin can approve a report"} onClick={() => { api.approveReport(project.id); api.toast("Report approved"); }}>
              <Check className="size-4" aria-hidden /> Approve report
            </Btn>
          ) : (
            <Btn variant="primary" disabled={!isAdmin} title={isAdmin ? undefined : "Only an admin can share a report"} onClick={() => setShareOpen(true)}>
              <Send className="size-4" aria-hidden /> Share with client
            </Btn>
          )}
        </div>
      </Card>
      {!isAdmin && <p className="text-[13px] text-ink-500">Approving and sharing a report is admin-only. A finished report stays a draft until an admin approves it.</p>}

      {running && <AuditProgress pct={running.pct} />}
      {shared && (
        <Alert tone="ok" role="status">
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              Shared with <strong className="font-semibold">{shared.email}</strong> ({shared.lang === "id" ? "Bahasa Indonesia" : "English"}) · read-only link, expires in <span className="font-mono">30</span> days.
            </span>
            <Btn size="xs" variant="ghost" onClick={() => { setShared(null); api.toast("Link revoked"); }}>
              Revoke link
            </Btn>
          </span>
        </Alert>
      )}

      <section aria-label="Scorecard" className="rounded-card border border-hairline bg-paper-0 shadow-raised">
        <h3 className={cn(caps, "px-6 pt-6 sm:px-8 sm:pt-8")}>Scorecard · Must · Nice · Try</h3>
        <div className="overflow-x-auto px-3 pb-3 pt-3 sm:px-5">
          <table className="w-full min-w-[600px] border-separate border-spacing-0 text-[15px]">
            <thead>
              <tr className="label-caps text-left text-ink-500">
                <th scope="col" className="px-4 py-3 font-medium">Brand</th>
                {["Must", "Nice", "Try"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>
                ))}
                <th scope="col" className="px-4 py-3 font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {report.scorecard.map((r) => {
                const cell = cn("h-16 px-4 group-hover:bg-paper-100 first:rounded-l-field last:rounded-r-field", motion, r.self && "bg-brand-50 text-brand-900 group-hover:bg-brand-50");
                return (
                  <tr key={r.name} className="group">
                    <th scope="row" className={cn(cell, "text-left font-semibold")}>
                      {r.name} {r.self && <Chip tone="brand" className="ml-2">You</Chip>}
                    </th>
                    {[r.must, r.nice, r.try].map((v, i) => (
                      <td key={i} className={cell}>
                        <div className="w-24">
                          <span className="font-mono text-[14px] font-semibold">{v}</span>
                          <div className="mt-1.5">
                            <Bar value={v} label={`${r.name} ${["Must", "Nice", "Try"][i]}`} tone={r.self ? "brand" : "neutral"} />
                          </div>
                        </div>
                      </td>
                    ))}
                    <td className={cn(cell, "font-mono text-[14px]")}>{Math.round(r.coverage * 100)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {self && <p className="px-6 pb-6 text-[13px] leading-[1.5] text-ink-500 sm:px-8 sm:pb-8">Coverage is how much of the checklist could actually be measured for each brand — a low number means &ldquo;not measured&rdquo;, never &ldquo;failed&rdquo;.</p>}
      </section>

      <section aria-label="Insights">
        <h3 className={cn(caps, "mb-4 px-1")}>Insights, ranked by priority</h3>
        <ul className="space-y-3">
          {report.insights.map((i) => (
            <li key={i.id} className="rounded-bubble border border-hairline bg-paper-0 p-5">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                <Chip tone={i.priority === 1 ? "bad" : i.priority === 2 ? "warn" : "neutral"}>
                  <span className="font-mono">P{i.priority}</span>
                </Chip>
                <p className="min-w-0 flex-1 basis-48 pt-1 text-[16px] font-semibold leading-[1.5]">{i.title}</p>
                {i.todoId && (
                  <Btn size="xs" variant="ghost" onClick={goTodo}>
                    View to do
                  </Btn>
                )}
              </div>
              <details className="group mt-2">
                <summary className={cn("hit-44 -ml-3 inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink-800 hover:bg-paper-100 [&::-webkit-details-marker]:hidden", motion)}>
                  Evidence <ChevronDown className="size-4 text-ink-500 group-open:rotate-180" aria-hidden />
                </summary>
                <p className="mt-2 text-[14px] leading-[1.6] text-ink-500">{i.evidence}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <RunSheet open={runOpen} onClose={() => setRunOpen(false)} onRun={runAudit} />
      <Sheet open={shareOpen} onClose={() => setShareOpen(false)} title="Share report with the client">
        <div className="space-y-5 text-[15px]">
          <fieldset>
            <legend className={labelCls}>Language</legend>
            <div className="flex gap-3">
              {(["id", "en"] as const).map((l) => (
                <label
                  key={l}
                  className={cn(
                    "flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-field border-[1.5px] px-4 py-2 text-center text-[15px] font-semibold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-600",
                    motion,
                    lang === l ? "border-ink-800 bg-paper-100" : "border-ink-200 hover:bg-paper-100",
                  )}
                >
                  <input type="radio" name="lang" value={l} checked={lang === l} onChange={() => setLang(l)} className="sr-only" />
                  {l === "id" ? "Bahasa Indonesia" : "English"}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="client-email" className={labelCls}>Client&apos;s email</label>
            <input id="client-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="owner@kopisenja.id" aria-invalid={!!err} aria-describedby={err ? "client-email-err" : undefined} />
            {err && <p id="client-email-err" role="alert" className={errorCls}>{err}</p>}
          </div>
          <div>
            <label htmlFor="client-msg" className={labelCls}>Message (optional)</label>
            <textarea id="client-msg" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} className={textareaCls} />
          </div>
          <p className="text-[13px] leading-[1.5] text-ink-500">The client needs no account. The link opens a read-only page, expires after <span className="font-mono">30</span> days, records when it is first opened, and can be revoked.</p>
          <div className="flex justify-end gap-3">
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
    <BudgetPanel live label="Audit running…" figure={`$${((pct / 100) * 2.4).toFixed(2)}`} unit="of $3.00 budget">
      <Bar value={pct} label="Audit progress" onDark />
    </BudgetPanel>
  );
}

function RunSheet({ open, onClose, onRun }: { open: boolean; onClose: () => void; onRun: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Run a new audit">
      <div className="space-y-5 text-[15px]">
        <p className="leading-[1.6] text-ink-800">
          Every audit shows its cost before it runs. This one will spend <strong className="font-semibold">up to <span className="font-mono">$3.00</span></strong> for the brand and its competitors. If spend reaches the hard stop, the run ends and keeps what it measured.
        </p>
        <ul className="rounded-field bg-paper-100 p-2">
          {COST_LINES.map(([k, v]) => (
            <li key={k} className="flex items-center justify-between gap-4 rounded-nav px-3 py-2.5">
              <span className="text-ink-800">{k}</span>
              <span className="font-mono text-[14px] text-ink-800">{v}</span>
            </li>
          ))}
          <li className="mt-1 flex items-center justify-between gap-4 border-t border-ink-200 px-3 pb-1.5 pt-3.5 font-semibold">
            <span>Budget</span>
            <span className="font-mono text-[14px]">$3.00</span>
          </li>
        </ul>
        <p className="text-[13px] leading-[1.5] text-ink-500">Estimated split. An admin can change the budget and alert level in Setting → Cost.</p>
        <div className="flex justify-end gap-3">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={onRun}>
            <Play className="size-4" aria-hidden /> Run audit
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
    <div className="space-y-12">
      {GROUPS.map((g) => {
        const items = todos.filter((t) => t.group === g.key);
        if (!items.length) return null;
        return (
          <section key={g.key} aria-label={g.label}>
            <h3 className={cn(caps, "mb-4 px-1")}>
              {g.label} · {items.filter((t) => !t.done).length} open
            </h3>
            <ul className="space-y-3">
              {items.map((t) => {
                const canBuild = /builder/i.test(t.service ?? "") && !t.done && !builds.some((b) => b.todoId === t.id);
                return (
                  <li key={t.id} className="rounded-bubble border border-hairline bg-paper-0 p-5">
                    <div className="flex items-start gap-4">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={t.done}
                        aria-label={`${t.done ? "Reopen" : "Mark done"}: ${t.title}`}
                        onClick={() => api.toggleTodo(project.id, t.id)}
                        className={cn(
                          "hit-44 mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-lg border-[1.5px]",
                          motion,
                          t.done ? "border-success bg-success-bg text-success-ink" : "border-ink-200 text-transparent hover:border-ink-500",
                        )}
                      >
                        <Check className="size-4" aria-hidden />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-[16px] font-semibold leading-[1.5]", t.done && "text-ink-500 line-through")}>{t.title}</p>
                        {t.check && (
                          <dl className="mt-2 grid gap-x-4 gap-y-1 text-[14px] leading-[1.5] sm:grid-cols-[auto_1fr]">
                            <dt className="text-ink-500">Failed check</dt>
                            <dd>{t.check}</dd>
                            <dt className="text-ink-500">Tip</dt>
                            <dd>{t.tip}</dd>
                            <dt className="text-ink-500">Fixed by</dt>
                            <dd>{t.service}</dd>
                          </dl>
                        )}
                        {!t.check && <p className="mt-1 text-[14px] text-ink-500">Manual item</p>}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3 pl-10">
                      <label className="flex items-center gap-3 text-[13px] font-semibold text-ink-500">
                        Assign
                        <select
                          value={t.assignee ?? ""}
                          onChange={(e) => api.assignTodo(project.id, t.id, e.target.value)}
                          className={cn("h-11 rounded-full border-[1.5px] border-ink-200 bg-paper-0 px-4 text-[14px] font-semibold text-ink-800 hover:bg-paper-100", motion)}
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
                          <Hammer className="size-4" aria-hidden /> Start a build
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
    <div className="space-y-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!note.trim()) return;
          api.addChronicle(project.id, "note", note.trim());
          setNote("");
        }}
        className="flex items-center gap-3"
      >
        <label htmlFor="chron-note" className="sr-only">Add a note</label>
        <input id="chron-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note to the chronicle" className={inputCls} />
        <Btn type="submit" size="lg" variant="primary" disabled={!note.trim()}>Add note</Btn>
      </form>

      <div role="group" aria-label="Filter by kind" className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button key={k.key} type="button" aria-pressed={kind === k.key} onClick={() => setKind(k.key)} className={pillCls(kind === k.key)}>
            {k.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState title="Nothing of that kind yet." />
      ) : (
        <ol className="relative space-y-6 border-l-[1.5px] border-ink-200 pl-7" aria-label="Timeline">
          {shown.map((e) => (
            <li key={e.id} className="relative">
              <span aria-hidden className="absolute -left-[33px] top-3 size-2.5 rounded-full bg-ink-800 ring-4 ring-paper-100" />
              <div className="flex flex-wrap items-center gap-3">
                <Chip tone="neutral" className="capitalize">{e.kind}</Chip>
                <span className="text-[13px] text-ink-500">{e.when}</span>
              </div>
              <p className="mt-2 text-[15px] leading-[1.6] text-ink-800">{e.text}</p>
            </li>
          ))}
        </ol>
      )}
      <p className="text-[13px] leading-[1.5] text-ink-500">Profile locks, finished audits and completed to dos are written automatically, so they can&apos;t be forgotten. Notes and decisions are written by their actions.</p>
    </div>
  );
}
