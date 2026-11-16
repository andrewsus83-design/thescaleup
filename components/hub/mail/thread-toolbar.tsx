"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, CheckCheck, Loader2, Mail, Undo2 } from "lucide-react";
import { btnCls, iconBtnCls } from "@/components/brand/styles";
import type { FormState } from "@/lib/hub/actions";
import { setThreadsState } from "@/lib/hub/mail-actions";

/** Above a conversation, like Gmail: back to the list, then Done (or Reopen) and Mark unread. Both send you back to the list afterwards. */
export function ThreadToolbar({ brandId, threadId, status, back, canEdit }: { brandId: string; threadId: string; status: "open" | "done"; back: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setThreadsState, {});
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Link href={back} aria-label="Back to the list" className={iconBtnCls()}>
        <ArrowLeft className="size-5" aria-hidden />
      </Link>
      {canEdit && (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="brandId" value={brandId} />
          <input type="hidden" name="back" value={back} />
          <button type="submit" name="act" value={`${status === "open" ? "done" : "open"}:${threadId}`} disabled={pending} className={btnCls("secondary", "xs")}>
            {status === "open" ? <CheckCheck className="size-4" aria-hidden /> : <Undo2 className="size-4" aria-hidden />}
            {status === "open" ? "Done" : "Reopen"}
          </button>
          <button type="submit" name="act" value={`unread:${threadId}`} disabled={pending} className={btnCls("secondary", "xs")}>
            <Mail className="size-4" aria-hidden />
            Mark unread
          </button>
          {pending && <Loader2 className="size-4 animate-spin text-ink-500" aria-label="Saving" />}
          {state.error && (
            <span role="alert" className="text-caption text-danger">
              {state.error}
            </span>
          )}
        </form>
      )}
    </div>
  );
}
