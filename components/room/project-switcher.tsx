"use client";

// The project chip: shows which brand the screen is working in and switches it. Used at the top of
// Chat, Builder and Assets (all of which only work inside a project).

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIntakeStarter } from "./chat/use-intake";
import { useRoom } from "./room-provider";

export function ProjectSwitcher({ className }: { className?: string }) {
  const { state, activeProject, open } = useRoom();
  const startIntake = useIntakeStarter();
  const [isOpen, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  const projects = state.projects.filter((p) => p.status === "active");

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-full items-center gap-2 rounded-xl border border-white/12 bg-card/60 px-3 py-2 text-sm font-semibold text-mist transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70"
      >
        <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", activeProject ? "bg-good" : "bg-slate-500")} />
        <span className="truncate">{activeProject?.name ?? "Pick a project"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
      </button>
      {isOpen && (
        <ul role="listbox" aria-label="Projects" className="absolute left-0 z-30 mt-2 w-72 max-w-[85vw] overflow-hidden rounded-2xl border border-white/10 bg-surface p-1.5 shadow-2xl">
          {projects.map((p) => (
            <li key={p.id} role="option" aria-selected={p.id === activeProject?.id}>
              <button
                type="button"
                onClick={() => {
                  open(p.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70",
                  p.id === activeProject?.id && "bg-coral/10 text-coral",
                )}
              >
                <span className="truncate font-medium">{p.name}</span>
                <span className="shrink-0 text-xs text-slate-400">{p.locked ? `Profile v${p.profileVersion}` : "Intake mode"}</span>
              </button>
            </li>
          ))}
          <li role="presentation" className="mt-1 border-t border-white/8 pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                startIntake();
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-coral hover:bg-coral/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70"
            >
              <Plus className="h-4 w-4" aria-hidden /> Create a new brand
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

/** Shown by Builder / Assets / Chat when no project is selected: "no project, no work". */
export function NeedProject({ what }: { what: string }) {
  const { state, open } = useRoom();
  const startIntake = useIntakeStarter();
  const projects = state.projects.filter((p) => p.status === "active");
  return (
    <div className="mx-auto max-w-xl px-5 py-14 text-center">
      <h1 className="font-display text-2xl font-extrabold">Pick a project first</h1>
      <p className="mt-2 text-sm text-slate-400">{what} works inside one brand and only sees that brand&apos;s context.</p>
      <ul className="mt-6 space-y-2 text-left">
        {projects.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => open(p.id)}
              className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-card/40 px-4 py-3 text-left transition-colors hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70"
            >
              <span className="font-semibold">{p.name}</span>
              <span className="text-xs text-slate-400">{p.website}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => startIntake()}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-ink hover:bg-coral-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70"
      >
        <Plus className="h-4 w-4" aria-hidden /> Create a new brand
      </button>
    </div>
  );
}
