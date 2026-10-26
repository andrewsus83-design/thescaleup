"use client";

// The project chip: shows which brand the screen is working in and switches it. Used at the top of
// Chat, Builder and Assets (all of which only work inside a project).

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIntakeStarter } from "./chat/use-intake";
import { useRoom } from "./room-provider";
import { Btn, Dot, motion } from "./ui";

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
        className={cn(
          "flex h-11 max-w-full items-center gap-3 rounded-full border-[1.5px] border-ink-200 bg-paper-0 pl-4 pr-3.5 text-[15px] font-semibold leading-none text-ink-800 hover:bg-paper-100",
          motion,
        )}
      >
        <Dot className={activeProject ? "bg-success" : "bg-ink-300"} />
        <span className="truncate">{activeProject?.name ?? "Pick a project"}</span>
        <ChevronDown className="size-4 shrink-0 text-ink-500" aria-hidden />
      </button>
      {isOpen && (
        <ul role="listbox" aria-label="Projects" className="absolute left-0 z-30 mt-2 w-72 max-w-[85vw] rounded-panel border border-hairline bg-paper-0 p-2 shadow-raised">
          {projects.map((p) => (
            <li key={p.id} role="option" aria-selected={p.id === activeProject?.id}>
              <button
                type="button"
                onClick={() => {
                  open(p.id);
                  setOpen(false);
                }}
                className={cn("flex min-h-11 w-full items-center justify-between gap-3 rounded-nav px-4 py-2.5 text-left text-[15px] hover:bg-paper-100", motion, p.id === activeProject?.id && "bg-paper-100")}
              >
                <span className="truncate font-semibold">{p.name}</span>
                <span className="shrink-0 text-[13px] text-ink-500">{p.locked ? <>Profile <span className="font-mono">v{p.profileVersion}</span></> : "Intake mode"}</span>
              </button>
            </li>
          ))}
          <li role="presentation" className="mt-1 border-t border-hairline pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                startIntake();
              }}
              className={cn("flex min-h-11 w-full items-center gap-2 rounded-nav px-4 py-2.5 text-left text-[15px] font-semibold text-brand-700 hover:bg-brand-50", motion)}
            >
              <Plus className="size-4" aria-hidden /> Create a new brand
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
    <div className="mx-auto max-w-xl px-5 py-16 text-center sm:px-8">
      <h1 className="font-title text-balance text-h2 text-ink-800">Pick a project first</h1>
      <p className="mt-3 text-pretty text-body text-ink-500">{what} works inside one brand and only sees that brand&apos;s context.</p>
      <ul className="mt-8 space-y-3 text-left">
        {projects.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => open(p.id)}
              className={cn("flex min-h-16 w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-bubble border border-hairline bg-paper-0 px-5 py-3 text-left hover:shadow-overlay", motion)}
            >
              <span className="font-semibold text-ink-800">{p.name}</span>
              <span className="text-[14px] text-ink-500">{p.website}</span>
            </button>
          </li>
        ))}
      </ul>
      <Btn size="lg" variant="primary" className="mt-8" onClick={() => startIntake()}>
        <Plus className="size-5" aria-hidden /> Create a new brand
      </Btn>
    </div>
  );
}
