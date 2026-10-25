"use client";

// Project tab: every confirmed brand with its latest score, open to dos and last activity.
// Drafts (unfinished intakes) are deliberately not listed here — they live on the Chat start screen.

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, MessagesSquare, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { useRoom } from "../room-provider";
import { Btn, Chip, inputCls, type Tone } from "../ui";
import { useIntakeStarter } from "../chat/use-intake";
import { useRouter } from "next/navigation";

export function ScoreChip({ score }: { score: number | null }) {
  if (score == null) return <Chip tone="neutral">No audit yet</Chip>;
  const tone: Tone = score < 40 ? "bad" : score < 70 ? "warn" : "good";
  const label = score < 40 ? "Critical" : score < 70 ? "Needs work" : "Healthy";
  return (
    <Chip tone={tone}>
      <span className="font-mono font-semibold">{score}</span>/100 · {label}
    </Chip>
  );
}

export function ProjectsScreen() {
  const { state, href, open } = useRoom();
  const startIntake = useIntakeStarter();
  const router = useRouter();
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const list = state.projects.filter((p) => p.status === "active" && (!needle || p.name.toLowerCase().includes(needle) || p.website.includes(needle)));

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <PageHeader
        title="Project"
        description="Every brand you work on: its latest score, open to dos and last activity."
        action={
          <Btn variant="primary" onClick={() => startIntake()}>
            <Plus className="h-4 w-4" aria-hidden /> New brand
          </Btn>
        }
      />

      <div className="relative mb-5 max-w-md">
        <label htmlFor="proj-search" className="sr-only">
          Search projects
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input id="proj-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects" className={`${inputCls} pl-10`} />
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Projects">
        {list.map((p) => {
          const openTodos = (state.todos[p.id] ?? []).filter((t) => !t.done).length;
          return (
            <li key={p.id} className="flex flex-col rounded-2xl border border-white/8 bg-card/40 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-lg font-bold">
                    <Link href={href(`/projects/${p.id}`)} className="rounded hover:text-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70">
                      {p.name}
                    </Link>
                  </h2>
                  <p className="truncate text-xs text-slate-400">{p.website}</p>
                </div>
                {p.locked ? <Chip tone="good">Profile v{p.profileVersion}</Chip> : <Chip tone="warn">Intake mode</Chip>}
              </div>
              <div className="mt-4">
                <ScoreChip score={p.score} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-400">Open to dos</dt>
                  <dd className="mt-0.5 font-display text-xl font-bold">{openTodos}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Last activity</dt>
                  <dd className="mt-0.5 font-medium text-slate-100">{p.lastActivity}</dd>
                </div>
              </dl>
              <div className="mt-5 flex gap-2 pt-1">
                <Btn
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    open(p.id);
                    router.push(href("/chat"));
                  }}
                >
                  <MessagesSquare className="h-4 w-4" aria-hidden /> Open chat
                </Btn>
                <Link
                  href={href(`/projects/${p.id}`)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-slate-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70"
                >
                  Details <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">No project matches “{q}”.</p>}
    </div>
  );
}
