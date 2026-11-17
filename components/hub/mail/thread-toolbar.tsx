"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, CheckCheck, Forward, Loader2, Mail, Trash2, Undo2 } from "lucide-react";
import { btnCls, iconBtnCls } from "@/components/brand/styles";
import type { FormState } from "@/lib/hub/actions";
import { purgeThreads, setThreadsState } from "@/lib/hub/mail-actions";

/**
 * Above a conversation, like Gmail: back to the list, then Done (or Reopen), Mark unread, Forward and Delete. Delete moves it to
 * Trash and returns to the list. In Trash the buttons are Restore and Delete forever, which asks first, in the page.
 */
export function ThreadToolbar({ brandId, threadId, status, back, canEdit, canPurge, forwardHref }: { brandId: string; threadId: string; status: "open" | "done" | "trash"; back: string; canEdit: boolean; canPurge: boolean; forwardHref?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setThreadsState, {});
  const [purged, purgeAction, purging] = useActionState<FormState, FormData>(purgeThreads, {});
  const trashed = status === "trash";
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Link href={back} aria-label="Back to the list" className={iconBtnCls()}>
        <ArrowLeft className="size-5" aria-hidden />
      </Link>
      {canEdit && (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="brandId" value={brandId} />
          <input type="hidden" name="back" value={back} />
          {trashed ? (
            <button type="submit" name="act" value={`restore:${threadId}`} disabled={pending} className={btnCls("secondary", "xs")}>
              <Undo2 className="size-4" aria-hidden />
              Restore
            </button>
          ) : (
            <>
              <button type="submit" name="act" value={`${status === "open" ? "done" : "open"}:${threadId}`} disabled={pending} className={btnCls("secondary", "xs")}>
                {status === "open" ? <CheckCheck className="size-4" aria-hidden /> : <Undo2 className="size-4" aria-hidden />}
                {status === "open" ? "Done" : "Reopen"}
              </button>
              <button type="submit" name="act" value={`unread:${threadId}`} disabled={pending} className={btnCls("secondary", "xs")}>
                <Mail className="size-4" aria-hidden />
                Mark unread
              </button>
            </>
          )}
          {forwardHref && (
            <Link href={forwardHref} className={btnCls("secondary", "xs")}>
              <Forward className="size-4" aria-hidden />
              Forward
            </Link>
          )}
          {!trashed && (
            <button type="submit" name="act" value={`trash:${threadId}`} disabled={pending} className={btnCls("secondary", "xs")}>
              <Trash2 className="size-4" aria-hidden />
              Delete
            </button>
          )}
          {pending && <Loader2 className="size-4 animate-spin text-ink-500" aria-label="Saving" />}
          {state.error && (
            <span role="alert" className="text-caption text-danger">
              {state.error}
            </span>
          )}
        </form>
      )}
      {canEdit && trashed && canPurge && (
        <details className="group">
          <summary className={`${btnCls("secondary", "xs")} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
            <Trash2 className="size-4" aria-hidden />
            Delete forever
          </summary>
          <form action={purgeAction} className="mt-3 flex flex-wrap items-center gap-3 rounded-field bg-paper-100 p-4">
            <input type="hidden" name="brandId" value={brandId} />
            <input type="hidden" name="back" value={back} />
            <p className="text-small text-ink-800">This deletes the conversation and its files for good. It cannot be undone.</p>
            <button type="submit" name="act" value={`purge:${threadId}`} disabled={purging} className={btnCls("danger", "xs")}>
              {purging ? <Loader2 className="size-4 animate-spin" aria-label="Deleting" /> : "Yes, delete forever"}
            </button>
            {purged.error && (
              <span role="alert" className="text-caption text-danger">
                {purged.error}
              </span>
            )}
          </form>
        </details>
      )}
    </div>
  );
}
