"use client";

// Message box: quick-action chips (Update to do · Add note · Start build) and slash commands
// (/lock /audit /todo /build) with a keyboard-driven menu. Enter sends, Shift+Enter adds a line.

import { useId, useRef, useState } from "react";
import { ArrowUp, ClipboardPlus, Hammer, StickyNote } from "lucide-react";
import { COMMANDS } from "@/lib/room/assistant";
import type { Role } from "@/lib/room/types";
import { cn } from "@/lib/utils";

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

  const chip =
    "inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-coral/40 hover:text-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70 disabled:opacity-50";

  return (
    <div className="border-t border-white/8 bg-obsidian px-4 pb-4 pt-3">
      <div className="mx-auto max-w-3xl">
        {mode === "project" && (
          <div className="mb-2.5 flex flex-wrap gap-2" aria-label="Quick actions">
            <button type="button" className={chip} disabled={disabled} onClick={() => { set("/todo "); ref.current?.focus(); }}>
              <ClipboardPlus className="h-3.5 w-3.5" aria-hidden /> Update to do
            </button>
            <button type="button" className={chip} disabled={disabled} onClick={() => { set("Note: "); ref.current?.focus(); }}>
              <StickyNote className="h-3.5 w-3.5" aria-hidden /> Add note
            </button>
            <button type="button" className={chip} disabled={disabled} onClick={() => send("/build")}>
              <Hammer className="h-3.5 w-3.5" aria-hidden /> Start build
            </button>
          </div>
        )}

        <div className="relative">
          {menuOpen && (
            <ul id={listId} role="listbox" aria-label="Commands" className="absolute bottom-full left-0 z-20 mb-2 w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-surface p-1.5 shadow-2xl">
              {matches.map((c, i) => (
                <li key={c.cmd} id={`${listId}-${i}`} role="option" aria-selected={i === idx}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(c.cmd)}
                    className={cn("flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm", i === idx ? "bg-coral/10 text-coral" : "text-slate-200 hover:bg-white/5")}
                  >
                    <span className="font-mono font-semibold">{c.cmd}</span>
                    <span className="truncate text-xs text-slate-400">
                      {c.hint}
                      {c.adminOnly && role !== "admin" ? " · admin only" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-end gap-2 rounded-2xl border border-white/12 bg-card/60 p-2 focus-within:border-coral/50">
            <textarea
              ref={ref}
              value={text}
              rows={1}
              disabled={disabled}
              placeholder={placeholder}
              aria-label="Message"
              role="combobox"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? listId : undefined}
              aria-activedescendant={menuOpen ? `${listId}-${idx}` : undefined}
              aria-autocomplete="list"
              onChange={(e) => set(e.target.value)}
              onKeyDown={onKeyDown}
              className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-mist placeholder:text-slate-400 focus-visible:outline-none disabled:opacity-60"
            />
            <button
              type="button"
              aria-label="Send"
              disabled={disabled || !text.trim()}
              onClick={() => send()}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-coral text-ink transition-colors hover:bg-coral-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70 disabled:pointer-events-none disabled:opacity-40"
            >
              <ArrowUp className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
        {mode === "project" && <p className="mt-2 text-xs text-slate-400">Type / for commands · Enter to send · Shift+Enter for a new line</p>}
      </div>
    </div>
  );
}
