"use client";

// A chat inside one project. Every turn sees only that project's context bundle (the meter shows it),
// answers carry chips for what they used, and anything that would change state arrives as an action card.
// Layout (BRAND §5): from `lg` the chat sits beside the 300px context column; below that the context opens in a sheet.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Gauge } from "lucide-react";
import { routeMessage } from "@/lib/room/assistant";
import { buildBundle } from "@/lib/room/context";
import { detectLang } from "@/lib/room/intake";
import type { Message, MessageAction, Project, UsedChip } from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { useRoom } from "../room-provider";
import { ProjectSwitcher } from "../project-switcher";
import { Alert, Bar, BudgetPanel, Btn, Chip, Sheet, chatX } from "../ui";
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
    if (!window.matchMedia("(min-width: 1024px)").matches) setSheet(true);
  };

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-w-0 flex-1 flex-col bg-paper-0" aria-label={`Chat in ${project.name}`}>
        <header className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 py-3", chatX)}>
          <ProjectSwitcher className="min-w-0 max-sm:min-w-40 max-sm:flex-1" />
          {/* below `lg` the context lives in a sheet; on phones the button is icon-only so the header stays two short rows */}
          <Btn size="sm" variant="secondary" aria-label="Open context" className="max-sm:w-10 max-sm:px-0 sm:order-last sm:ml-auto lg:hidden" onClick={() => setSheet(true)}>
            <Gauge className="size-4" aria-hidden /> <span className="max-sm:hidden">Context</span>
            <span className="font-mono text-[13px] font-medium text-ink-500 max-sm:hidden">{bundle.tokens.toLocaleString("en-US")}/{bundle.budget.toLocaleString("en-US")}</span>
          </Btn>
          {project.locked ? (
            <Chip tone="ok">
              Profile <span className="font-mono">v{project.profileVersion}</span> locked
            </Chip>
          ) : (
            <Chip tone="warn">Intake mode</Chip>
          )}
        </header>

        {!project.locked && (
          <div className={cn("pb-3", chatX)}>
            <Alert tone="warn" className="mx-auto max-w-chat">
              Intake mode: until an admin approves the positioning line and locks the profile, chat can only help complete and lock it (<span className="font-mono">/lock</span>).
            </Alert>
          </div>
        )}

        <div role="log" aria-label="Conversation" aria-live="polite" className={cn("min-h-0 flex-1 overflow-y-auto py-6", chatX)}>
          <div className="mx-auto max-w-chat space-y-6">
            {thread.map((m) => (
              <MessageView key={m.id} msg={m} role={state.role} onSource={onSource} onPin={onPin} onTodo={onTodo} onAction={onAction} />
            ))}
            {thinking && <Typing label="Reading this project's context…" />}
            <div ref={endRef} />
          </div>
        </div>

        {audit && (
          <div className={cn("pb-3", chatX)}>
            <BudgetPanel live className="mx-auto max-w-chat" label={`Audit running · ${project.name}`} figure={`$${((audit.pct / 100) * 2.4).toFixed(2)}`} unit="of $3.00 budget">
              <Bar value={audit.pct} label="Audit progress" tone={audit.pct * 0.024 >= 2.85 ? "warn" : "brand"} onDark />
            </BudgetPanel>
          </div>
        )}

        <Composer onSend={send} disabled={thinking} role={state.role} placeholder={`Ask about ${project.name}… or type / for commands`} />
      </section>

      <aside aria-label="Context meter" className="hidden w-context shrink-0 overflow-y-auto bg-paper-100 p-6 lg:block">
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
        <div className="rounded-card bg-paper-100 p-4">
          <ContextMeter project={project} highlight={highlight} />
        </div>
      </Sheet>
    </div>
  );
}
