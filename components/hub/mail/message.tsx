import Link from "next/link";
import { Paperclip } from "lucide-react";
import { Chip } from "@/components/brand/primitives";
import type { MessageRow } from "@/lib/hub/mail/data";
import { sizeLabel } from "@/lib/hub/mail/files";
import { personLabel, previewOf } from "@/lib/hub/mail/model";
import { fmtStamp } from "@/lib/hub/tasks/dates";
import { Avatar } from "./avatar";
import { HtmlFrame } from "./forms";

const STATUS: Record<string, { tone: "ok" | "bad" | "neutral"; label: string } | undefined> = {
  sent: { tone: "neutral", label: "Sent" },
  delivered: { tone: "ok", label: "Delivered" },
  bounced: { tone: "bad", label: "Bounced" },
  complained: { tone: "bad", label: "Marked as spam" },
  failed: { tone: "bad", label: "Failed" },
};

/**
 * One message of a conversation, like Gmail's: a row with the sender's circle, name and time that opens to the full message.
 * Older messages start closed with the start of their text; the newest starts open. It is a <details>, so it works without scripts.
 */
export function Message({ m, slug, tz, today, open }: { m: MessageRow; slug: string; tz: string; today: string; open: boolean }) {
  const st = m.direction === "out" ? STATUS[m.status] : undefined;
  const name = personLabel(m.from_name, m.from_email);
  return (
    <details open={open} className="group overflow-hidden rounded-bubble border border-hairline bg-paper-0">
      <summary className="flex cursor-pointer list-none items-start gap-3 p-4 hover:bg-paper-50 [&::-webkit-details-marker]:hidden">
        <Avatar name={m.from_name} email={m.from_email} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-body font-semibold text-ink-800">
              {name}
              <span className="hidden text-caption font-normal text-ink-500 sm:inline"> &lt;{m.from_email}&gt;</span>
            </p>
            <time dateTime={m.occurred_at} className="shrink-0 text-caption text-ink-500">
              {fmtStamp(m.occurred_at, tz, today)}
            </time>
          </div>
          <p className="truncate text-small text-ink-500 group-open:hidden">{previewOf(m.text_body) || "(no text)"}</p>
          <p className="hidden truncate text-caption text-ink-500 group-open:block">
            To {m.to_emails.join(", ")}
            {m.cc_emails.length > 0 && <> · Cc {m.cc_emails.join(", ")}</>}
          </p>
        </div>
      </summary>
      <div className="space-y-3 px-4 pb-4 sm:pl-[4.25rem]">
        {st && <Chip tone={st.tone}>{st.label}</Chip>}
        {m.error && <p className="text-small text-danger">{m.error}</p>}
        {/* Plain text only: React escapes it. The sender's own formatting is behind a button, in a sandbox. */}
        <p className="whitespace-pre-wrap break-words text-body text-ink-800">{m.text_body || "(no text)"}</p>
        {m.direction === "in" && m.html_body && (
          <details>
            <summary className="hit-44 inline-flex min-h-11 cursor-pointer items-center text-small font-semibold text-ink-500 hover:text-ink-800">Show original formatting</summary>
            <HtmlFrame html={m.html_body} />
          </details>
        )}
        {m.attachments.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {m.attachments.map((a) => (
              <li key={a.id} className="min-w-0 max-w-full">
                <Link href={`/hub/b/${slug}/mail/file/${m.id}/${a.id}`} prefetch={false} className="hit-44 inline-flex min-h-11 max-w-full items-center gap-2 rounded-full bg-paper-100 px-4 text-small text-ink-800 hover:bg-paper-200">
                  <Paperclip className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate">{a.filename || "Attachment"}</span>
                  <span className="shrink-0 whitespace-nowrap text-caption text-ink-500">{sizeLabel(a.size)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
