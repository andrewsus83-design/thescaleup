"use client";

// One chat message (BRAND.md §7 "Chat"): the user's words in an Ink bubble on the right; the assistant's as plain text beside an
// Orange avatar holding the mark. Source chips show what an answer used, message actions (pin / to do / source) appear on hover
// or focus, and — because chat text never changes state — anything that would arrives as an explicit action card.

import { Check, ClipboardPlus, FileSearch, Pin } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import type { Message, Role, UsedChip } from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { Btn, Chip, motion, tagCls } from "../ui";

export type ActionChoice = "confirm" | "dismiss" | "note" | "project" | (string & {});

const RESOLVED: Record<string, string> = {
  audit: "Audit started — watch the progress above the message box.",
  todo: "To do created under “Manual”.",
  note: "Saved to the chronicle.",
  lock: "Profile locked.",
  build: "Build started — it's in the Builder tab.",
};

/** Long labels may wrap inside a narrow chat column instead of overflowing it. */
const wrap = "h-auto min-h-10 shrink whitespace-normal py-2 text-center";

export function BotAvatar() {
  return <Logo variant="inverse" shape="circle" size={36} />;
}

function ActionCard({ msg, role, onAction }: { msg: Message; role: Role; onAction: (m: Message, c: ActionChoice) => void }) {
  const a = msg.action;
  if (!a) return null;
  const box = "mt-4 rounded-bubble bg-paper-100 p-5";

  if (a.type === "open") {
    return (
      <div className={box}>
        <Btn size="sm" variant="secondary" className={cn(wrap, "hover:bg-paper-0")} onClick={() => onAction(msg, "open")}>
          Open “{a.name}”
        </Btn>
      </div>
    );
  }
  if (a.type === "offtopic") {
    if (a.state !== "pending") {
      return <p className={cn(box, "text-[14px] text-ink-500")}>{a.state === "note" ? "Saved as a note." : "Opened the new brand intake."}</p>;
    }
    return (
      <div className={cn(box, "flex flex-wrap gap-3")}>
        <Btn size="sm" variant="secondary" className={cn(wrap, "hover:bg-paper-0")} onClick={() => onAction(msg, "note")}>Save as note</Btn>
        <Btn size="sm" variant="primary" className={wrap} onClick={() => onAction(msg, "project")}>Create a project</Btn>
      </div>
    );
  }
  if (a.state === "dismissed") return <p className={cn(box, "text-[14px] text-ink-500")}>Dismissed — nothing changed.</p>;
  if (a.state === "done") {
    return (
      <p className={cn(box, "flex items-center gap-3 text-[14px] font-medium text-success-ink")}>
        <Check className="size-4 shrink-0" aria-hidden /> {RESOLVED[a.type]}
      </p>
    );
  }

  // pending
  if (a.type === "build") {
    // several options and no single "main" one: each Start build is an outline button, so Orange stays rare
    return (
      <div className={box}>
        <ul className="space-y-3">
          {a.options.map((o) => (
            <li key={o.todoId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <span className="min-w-0 flex-1 basis-40 text-[15px] font-medium">{o.title}</span>
              <Btn size="sm" variant="secondary" className="hover:bg-paper-0" onClick={() => onAction(msg, o.todoId)}>Start build</Btn>
            </li>
          ))}
        </ul>
        <Btn size="xs" variant="ghost" className="-ml-4 mt-2" onClick={() => onAction(msg, "dismiss")}>Not now</Btn>
      </div>
    );
  }
  const confirmLabel = {
    audit: (
      <>
        Run audit (max <span className="font-mono">$3.00</span>)
      </>
    ),
    todo: "Add this to do",
    note: "Save note",
    lock: "Approve positioning & lock",
  }[a.type];
  const needsAdmin = a.type === "lock" && role !== "admin";
  return (
    <div className={box}>
      {a.type === "todo" && <p className="mb-4 text-[15px] font-medium">“{a.title}”</p>}
      {a.type === "note" && <p className="mb-4 text-[15px] font-medium">“{a.text}”</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Btn size="sm" variant="primary" className={wrap} disabled={needsAdmin} onClick={() => onAction(msg, "confirm")}>{confirmLabel}</Btn>
        <Btn size="sm" variant="ghost" onClick={() => onAction(msg, "dismiss")}>Not now</Btn>
      </div>
    </div>
  );
}

// icon-only 44px circles on phones (the label stays for screen readers), 36px labelled pills from `sm`
const actionBtn = cn(
  "hit-44 inline-flex size-11 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold leading-none text-ink-500 hover:bg-paper-100 hover:text-ink-800 aria-pressed:bg-brand-50 aria-pressed:text-brand-700 sm:size-auto sm:h-9 sm:px-3",
  motion,
);

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
      <div className="my-2 flex items-center gap-4 text-[13px] text-ink-500" role="separator" aria-label={msg.text}>
        <span className="h-px flex-1 bg-hairline" />
        {msg.text}
        <span className="h-px flex-1 bg-hairline" />
      </div>
    );
  }
  const mine = msg.role === "user";

  if (mine) {
    return (
      <article className="flex justify-end">
        <div className="flex max-w-[80%] min-w-0 flex-col items-end">
          <p className="sr-only">You:</p>
          {/* 24 / 24 / 6 / 24: the small bottom-right corner is the bubble's tail */}
          <div className="whitespace-pre-line rounded-[24px_24px_6px_24px] bg-ink-800 px-5 py-3.5 text-body text-paper-100 [overflow-wrap:anywhere]">{msg.text}</div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex gap-4">
      <BotAvatar />
      <div className="min-w-0 flex-1 pt-1.5">
        <p className="sr-only">Assistant:</p>
        <div className="whitespace-pre-line text-body text-ink-800 [overflow-wrap:anywhere]">{msg.text}</div>

        {msg.used && msg.used.length > 0 && (
          <ul aria-label="Used in this answer" className="mt-3 flex flex-wrap gap-2">
            {msg.used.map((u) => (
              <li key={u.label}>
                <button type="button" onClick={() => onSource?.(u)} className={cn(tagCls, "hit-44 hover:bg-paper-200", motion)}>
                  {u.label}
                </button>
              </li>
            ))}
          </ul>
        )}

        {onAction && <ActionCard msg={msg} role={role} onAction={onAction} />}

        {msg.pinned && (
          <div className="mt-3">
            <Chip tone="brand">Pinned as decision</Chip>
          </div>
        )}

        {!readOnly && (
          <div className={cn("mt-2 -ml-3 flex flex-wrap gap-1 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0", motion)}>
            <button type="button" aria-pressed={!!msg.pinned} onClick={() => onPin?.(msg)} className={actionBtn}>
              <Pin className="size-5 sm:size-4" aria-hidden /> <span className="max-sm:sr-only">Pin as decision</span>
            </button>
            <button type="button" onClick={() => onTodo?.(msg)} className={actionBtn}>
              <ClipboardPlus className="size-5 sm:size-4" aria-hidden /> <span className="max-sm:sr-only">Create to do</span>
            </button>
            {msg.used && msg.used.length > 0 && (
              <button type="button" onClick={() => onSource?.(null)} className={actionBtn}>
                <FileSearch className="size-5 sm:size-4" aria-hidden /> <span className="max-sm:sr-only">Open source</span>
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/** BRAND "Typing": three 8px Ink-300 dots at 100 / 60 / 30% opacity; they pulse in turn unless motion is reduced. */
export function Typing({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4" role="status">
      <BotAvatar />
      <span className="flex items-center gap-3 text-[14px] text-ink-500">
        <span aria-hidden className="flex gap-1.5">
          <span className="size-2 animate-typing rounded-full bg-ink-300 opacity-100" />
          <span className="size-2 animate-typing rounded-full bg-ink-300 opacity-60 [animation-delay:200ms]" />
          <span className="size-2 animate-typing rounded-full bg-ink-300 opacity-30 [animation-delay:400ms]" />
        </span>
        {label}
      </span>
    </div>
  );
}
