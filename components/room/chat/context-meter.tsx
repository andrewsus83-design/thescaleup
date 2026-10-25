"use client";

// "What this chat can see": the exact bundle one turn receives, its size against the budget, and the
// pinned knowledge that fills what is left. Pin or unpin to change it; items that don't fit are flagged.

import { useMemo } from "react";
import { CircleAlert, CircleX, Pin } from "lucide-react";
import { buildBundle } from "@/lib/room/context";
import type { Project, UsedChip } from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { useRoom } from "../room-provider";
import { Bar, Chip } from "../ui";

const fmt = (n: number) => n.toLocaleString("en-US");
const KIND_LABEL = { image: "image", audio: "audio", video: "video", document: "document", other: "other" } as const;

export function ContextMeter({ project, highlight }: { project: Project; highlight?: UsedChip["kind"] | null }) {
  const { state, togglePin } = useRoom();
  const todos = state.todos[project.id];
  const chronicleCount = (state.chronicle[project.id] ?? []).length;
  const hasReport = !!state.reports[project.id];

  const bundle = useMemo(
    () => buildBundle({ project, todos: todos ?? [], hasReport, chronicleCount, knowledge: state.knowledge }),
    [project, todos, hasReport, chronicleCount, state.knowledge],
  );
  const includedIds = new Set(bundle.pinned.filter((p) => p.included).map((p) => p.item.id));
  const droppedIds = new Set(bundle.pinned.filter((p) => !p.included).map((p) => p.item.id));
  const items = state.knowledge
    .filter((k) => k.scope === "workspace" || k.projectId === project.id)
    .sort((a, b) => (a.scope === b.scope ? 0 : a.scope === "workspace" ? -1 : 1));
  const assets = state.assets[project.id] ?? [];

  const pct = (bundle.tokens / bundle.budget) * 100;
  const tone = pct >= 95 ? "bad" : pct >= 80 ? "warn" : "coral";
  const ring = (kind: UsedChip["kind"]) => (highlight === kind ? "ring-2 ring-coral/60" : "");
  const counts = assets.reduce<Record<string, number>>((m, a) => ({ ...m, [a.kind]: (m[a.kind] ?? 0) + 1 }), {});

  return (
    <div className="space-y-5 text-sm">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-base font-bold">What this chat can see</h2>
          <span className="shrink-0 font-mono text-xs text-slate-300">
            {fmt(bundle.tokens)} / {fmt(bundle.budget)}
          </span>
        </div>
        <div className="mt-2.5">
          <Bar value={bundle.tokens} max={bundle.budget} tone={tone} label="Context tokens used" />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Only {project.name}&apos;s context is visible — other projects never are. Workspace rules are the one thing shared.
        </p>
        <div className="mt-2.5">
          {bundle.ready ? <Chip tone="good">Profile locked · ready</Chip> : <Chip tone="warn">Intake mode · lock the profile to unlock the rest</Chip>}
        </div>
      </div>

      <ul className="space-y-1.5" aria-label="Context sections">
        {bundle.sections.map((s) => (
          <li key={s.id} className={cn("flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-card/40 px-3.5 py-2.5", ring(s.id === "project" ? "profile" : (s.id as UsedChip["kind"])))}>
            <div className="min-w-0">
              <p className="font-semibold">{s.label}</p>
              <p className="text-xs text-slate-400">{s.detail}</p>
            </div>
            <span className="shrink-0 font-mono text-xs text-slate-300">{fmt(s.tokens)}</span>
          </li>
        ))}
      </ul>

      <div className={cn("rounded-2xl", ring("knowledge"))}>
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-slate-400">Pinned knowledge</h3>
          <span className="font-mono text-xs text-slate-300">{fmt(bundle.pinnedTokens)}</span>
        </div>
        {bundle.dropped > 0 && (
          <div role="alert" className="mt-2 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2.5 text-xs text-warn">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {bundle.dropped} pinned item{bundle.dropped === 1 ? "" : "s"} didn&apos;t fit the {fmt(bundle.budget)}-token budget and {bundle.dropped === 1 ? "is" : "are"} only searchable now. Unpin something to make room.
            </span>
          </div>
        )}
        <ul className="mt-2 space-y-1.5">
          {items.map((k) => {
            const state_ = k.failed ? "failed" : includedIds.has(k.id) ? "in" : droppedIds.has(k.id) ? "dropped" : "search";
            return (
              <li key={k.id} className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-card/40 px-3 py-2.5">
                <button
                  type="button"
                  aria-pressed={k.pinned}
                  aria-label={`${k.pinned ? "Unpin" : "Pin"} ${k.title}`}
                  disabled={!!k.failed}
                  onClick={() => togglePin(k.id)}
                  className={cn(
                    "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70 disabled:opacity-40",
                    k.pinned ? "border-coral/40 bg-coral/15 text-coral" : "border-white/12 text-slate-300 hover:bg-white/5",
                  )}
                >
                  <Pin className="h-3.5 w-3.5" aria-hidden />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{k.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                    <span>{k.scope === "workspace" ? "Workspace rule" : "This project"}</span>
                    {!k.failed && <span className="font-mono">{fmt(k.tokens)} tokens</span>}
                    {state_ === "in" && <span className="text-good">In context</span>}
                    {state_ === "dropped" && <span className="text-warn">Didn&apos;t fit — searchable only</span>}
                    {state_ === "search" && <span>Searchable on demand</span>}
                  </p>
                  {k.failed && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-bad">
                      <CircleX className="h-3.5 w-3.5 shrink-0" aria-hidden /> Failed: {k.failed}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={cn("rounded-xl border border-white/8 bg-card/40 px-3.5 py-3", ring("assets"))}>
        <h3 className="font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-slate-400">Assets</h3>
        {assets.length ? (
          <>
            <p className="mt-1.5 text-xs text-slate-300">
              {assets.length} files ·{" "}
              {Object.entries(counts)
                .map(([k, n]) => `${n} ${KIND_LABEL[k as keyof typeof KIND_LABEL]}${n === 1 ? "" : "s"}`)
                .join(" · ")}
            </p>
            <p className="mt-1 text-xs text-slate-400">Latest: {assets.slice(0, 8).map((a) => a.title).join(", ")}. The files themselves are found on demand, never put in the bundle.</p>
          </>
        ) : (
          <p className="mt-1.5 text-xs text-slate-400">No files yet.</p>
        )}
      </div>
    </div>
  );
}
