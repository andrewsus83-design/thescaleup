"use client";

// One project: Report, To do, Chronicle and Integrations next to the project's chat (Assets and Builder are their own tabs).
// The Report tab is the real report of report.thescaleup.xyz (Performance and Analytic): the server renders it
// (components/report/room-report.tsx) and hands it in as `report`; this file only frames it and switches between the two screens.
// The To do tab is a Trello-style board (./todo-board.tsx).

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Images, MessagesSquare } from "lucide-react";
import type { ChronicleKind, Project } from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { useRoom } from "../room-provider";
import { Btn, Chip, EmptyState, PageHeader, btnCls, inputCls, pageX, pillCls, segItem, segWrap } from "../ui";
import type { BrandKeys } from "./brand-keys";
import { IntegrationsTab } from "./integrations";
import { TodoBoard } from "./todo-board";

type Tab = "report" | "todo" | "chronicle" | "integrations";
const TABS: { key: Tab; label: string }[] = [
  { key: "report", label: "Report" },
  { key: "todo", label: "To do" },
  { key: "chronicle", label: "Chronicle" },
  { key: "integrations", label: "Integrations" },
];

export function ProjectDetail({ id, report }: { id: string; report: React.ReactNode }) {
  const { state, href, open, setBrandKey, deleteBrandKey } = useRoom();
  const router = useRouter();
  const params = useSearchParams();
  const project = state.projects.find((p) => p.id === id && p.status === "active");
  const initialTab = (params.get("tab") as Tab | null);
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.key === initialTab) ? (initialTab as Tab) : "report");
  const brandKeys: BrandKeys = (state.brandKeys[id] ?? {}) as BrandKeys;
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ report: null, todo: null, chronicle: null, integrations: null });

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
        {tab === "report" && <ReportPanel report={report} />}
        {tab === "todo" && <TodoBoard project={project} />}
        {tab === "chronicle" && <ChronicleTab project={project} />}
        {tab === "integrations" && (
          <IntegrationsTab
            project={project}
            keys={brandKeys}
            onSet={(pid, key) => setBrandKey(id, pid, key)}
            onDelete={(pid) => deleteBrandKey(id, pid)}
          />
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------ Report
const REPORT_HOST = process.env.NEXT_PUBLIC_REPORT_URL ?? "https://report.thescaleup.xyz";

function ReportPanel({ report }: { report: React.ReactNode }) {
  const params = useSearchParams();
  /** The same channels on the report platform itself, to compare side by side. */
  const original = (() => {
    const q = new URLSearchParams();
    for (const k of ["accounts", "account", "webs"]) if (params.get(k)) q.set(k, params.get(k)!);
    const s = q.toString();
    return `${REPORT_HOST}/admin${s ? `?${s}` : ""}`;
  })();

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <a href={original} target="_blank" rel="noreferrer" className={btnCls("ghost", "sm")}>
          Open on report.thescaleup.xyz <ExternalLink className="size-4" aria-hidden />
        </a>
      </div>
      <p className="max-w-chat text-pretty text-caption text-ink-500">
        This is the live report: the same brands, accounts and numbers as report.thescaleup.xyz. Projects are not linked to a report brand yet, so choose the brand and account in the channel list.
      </p>
      {report}
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
  { key: "settings", label: "Settings" },
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
