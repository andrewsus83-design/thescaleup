"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckCheck, Loader2, Mail, MailOpen, Undo2 } from "lucide-react";
import { btnCls, iconBtnCls } from "@/components/brand/styles";
import type { FormState } from "@/lib/hub/actions";
import { setThreadsState } from "@/lib/hub/mail-actions";
import type { ThreadRow } from "@/lib/hub/mail/data";
import type { Folder } from "@/lib/hub/mail/model";
import { fmtStamp } from "@/lib/hub/tasks/dates";
import { cn } from "@/lib/utils";

const tool = btnCls("secondary", "xs");

/**
 * The conversations like Gmail's list: a tick box, then who, the subject with the start of the last message, and the time.
 * Unread rows are bold on white, read rows sit on a light grey. Tick some and the bar above offers Done, Unread and Read; a row
 * also shows Done and Unread buttons when the pointer is on it. People who may only read see no tick boxes.
 */
export function ThreadList({ threads, brandId, base, back, folder, tz, today, canEdit }: { threads: ThreadRow[]; brandId: string; base: string; back: string; folder: Folder; tz: string; today: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setThreadsState, {});
  const [sel, setSel] = useState<Set<string>>(new Set());
  // Rows that left the list (marked done, a new page) drop out of the selection by themselves.
  const picked = threads.filter((t) => sel.has(t.id));
  const all = threads.length > 0 && picked.length === threads.length;
  const toggle = (id: string) => setSel((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));

  return (
    <form action={action} className="overflow-hidden rounded-bubble border border-hairline bg-paper-0">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="back" value={back} />
      {canEdit && (
        <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-hairline px-3 py-1">
          <label className="inline-flex size-11 items-center justify-center">
            <input
              type="checkbox"
              checked={all}
              ref={(el) => {
                if (el) el.indeterminate = picked.length > 0 && !all;
              }}
              onChange={() => setSel(all ? new Set() : new Set(threads.map((t) => t.id)))}
              aria-label="Select all conversations on this page"
              className="size-5 accent-brand-600"
            />
          </label>
          {picked.length === 0 ? (
            <span className="text-caption text-ink-500">{threads.length} {threads.length === 1 ? "conversation" : "conversations"}</span>
          ) : (
            <>
              <span role="status" className="mr-1 text-caption font-semibold text-ink-800">
                {picked.length} selected
              </span>
              {folder === "done" ? (
                <button type="submit" name="act" value="open" disabled={pending} className={tool}>
                  <Undo2 className="size-4" aria-hidden />
                  Reopen
                </button>
              ) : (
                <button type="submit" name="act" value="done" disabled={pending} className={tool}>
                  <CheckCheck className="size-4" aria-hidden />
                  Done
                </button>
              )}
              <button type="submit" name="act" value="unread" disabled={pending} className={tool}>
                <Mail className="size-4" aria-hidden />
                Unread
              </button>
              <button type="submit" name="act" value="read" disabled={pending} className={tool}>
                <MailOpen className="size-4" aria-hidden />
                Read
              </button>
              {pending && <Loader2 className="size-4 animate-spin text-ink-500" aria-label="Saving" />}
            </>
          )}
        </div>
      )}
      {state.error && (
        <p role="alert" className="border-b border-hairline bg-danger-bg px-5 py-2 text-small text-danger">
          {state.error}
        </p>
      )}
      <ul className="divide-y divide-hairline">
        {threads.map((t) => {
          const on = sel.has(t.id);
          const who = folder === "sent" ? `To: ${t.to ?? t.mailbox}` : t.last_from || t.mailbox;
          return (
            <li key={t.id} className={cn("group relative flex items-center gap-1 pr-4", canEdit ? "pl-3" : "pl-5", on ? "bg-brand-25" : t.unread ? "bg-paper-0" : "bg-paper-50")}>
              {canEdit && (
                <label className="inline-flex size-11 shrink-0 items-center justify-center">
                  <input type="checkbox" name="id" value={t.id} checked={on} onChange={() => toggle(t.id)} aria-label={`Select: ${t.subject || "no subject"}, from ${who}`} className="size-5 accent-brand-600" />
                </label>
              )}
              <Link href={`${base}/${t.id}`} className="block min-w-0 flex-1 py-3 sm:flex sm:items-center sm:gap-4">
                <span className="flex items-baseline justify-between gap-3 sm:contents">
                  <span className={cn("truncate text-body sm:w-48 sm:shrink-0 sm:text-small", t.unread ? "font-bold text-ink-900" : "text-ink-800")}>
                    {t.unread && <span className="sr-only">Unread. </span>}
                    {who}
                    {t.message_count > 1 && <span className="ml-2 font-mono text-micro font-normal text-ink-500">{t.message_count}</span>}
                  </span>
                  <time dateTime={t.last_message_at} className={cn("shrink-0 text-caption sm:order-last sm:w-36 sm:text-right", t.unread ? "font-bold text-ink-800" : "text-ink-500", canEdit && "sm:group-hover:invisible sm:group-focus-within:invisible")}>
                    {fmtStamp(t.last_message_at, tz, today)}
                  </time>
                </span>
                <span className="mt-0.5 block truncate text-small sm:mt-0 sm:min-w-0 sm:flex-1">
                  <span className={cn(t.unread ? "font-bold text-ink-900" : "text-ink-800")}>{t.subject || "(no subject)"}</span>
                  <span className="text-ink-500"> – {t.last_snippet}</span>
                </span>
              </Link>
              {canEdit && (
                <span className="absolute top-1/2 right-3 hidden -translate-y-1/2 gap-1 sm:group-hover:flex sm:group-focus-within:flex">
                  <button type="submit" name="act" value={`${folder === "done" ? "open" : "done"}:${t.id}`} disabled={pending} aria-label={folder === "done" ? "Reopen" : "Mark done"} title={folder === "done" ? "Reopen" : "Mark done"} className={iconBtnCls("quiet", "size-9")}>
                    {folder === "done" ? <Undo2 className="size-4" aria-hidden /> : <CheckCheck className="size-4" aria-hidden />}
                  </button>
                  <button type="submit" name="act" value={`${t.unread ? "read" : "unread"}:${t.id}`} disabled={pending} aria-label={t.unread ? "Mark as read" : "Mark as unread"} title={t.unread ? "Mark as read" : "Mark as unread"} className={iconBtnCls("quiet", "size-9")}>
                    {t.unread ? <MailOpen className="size-4" aria-hidden /> : <Mail className="size-4" aria-hidden />}
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </form>
  );
}
