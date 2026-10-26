"use client";

// Project tab: every confirmed brand with its latest score, open to dos and last activity.
// Drafts (unfinished intakes) are deliberately not listed here — they live on the Chat start screen.

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, MessagesSquare, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRoom } from "../room-provider";
import { Btn, Card, Chip, EmptyState, PageHeader, btnCls, inputCls, pageX, type Tone } from "../ui";
import { useIntakeStarter } from "../chat/use-intake";
import { useRouter } from "next/navigation";
import { costThisMonth, usd } from "./brand-keys";

/** The status next to the big score (so the number itself is not repeated): dot + label. */
export function ScoreChip({ score }: { score: number | null }) {
  if (score == null) return <Chip tone="neutral">No audit yet</Chip>;
  const tone: Tone = score < 40 ? "bad" : score < 70 ? "warn" : "ok";
  const label = score < 40 ? "Critical" : score < 70 ? "Needs work" : "Healthy";
  return <Chip tone={tone}>{label}</Chip>;
}

/** BRAND "Skor": the number in Title 800 (tracking −4%) with `/ 100` in Mono 13. */
export function ScoreNumber({ score, className }: { score: number | null; className?: string }) {
  return (
    <p className={cn("font-title font-extrabold leading-none tracking-[-0.04em] text-ink-800", className)}>
      {score == null ? (
        <>
          <span aria-hidden className="text-ink-300">—</span>
          <span className="sr-only">No score yet</span>
        </>
      ) : (
        score
      )}
      <span className="ml-1.5 font-mono text-[13px] font-medium tracking-normal text-ink-500">/ 100</span>
    </p>
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
    <div className={cn("mx-auto max-w-5xl py-10 sm:py-12", pageX)}>
      <PageHeader
        title="Project"
        description="Every brand you work on: its latest score, open to dos and last activity."
        action={
          <Btn size="lg" variant="primary" onClick={() => startIntake()}>
            <Plus className="size-5" aria-hidden /> Create brand
          </Btn>
        }
      />

      <div className="relative mb-8 max-w-md">
        <label htmlFor="proj-search" className="sr-only">
          Search projects
        </label>
        <Search className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-ink-500" aria-hidden />
        <input id="proj-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects" className={cn(inputCls, "pl-12")} />
      </div>

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Projects">
        {list.map((p) => {
          const openTodos = (state.todos[p.id] ?? []).filter((t) => !t.done).length;
          return (
            <li key={p.id} className="flex">
              <Card interactive className="flex w-full flex-col">
                <div className="min-w-0">
                  <h2 className="font-title text-h3 text-ink-800">
                    {/* padded to a 47px-high target without moving anything */}
                    <Link href={href(`/projects/${p.id}`)} className="-my-2.5 block truncate rounded-nav py-2.5 hover:text-brand-700 hover:underline hover:underline-offset-4">
                      {p.name}
                    </Link>
                  </h2>
                  <p className="mt-1 truncate text-[14px] text-ink-500">{p.website}</p>
                </div>
                <ScoreNumber score={p.score} className="mt-6 text-h1" />
                <div className="mt-4 flex flex-wrap gap-2">
                  <ScoreChip score={p.score} />
                  {p.locked ? (
                    <Chip tone="ok">
                      Profile <span className="font-mono">v{p.profileVersion}</span>
                    </Chip>
                  ) : (
                    <Chip tone="warn">Intake mode</Chip>
                  )}
                </div>
                <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-4">
                  <div>
                    <dt className="label-caps whitespace-nowrap text-ink-500">Open to dos</dt>
                    <dd className="mt-1 font-title text-h3 text-ink-800">{openTodos}</dd>
                  </div>
                  <div>
                    <dt className="label-caps whitespace-nowrap text-ink-500">Last activity</dt>
                    <dd className="mt-1 text-[15px] font-semibold text-ink-800">{p.lastActivity}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="label-caps text-ink-500">Cost this month</dt>
                    <dd className="mt-1 font-mono text-[15px] font-semibold text-ink-800">{usd(costThisMonth(p.id))}</dd>
                  </div>
                </dl>
                <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-6">
                  <Btn
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      open(p.id);
                      router.push(href("/chat"));
                    }}
                  >
                    <MessagesSquare className="size-4" aria-hidden /> Open chat
                  </Btn>
                  <Link href={href(`/projects/${p.id}`)} className={btnCls("ghost", "sm")}>
                    View details <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <EmptyState title={`No project matches “${q}”.`} />}
    </div>
  );
}
