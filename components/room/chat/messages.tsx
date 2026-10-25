"use client";

// One chat message: bubble, chips for the project items it used, message actions (pin / to do / source)
// and — because chat text never changes state — explicit action cards for anything that would.

import { Bot, Check, ClipboardPlus, FileSearch, Pin, User } from "lucide-react";
import type { Message, Role, UsedChip } from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { Btn, Chip } from "../ui";

export type ActionChoice = "confirm" | "dismiss" | "note" | "project" | (string & {});

const RESOLVED: Record<string, string> = {
  audit: "Audit started — watch the progress above the message box.",
  todo: "To do created under “Manual”.",
  note: "Saved to the chronicle.",
  lock: "Profile locked.",
  build: "Build started — it's in the Builder tab.",
};

function ActionCard({ msg, role, onAction }: { msg: Message; role: Role; onAction: (m: Message, c: ActionChoice) => void }) {
  const a = msg.action;
  if (!a) return null;
  const box = "mt-2 rounded-2xl border border-white/10 bg-ink/40 p-3.5";

  if (a.type === "open") {
    return (
      <div className={box}>
        <Btn size="sm" variant="secondary" onClick={() => onAction(msg, "open")}>
          Open “{a.name}”
        </Btn>
      </div>
    );
  }
  if (a.type === "offtopic") {
    if (a.state !== "pending") {
      return <p className={cn(box, "text-xs text-slate-300")}>{a.state === "note" ? "Saved as a note." : "Opened the new brand intake."}</p>;
    }
    return (
      <div className={cn(box, "flex flex-wrap gap-2")}>
        <Btn size="sm" variant="secondary" onClick={() => onAction(msg, "note")}>Save as note</Btn>
        <Btn size="sm" variant="primary" onClick={() => onAction(msg, "project")}>Create a project</Btn>
      </div>
    );
  }
  if (a.state === "dismissed") return <p className={cn(box, "text-xs text-slate-400")}>Dismissed — nothing changed.</p>;
  if (a.state === "done") {
    return (
      <p className={cn(box, "flex items-center gap-2 text-xs text-good")}>
        <Check className="h-4 w-4 shrink-0" aria-hidden /> {RESOLVED[a.type]}
      </p>
    );
  }

  // pending
  if (a.type === "build") {
    return (
      <div className={box}>
        <ul className="space-y-2">
          {a.options.map((o) => (
            <li key={o.todoId} className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-100">{o.title}</span>
              <Btn size="sm" variant="primary" onClick={() => onAction(msg, o.todoId)}>Start build</Btn>
            </li>
          ))}
        </ul>
        <Btn size="sm" variant="ghost" className="mt-2" onClick={() => onAction(msg, "dismiss")}>Not now</Btn>
      </div>
    );
  }
  const confirmLabel = {
    audit: "Run audit (max $3.00)",
    todo: "Add this to do",
    note: "Save note",
    lock: "Approve positioning & lock",
  }[a.type];
  const needsAdmin = a.type === "lock" && role !== "admin";
  return (
    <div className={box}>
      {a.type === "todo" && <p className="mb-2.5 text-sm text-slate-100">“{a.title}”</p>}
      {a.type === "note" && <p className="mb-2.5 text-sm text-slate-100">“{a.text}”</p>}
      <div className="flex flex-wrap gap-2">
        <Btn size="sm" variant="primary" disabled={needsAdmin} onClick={() => onAction(msg, "confirm")}>{confirmLabel}</Btn>
        <Btn size="sm" variant="ghost" onClick={() => onAction(msg, "dismiss")}>Not now</Btn>
      </div>
    </div>
  );
}

export function MessageView({
  msg,
  role,
  onSource,
  onPin,
  onTodo,
  onAction,
  readOnly,
}: {
  msg: Message;
  role: Role;
  onSource?: (c: UsedChip | null) => void;
  onPin?: (m: Message) => void;
  onTodo?: (m: Message) => void;
  onAction?: (m: Message, c: ActionChoice) => void;
  /** Intake conversations have no message actions: the card and the buttons do the work. */
  readOnly?: boolean;
}) {
  if (msg.role === "system") {
    return (
      <div className="my-4 flex items-center gap-3 text-xs text-slate-400" role="separator" aria-label={msg.text}>
        <span className="h-px flex-1 bg-white/8" />
        {msg.text}
        <span className="h-px flex-1 bg-white/8" />
      </div>
    );
  }
  const mine = msg.role === "user";
  const actionBtn =
    "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70";
  return (
    <article className={cn("group flex gap-3", mine && "flex-row-reverse")}>
      <span
        aria-hidden
        className={cn("mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", mine ? "bg-white/8 text-slate-200" : "bg-coral/15 text-coral")}
      >
        {mine ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </span>
      <div className={cn("min-w-0 max-w-[88%] sm:max-w-[80%]", mine && "flex flex-col items-end")}>
        <p className="sr-only">{mine ? "You" : "Assistant"}:</p>
        <div
          className={cn(
            "whitespace-pre-line rounded-2xl border px-4 py-3 text-sm leading-relaxed",
            mine ? "border-coral/25 bg-coral/15 text-mist" : "border-white/8 bg-card/60 text-slate-100",
          )}
        >
          {msg.text}
        </div>

        {!mine && msg.used && msg.used.length > 0 && (
          <ul aria-label="Used in this answer" className="mt-2 flex flex-wrap gap-1.5">
            {msg.used.map((u) => (
              <li key={u.label}>
                <button
                  type="button"
                  onClick={() => onSource?.(u)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200 transition-colors hover:border-coral/40 hover:text-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70"
                >
                  <FileSearch className="h-3 w-3" aria-hidden /> {u.label}
                </button>
              </li>
            ))}
          </ul>
        )}

        {!mine && onAction && <ActionCard msg={msg} role={role} onAction={onAction} />}

        {msg.pinned && (
          <div className="mt-2">
            <Chip tone="coral" icon={<Pin className="h-3 w-3" aria-hidden />}>Pinned as decision</Chip>
          </div>
        )}

        {!mine && !readOnly && (
          <div className="mt-1.5 flex flex-wrap gap-1 [@media(hover:hover)]:opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
            <button type="button" aria-pressed={!!msg.pinned} onClick={() => onPin?.(msg)} className={actionBtn}>
              <Pin className="h-3.5 w-3.5" aria-hidden /> Pin as decision
            </button>
            <button type="button" onClick={() => onTodo?.(msg)} className={actionBtn}>
              <ClipboardPlus className="h-3.5 w-3.5" aria-hidden /> Create to do
            </button>
            {msg.used && msg.used.length > 0 && (
              <button type="button" onClick={() => onSource?.(null)} className={actionBtn}>
                <FileSearch className="h-3.5 w-3.5" aria-hidden /> Open source
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function Typing({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-400" role="status">
      <span aria-hidden className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-coral/15 text-coral">
        <Bot className="h-4 w-4" />
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
        </span>
        {label}
      </span>
    </div>
  );
}
