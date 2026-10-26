"use client";

// Chat tab. "No project, no chat": with nothing selected, a new chat opens the project picker; creating a
// brand starts the guided intake; choosing a project opens its chat.

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import type { Project } from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { useRoom } from "../room-provider";
import { Btn, Chip, inputCls, motion } from "../ui";
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
    <div className="min-h-full bg-paper-0 px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-chat">
        <h1 className="font-title text-balance text-h2 text-ink-800">Which brand are we working on?</h1>
        <p className="mt-3 text-pretty text-body text-ink-500">
          Every chat belongs to exactly one brand, so it only ever sees that brand&apos;s context. There is no chat without a project.
        </p>

        <Btn size="lg" variant="primary" className="mt-8 w-full sm:w-auto" onClick={() => startIntake()}>
          <Plus className="size-5" aria-hidden /> Create a new brand
        </Btn>

        <div className="mt-16">
          <label htmlFor="project-search" className="sr-only">
            Search projects
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-ink-500" aria-hidden />
            <input id="project-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects by name or website" className={cn(inputCls, "pl-12")} />
          </div>

          <ul className="mt-4 space-y-1" aria-label="Projects">
            {list.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pick(p)}
                  className={cn("flex min-h-16 w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-field px-4 py-2 text-left hover:bg-paper-100", motion)}
                >
                  <span className="min-w-0 flex-1 basis-40">
                    <span className="block truncate font-semibold text-ink-800">{p.name}</span>
                    <span className="block truncate text-[14px] text-ink-500">
                      {p.website} · {p.lastActivity}
                    </span>
                  </span>
                  {p.status === "draft" ? (
                    <Chip tone="warn">Draft · resume intake</Chip>
                  ) : p.locked ? (
                    <Chip tone="ok">
                      Profile <span className="font-mono">v{p.profileVersion}</span>
                    </Chip>
                  ) : (
                    <Chip tone="neutral">Intake mode</Chip>
                  )}
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="rounded-field border-[1.5px] border-dashed border-ink-200 px-4 py-8 text-center text-[14px] text-ink-500">No project matches “{q}”.</li>}
          </ul>
          <p className="mt-4 text-[13px] leading-[1.5] text-ink-500">Unfinished intakes show up here as drafts so you can resume them. Drafts stay out of the Project tab until you create the brand.</p>
        </div>
      </div>
    </div>
  );
}
