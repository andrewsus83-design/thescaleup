"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckCheck, Loader2, Mail, MailOpen, Trash2, Undo2 } from "lucide-react";
import { btnCls, iconBtnCls } from "@/components/brand/styles";
import type { FormState } from "@/lib/hub/actions";
import { purgeThreads, setThreadsState } from "@/lib/hub/mail-actions";
import type { ThreadRow } from "@/lib/hub/mail/data";
import type { Folder } from "@/lib/hub/mail/model";
import { fmtStamp } from "@/lib/hub/tasks/dates";
import { cn } from "@/lib/utils";

const tool = btnCls("secondary", "xs");

/**
 * The conversations like Gmail's list: a tick box, then who, the subject with the start of the last message, and the time.
 * Unread rows are bold on white, read rows sit on a light grey. Tick some and the bar above offers Done, Unread and Read; a row
 * also shows Done, Unread and Delete buttons when the pointer is on it. Delete moves to Trash; in Trash the bar offers Restore and, to
 * the founder or the agency, Delete forever and Empty Trash (both ask first). People who may only read see no tick boxes.
 */
export function ThreadList({ threads, brandId, base, back, folder, tz, today, canEdit, canPurge }: { threads: ThreadRow[]; brandId: string; base: string; back: string; folder: Folder; tz: string; today: string; canEdit: boolean; canPurge: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setThreadsState, {});
  const [purged, purgeAction, purging] = useActionState<FormState, FormData>(purgeThreads, {});
  const busy = pending || purging;
  const trash = folder === "trash";
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
            <>
              <span className="text-caption text-ink-500">{threads.length} {threads.length === 1 ? "conversation" : "conversations"}</span>
              {trash && canPurge && (
                <details className="ml-auto">
                  <summary className={`${tool} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                    <Trash2 className="size-4" aria-hidden />
                    Empty Trash
                  </summary>
                  <div className="mt-2 flex max-w-sm flex-wrap items-center gap-3 rounded-field bg-paper-100 p-4">
                    <p className="text-small text-ink-800">This deletes everything in Trash for good, with its files. It cannot be undone.</p>
                    <button type="submit" name="act" value="purge-all" formAction={purgeAction} disabled={busy} className={btnCls("danger", "xs")}>
                      Yes, empty Trash
                    </button>
                  </div>
                </details>
              )}
            </>
          ) : (
            <>
              <span role="status" className="mr-1 text-caption font-semibold text-ink-800">
                {picked.length} selected
              </span>
              {trash ? (
                <>
                  <button type="submit" name="act" value="restore" disabled={busy} className={tool}>
                    <Undo2 className="size-4" aria-hidden />
                    Restore
                  </button>
                  {canPurge && (
                    <details>
                      <summary className={`${tool} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                        <Trash2 className="size-4" aria-hidden />
                        Delete forever
                      </summary>
                      <div className="mt-2 flex max-w-sm flex-wrap items-center gap-3 rounded-field bg-paper-100 p-4">
                        <p className="text-small text-ink-800">
                          This deletes {picked.length === 1 ? "this conversation" : `these ${picked.length} conversations`} and the files for good. It cannot be undone.
                        </p>
                        <button type="submit" name="act" value="purge" formAction={purgeAction} disabled={busy} className={btnCls("danger", "xs")}>
                          Yes, delete forever
                        </button>
                      </div>
                    </details>
                  )}
                </>
              ) : (
                <>
                  {folder === "done" ? (
                    <button type="submit" name="act" value="open" disabled={busy} className={tool}>
                      <Undo2 className="size-4" aria-hidden />
                      Reopen
                    </button>
                  ) : (
                    <button type="submit" name="act" value="done" disabled={busy} className={tool}>
                      <CheckCheck className="size-4" aria-hidden />
                      Done
                    </button>
                  )}
                  <button type="submit" name="act" value="unread" disabled={busy} className={tool}>
                    <Mail className="size-4" aria-hidden />
                    Unread
                  </button>
                  <button type="submit" name="act" value="read" disabled={busy} className={tool}>
                    <MailOpen className="size-4" aria-hidden />
                    Read
                  </button>
                  <button type="submit" name="act" value="trash" disabled={busy} className={tool}>
                    <Trash2 className="size-4" aria-hidden />
                    Delete
                  </button>
                </>
              )}
              {busy && <Loader2 className="size-4 animate-spin text-ink-500" aria-label="Saving" />}
            </>
          )}
        </div>
      )}
      {(state.error || purged.error) && (
        <p role="alert" className="border-b border-hairline bg-danger-bg px-5 py-2 text-small text-danger">
          {state.error || purged.error}
        </p>
      )}
      {purged.message && (
        <p role="status" className="border-b border-hairline bg-paper-100 px-5 py-2 text-small text-ink-800">
          {purged.message}
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
                  {trash ? (
                    <button type="submit" name="act" value={`restore:${t.id}`} disabled={busy} aria-label="Restore" title="Restore" className={iconBtnCls("quiet", "size-9")}>
                      <Undo2 className="size-4" aria-hidden />
                    </button>
                  ) : (
                    <>
                      <button type="submit" name="act" value={`${folder === "done" ? "open" : "done"}:${t.id}`} disabled={busy} aria-label={folder === "done" ? "Reopen" : "Mark done"} title={folder === "done" ? "Reopen" : "Mark done"} className={iconBtnCls("quiet", "size-9")}>
                        {folder === "done" ? <Undo2 className="size-4" aria-hidden /> : <CheckCheck className="size-4" aria-hidden />}
                      </button>
                      <button type="submit" name="act" value={`${t.unread ? "read" : "unread"}:${t.id}`} disabled={busy} aria-label={t.unread ? "Mark as read" : "Mark as unread"} title={t.unread ? "Mark as read" : "Mark as unread"} className={iconBtnCls("quiet", "size-9")}>
                        {t.unread ? <MailOpen className="size-4" aria-hidden /> : <Mail className="size-4" aria-hidden />}
                      </button>
                      <button type="submit" name="act" value={`trash:${t.id}`} disabled={busy} aria-label="Delete" title="Delete" className={iconBtnCls("quiet", "size-9")}>
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </form>
  );
}
