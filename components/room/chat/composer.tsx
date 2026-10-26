"use client";

// Message box (BRAND.md §7 "Chat"): a white pill with a 44px Orange send button, quick-action chips above it (Update to do ·
// Add note · Start build) and slash commands (/lock /audit /todo /build) with a keyboard-driven menu.
// Enter sends, Shift+Enter adds a line.

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, ClipboardPlus, Hammer, StickyNote } from "lucide-react";
import { COMMANDS } from "@/lib/room/assistant";
import type { Role } from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { IconBtn, chatX, motion } from "../ui";

const PHONE = "(max-width: 639px)";
const subscribePhone = (cb: () => void) => {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

export function Composer({
  onSend,
  disabled,
  placeholder,
  role,
  mode = "project",
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder: string;
  role?: Role;
  /** The intake conversation has no commands or quick actions. */
  mode?: "project" | "intake";
}) {
  const [text, setText] = useState("");
  const [idx, setIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  // on a phone the placeholder keeps only its first clause, so it is never cut off mid-word (the hint line below says the rest)
  const phone = useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false);
  const shownPlaceholder = phone ? placeholder.replace(/\s*(…|—|,).*$/, "…") : placeholder;

  const matches = COMMANDS.filter((c) => c.cmd.startsWith(text.trim().toLowerCase()));
  const menuOpen = mode === "project" && /^\/\S*$/.test(text) && !dismissed && matches.length > 0;

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };
  const set = (v: string) => {
    setText(v);
    setIdx(0);
    setDismissed(false);
    requestAnimationFrame(resize);
  };
  const send = (v = text) => {
    const t = v.trim();
    if (!t || disabled) return;
    onSend(t);
    set("");
  };
  const pick = (cmd: string) => {
    set(`${cmd} `);
    ref.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (menuOpen) {
      if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => (i + 1) % matches.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => (i - 1 + matches.length) % matches.length); return; }
      if (e.key === "Escape") { e.preventDefault(); setDismissed(true); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const chosen = matches[idx];
        // a fully typed command sends; a partial one completes
        if (e.key === "Enter" && text.trim().toLowerCase() === chosen.cmd) send();
        else pick(chosen.cmd);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // quick-action chip: 36px, Ink-200 border, Paper on hover
  const chip = cn(
    "hit-44 inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-ink-200 bg-paper-0 px-4 text-[13px] font-semibold leading-none text-ink-800 hover:bg-paper-100 disabled:pointer-events-none disabled:border-ink-100 disabled:text-ink-300",
    motion,
  );

  return (
    <div className={cn("bg-paper-0 pb-5 pt-3", chatX)}>
      <div className="mx-auto max-w-chat">
        {mode === "project" && (
          // one scrollable row on phones so the conversation keeps its height; wraps from `sm`
          <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="group" aria-label="Quick actions">
            <button type="button" className={chip} disabled={disabled} onClick={() => { set("/todo "); ref.current?.focus(); }}>
              <ClipboardPlus className="size-4" aria-hidden /> Update to do
            </button>
            <button type="button" className={chip} disabled={disabled} onClick={() => { set("Note: "); ref.current?.focus(); }}>
              <StickyNote className="size-4" aria-hidden /> Add note
            </button>
            <button type="button" className={chip} disabled={disabled} onClick={() => send("/build")}>
              <Hammer className="size-4" aria-hidden /> Start build
            </button>
          </div>
        )}

        <div className="relative">
          {menuOpen && (
            <ul id={listId} role="listbox" aria-label="Commands" className="absolute bottom-full left-0 z-20 mb-3 w-full max-w-sm rounded-panel border border-hairline bg-paper-0 p-2 shadow-menu">
              {matches.map((c, i) => (
                <li key={c.cmd} id={`${listId}-${i}`} role="option" aria-selected={i === idx}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(c.cmd)}
                    className={cn("flex w-full items-center justify-between gap-4 rounded-nav px-4 py-3 text-left", motion, i === idx ? "bg-paper-100" : "hover:bg-paper-100")}
                  >
                    <span className="font-mono text-[14px] font-medium">{c.cmd}</span>
                    <span className="truncate text-[13px] text-ink-500">
                      {c.hint}
                      {c.adminOnly && role !== "admin" ? " · admin only" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div
            className={cn(
              "flex items-end gap-2 rounded-card border border-ink-100 bg-paper-0 py-2 pl-6 pr-2 shadow-raised",
              "focus-within:border-ink-800 focus-within:shadow-[0_0_0_4px_var(--color-brand-100),0_6px_24px_rgb(38_38_38/0.1)]",
              motion,
            )}
          >
            <textarea
              ref={ref}
              value={text}
              rows={1}
              disabled={disabled}
              placeholder={shownPlaceholder}
              aria-label="Message"
              role="combobox"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? listId : undefined}
              aria-activedescendant={menuOpen ? `${listId}-${idx}` : undefined}
              aria-autocomplete="list"
              onChange={(e) => set(e.target.value)}
              onKeyDown={onKeyDown}
              className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-body leading-6 text-ink-800 outline-none placeholder:overflow-hidden placeholder:text-ellipsis placeholder:whitespace-nowrap placeholder:text-ink-500 disabled:text-ink-300"
            />
            <IconBtn label="Send" variant="primary" disabled={disabled || !text.trim()} onClick={() => send()}>
              <ArrowUp className="size-5" aria-hidden />
            </IconBtn>
          </div>
        </div>
        {mode === "project" && (
          <p className="mt-3 hidden text-[13px] text-ink-500 sm:block">
            Type <span className="font-mono">/</span> for commands · Enter to send · Shift+Enter for a new line
          </p>
        )}
      </div>
    </div>
  );
}
