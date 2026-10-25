"use client";

// A chat inside one project. Every turn sees only that project's context bundle (the meter shows it),
// answers carry chips for what they used, and anything that would change state arrives as an action card.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Gauge, Lock } from "lucide-react";
import { routeMessage } from "@/lib/room/assistant";
import { buildBundle } from "@/lib/room/context";
import { detectLang } from "@/lib/room/intake";
import type { Message, MessageAction, Project, UsedChip } from "@/lib/room/types";
import { useRoom } from "../room-provider";
import { ProjectSwitcher } from "../project-switcher";
import { Bar, Btn, Chip, Sheet } from "../ui";
import { Composer } from "./composer";
import { ContextMeter } from "./context-meter";
import { MessageView, Typing, type ActionChoice } from "./messages";
import { useIntakeStarter } from "./use-intake";

export function ProjectChat({ project }: { project: Project }) {
  const api = useRoom();
  const { state, uid } = api;
  const router = useRouter();
  const startIntake = useIntakeStarter();

  const thread = state.threads[project.id] ?? [];
  const todos = useMemo(() => state.todos[project.id] ?? [], [state.todos, project.id]);
  const [thinking, setThinking] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [highlight, setHighlight] = useState<UsedChip["kind"] | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ project, todos, role: state.role });
  const timers = useRef<number[]>([]);

  useEffect(() => {
    latest.current = { project, todos, role: state.role };
  }, [project, todos, state.role]);
  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);
  const audit = state.audit?.projectId === project.id ? state.audit : null;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread.length, thinking, audit?.pct]);

  const bundle = useMemo(
    () => buildBundle({ project, todos, hasReport: !!state.reports[project.id], chronicleCount: (state.chronicle[project.id] ?? []).length, knowledge: state.knowledge }),
    [project, todos, state.reports, state.chronicle, state.knowledge],
  );

  const send = (text: string) => {
    const lang = detectLang(text, "en");
    api.addMessage(project.id, { role: "user", text });
    setThinking(true);
    // stand-in for the intent router + grounded answer (see lib/room/assistant.ts)
    const id = window.setTimeout(() => {
      const cur = latest.current;
      const r = routeMessage({ text, lang, project: cur.project, todos: cur.todos, role: cur.role });
      api.addMessage(project.id, { role: "assistant", text: r.text, used: r.used, action: r.action });
      setThinking(false);
    }, 650);
    timers.current.push(id);
  };

  const onAction = (m: Message, choice: ActionChoice) => {
    const a = m.action;
    if (!a) return;
    const settle = (s: "done" | "dismissed") => api.patchMessage(project.id, m.id, { action: { ...a, state: s } as MessageAction });
    if (choice === "dismiss") return settle("dismissed");
    switch (a.type) {
      case "audit":
        api.startAudit(project.id);
        settle("done");
        api.toast("Audit started");
        break;
      case "todo":
        api.addTodo(project.id, a.title);
        settle("done");
        api.toast("To do created");
        break;
      case "note":
        api.addChronicle(project.id, "note", a.text);
        settle("done");
        api.toast("Saved to the chronicle");
        break;
      case "lock": {
        if (state.role !== "admin") return;
        const v = (project.profileVersion ?? 0) + 1;
        api.lockProfile(project.id, {
          id: uid(),
          role: "assistant",
          text: `Profile locked as v${v}. You can run /audit now; the report, to dos and chronicle join the context once they exist.`,
          used: [{ kind: "profile", label: `Profile v${v}` }],
        });
        settle("done");
        break;
      }
      case "build": {
        const todo = todos.find((t) => t.id === choice);
        if (!todo) return;
        api.startBuild(project.id, todo);
        settle("done");
        router.push(api.href("/builder"));
        break;
      }
      case "offtopic":
        if (choice === "note") {
          api.addChronicle(project.id, "note", a.text);
          api.patchMessage(project.id, m.id, { action: { ...a, state: "note" } });
          api.toast("Saved as a note");
        } else {
          api.patchMessage(project.id, m.id, { action: { ...a, state: "project" } });
          startIntake();
        }
        break;
    }
  };

  const onPin = (m: Message) => {
    api.patchMessage(project.id, m.id, { pinned: !m.pinned });
    if (!m.pinned) {
      api.addChronicle(project.id, "decision", m.text.split("\n")[0].slice(0, 140));
      api.toast("Pinned — decisions survive across threads");
    }
  };
  const onTodo = (m: Message) => {
    api.addTodo(project.id, m.text.split(/[.\n]/)[0].trim().slice(0, 90));
    api.toast("To do created from the message");
  };
  const onSource = (c: UsedChip | null) => {
    setHighlight(c?.kind ?? null);
    if (!window.matchMedia("(min-width: 1280px)").matches) setSheet(true);
  };

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-w-0 flex-1 flex-col" aria-label={`Chat in ${project.name}`}>
        <header className="flex flex-wrap items-center gap-3 border-b border-white/8 px-4 py-3">
          <ProjectSwitcher />
          {project.locked ? <Chip tone="good" icon={<Lock className="h-3 w-3" aria-hidden />}>Profile v{project.profileVersion} locked</Chip> : <Chip tone="warn">Intake mode</Chip>}
          <Btn size="sm" variant="secondary" className="ml-auto xl:hidden" onClick={() => setSheet(true)}>
            <Gauge className="h-4 w-4" aria-hidden /> Context
            <span className="font-mono text-slate-300">{bundle.tokens.toLocaleString("en-US")}/{bundle.budget.toLocaleString("en-US")}</span>
          </Btn>
        </header>

        {!project.locked && (
          <p className="border-b border-warn/20 bg-warn/10 px-4 py-2 text-xs text-warn">
            Intake mode: until an admin approves the positioning line and locks the profile, chat can only help complete and lock it (<span className="font-mono">/lock</span>).
          </p>
        )}

        <div role="log" aria-label="Conversation" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <div className="mx-auto max-w-3xl space-y-5">
            {thread.map((m) => (
              <MessageView key={m.id} msg={m} role={state.role} onSource={onSource} onPin={onPin} onTodo={onTodo} onAction={onAction} />
            ))}
            {thinking && <Typing label="Reading this project's context…" />}
            <div ref={endRef} />
          </div>
        </div>

        {audit && (
          <div role="status" className="mx-4 mb-3 rounded-2xl border border-coral/25 bg-coral/5 p-3.5">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-slate-100">Audit running · {project.name}</span>
              <span className="font-mono text-slate-200">${((audit.pct / 100) * 2.4).toFixed(2)} of $3.00 budget</span>
            </div>
            <div className="mx-auto mt-2 max-w-3xl">
              <Bar value={audit.pct} label="Audit progress" tone={audit.pct * 0.024 >= 2.85 ? "warn" : "coral"} />
            </div>
          </div>
        )}

        <Composer onSend={send} disabled={thinking} role={state.role} placeholder={`Ask about ${project.name}… or type / for commands`} />
      </section>

      <aside aria-label="Context meter" className="hidden w-80 shrink-0 overflow-y-auto border-l border-white/8 p-4 xl:block">
        <ContextMeter project={project} highlight={highlight} />
      </aside>
      <Sheet
        open={sheet}
        onClose={() => {
          setSheet(false);
          setHighlight(null);
        }}
        title="What this chat can see"
      >
        <ContextMeter project={project} highlight={highlight} />
      </Sheet>
    </div>
  );
}
