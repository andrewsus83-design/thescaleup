"use client";

// "What this chat can see": the exact bundle one turn receives, its size against the budget, and the
// pinned knowledge that fills what is left. Pin or unpin to change it; items that don't fit are flagged.
// The budget is BRAND's Ink "panel budget" (radius 20, padding 20, Title 800 32 number); everything else is flat white cards on Paper.

import { useId, useMemo } from "react";
import { CircleX, Pin } from "lucide-react";
import { buildBundle } from "@/lib/room/context";
import type { Project, UsedChip } from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { useRoom } from "../room-provider";
import { Alert, Bar, Chip, Dot, motion } from "../ui";

const fmt = (n: number) => n.toLocaleString("en-US");
const KIND_LABEL = { image: "image", audio: "audio", video: "video", document: "document", other: "other" } as const;

export function ContextMeter({ project, highlight }: { project: Project; highlight?: UsedChip["kind"] | null }) {
  const { state, togglePin } = useRoom();
  const titleId = useId();
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
  const tone = pct >= 95 ? "bad" : pct >= 80 ? "warn" : "brand";
  // the one highlight: the card a clicked source chip points at
  const ring = (kind: UsedChip["kind"]) => (highlight === kind ? "ring-2 ring-brand-600" : "");
  const counts = assets.reduce<Record<string, number>>((m, a) => ({ ...m, [a.kind]: (m[a.kind] ?? 0) + 1 }), {});
  const card = "rounded-bubble border border-hairline bg-paper-0";
  const caps = "font-mono text-code uppercase text-ink-500";

  return (
    <div className="space-y-6 text-[14px]">
      <section aria-labelledby={titleId} className="rounded-panel bg-ink-800 p-5 text-paper-100">
        <h2 id={titleId} className="font-mono text-code uppercase text-brand-500">
          What this chat can see
        </h2>
        <p className="mt-4 font-title text-[32px] font-extrabold leading-none tracking-[-0.02em]">
          {fmt(bundle.tokens)}
          <span className="ml-2 font-mono text-[13px] font-medium tracking-normal text-ink-300">/ {fmt(bundle.budget)}</span>
        </p>
        <div className="mt-4">
          <Bar value={bundle.tokens} max={bundle.budget} tone={tone} label="Context tokens used" onDark />
        </div>
        <p className="mt-4 text-[13px] leading-[1.5] text-ink-300">
          Only {project.name}&apos;s context is visible — other projects never are. Workspace rules are the one thing shared.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          {bundle.ready ? (
            <Chip tone="ok">Profile locked · ready</Chip>
          ) : (
            <>
              <Chip tone="warn">Intake mode</Chip>
              <span className="text-[13px] text-ink-300">Lock the profile to unlock the rest.</span>
            </>
          )}
        </div>
      </section>

      <ul className={cn(card, "p-2")} aria-label="Context sections">
        {bundle.sections.map((s) => (
          <li key={s.id} className={cn("flex items-start justify-between gap-3 rounded-field px-3 py-3", ring(s.id === "project" ? "profile" : (s.id as UsedChip["kind"])))}>
            <div className="min-w-0">
              <p className="font-semibold">{s.label}</p>
              <p className="text-[13px] text-ink-500">{s.detail}</p>
            </div>
            <span className="shrink-0 font-mono text-[13px] text-ink-500">{fmt(s.tokens)}</span>
          </li>
        ))}
      </ul>

      <div className={cn("space-y-3 rounded-bubble", highlight === "knowledge" && "ring-2 ring-brand-600 ring-offset-8 ring-offset-paper-100")}>
        <div className="flex items-center justify-between px-1">
          <h3 className={caps}>Pinned knowledge</h3>
          <span className="font-mono text-[13px] text-ink-500">{fmt(bundle.pinnedTokens)}</span>
        </div>
        {bundle.dropped > 0 && (
          <Alert tone="warn" role="alert">
            {bundle.dropped} pinned item{bundle.dropped === 1 ? "" : "s"} didn&apos;t fit the <span className="font-mono">{fmt(bundle.budget)}</span>-token budget and {bundle.dropped === 1 ? "is" : "are"} only searchable now. Unpin something to make room.
          </Alert>
        )}
        <ul className={cn(card, "p-2")}>
          {items.map((k) => {
            const state_ = k.failed ? "failed" : includedIds.has(k.id) ? "in" : droppedIds.has(k.id) ? "dropped" : "search";
            return (
              <li key={k.id} className="flex items-start gap-3 rounded-field px-3 py-3">
                <button
                  type="button"
                  aria-pressed={k.pinned}
                  aria-label={`${k.pinned ? "Unpin" : "Pin"} ${k.title}`}
                  disabled={!!k.failed}
                  onClick={() => togglePin(k.id)}
                  className={cn(
                    "hit-44 mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full border-[1.5px] disabled:pointer-events-none disabled:opacity-40",
                    motion,
                    k.pinned ? "border-ink-800 bg-ink-800 text-paper-100 hover:bg-ink-700" : "border-ink-200 text-ink-500 hover:bg-paper-100 hover:text-ink-800",
                  )}
                >
                  <Pin className="size-4" aria-hidden />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{k.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-500">
                    <span>{k.scope === "workspace" ? "Workspace rule" : "This project"}</span>
                    {!k.failed && <span className="font-mono">{fmt(k.tokens)} tokens</span>}
                    {state_ === "in" && (
                      <span className="inline-flex items-center gap-1.5">
                        <Dot className="size-1.5 bg-success" /> In context
                      </span>
                    )}
                    {state_ === "dropped" && (
                      <span className="inline-flex items-center gap-1.5">
                        <Dot className="size-1.5 bg-warning" /> Didn&apos;t fit — searchable only
                      </span>
                    )}
                    {state_ === "search" && (
                      <span className="inline-flex items-center gap-1.5">
                        <Dot className="size-1.5 bg-ink-300" /> Searchable on demand
                      </span>
                    )}
                  </p>
                  {k.failed && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-danger">
                      <CircleX className="size-4 shrink-0" aria-hidden /> Failed: {k.failed}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={cn(card, "px-5 py-4", ring("assets"))}>
        <h3 className={caps}>Assets</h3>
        {assets.length ? (
          <>
            <p className="mt-2 text-[13px] text-ink-800">
              <span className="font-mono">{assets.length}</span> files ·{" "}
              {Object.entries(counts)
                .map(([k, n]) => `${n} ${KIND_LABEL[k as keyof typeof KIND_LABEL]}${n === 1 ? "" : "s"}`)
                .join(" · ")}
            </p>
            <p className="mt-2 text-[13px] leading-[1.5] text-ink-500">Latest: {assets.slice(0, 8).map((a) => a.title).join(", ")}. The files themselves are found on demand, never put in the bundle.</p>
          </>
        ) : (
          <p className="mt-2 text-[13px] text-ink-500">No files yet.</p>
        )}
      </div>
    </div>
  );
}
