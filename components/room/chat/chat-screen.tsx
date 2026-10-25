"use client";

// Chat tab. "No project, no chat": with nothing selected, a new chat opens the project picker; creating a
// brand starts the guided intake; choosing a project opens its chat.

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import type { Project } from "@/lib/room/types";
import { useRoom } from "../room-provider";
import { Chip, inputCls } from "../ui";
import { IntakeChat } from "./intake-chat";
import { ProjectChat } from "./project-chat";
import { useIntakeStarter } from "./use-intake";

export function ChatScreen() {
  const { state, activeProject } = useRoom();
  if (state.intake) return <IntakeChat />;
  if (!activeProject) return <StartScreen />;
  return <ProjectChat key={activeProject.id} project={activeProject} />;
}

function StartScreen() {
  const { state, open } = useRoom();
  const startIntake = useIntakeStarter();
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const list = state.projects.filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.website.includes(needle));

  const pick = (p: Project) => (p.status === "draft" ? startIntake(p) : open(p.id));

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Which brand are we working on?</h1>
      <p className="mt-2 text-sm text-slate-300">
        Every chat belongs to exactly one brand, so it only ever sees that brand&apos;s context. There is no chat without a project.
      </p>

      <button
        type="button"
        onClick={() => startIntake()}
        className="mt-7 flex h-14 w-full items-center gap-3 rounded-2xl bg-coral px-5 text-base font-semibold text-ink transition-colors hover:bg-coral-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70 focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian"
      >
        <Plus className="h-5 w-5" aria-hidden /> Create a new brand
      </button>

      <div className="mt-9">
        <label htmlFor="project-search" className="sr-only">
          Search projects
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input id="project-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects by name or website" className={`${inputCls} pl-10`} />
        </div>

        <ul className="mt-3 space-y-2" aria-label="Projects">
          {list.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => pick(p)}
                className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-white/8 bg-card/40 px-4 py-3.5 text-left transition-colors hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block truncate text-xs text-slate-400">
                    {p.website} · {p.lastActivity}
                  </span>
                </span>
                {p.status === "draft" ? (
                  <Chip tone="warn">Draft · resume intake</Chip>
                ) : p.locked ? (
                  <Chip tone="good">Profile v{p.profileVersion}</Chip>
                ) : (
                  <Chip tone="neutral">Intake mode</Chip>
                )}
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">No project matches “{q}”.</li>}
        </ul>
        <p className="mt-3 text-xs text-slate-400">Unfinished intakes show up here as drafts so you can resume them. Drafts stay out of the Project tab until you create the brand.</p>
      </div>
    </div>
  );
}
