import Link from "next/link";
import { Paperclip } from "lucide-react";
import { Card, Chip } from "@/components/brand/primitives";
import type { MessageRow } from "@/lib/hub/mail/data";
import { personLabel } from "@/lib/hub/mail/model";
import { fmtStamp } from "@/lib/hub/tasks/dates";
import { HtmlFrame } from "./forms";

const STATUS: Record<string, { tone: "ok" | "bad" | "neutral"; label: string } | undefined> = {
  sent: { tone: "neutral", label: "Sent" },
  delivered: { tone: "ok", label: "Delivered" },
  bounced: { tone: "bad", label: "Bounced" },
  complained: { tone: "bad", label: "Marked as spam" },
  failed: { tone: "bad", label: "Failed" },
};

const kb = (n?: number | null) => (n ? (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`) : "");

export function Message({ m, slug, tz, today }: { m: MessageRow; slug: string; tz: string; today: string }) {
  const st = m.direction === "out" ? STATUS[m.status] : undefined;
  return (
    <Card small className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-body font-semibold text-ink-800">
            {personLabel(m.from_name, m.from_email)} <span className="font-normal text-ink-500">&lt;{m.from_email}&gt;</span>
          </p>
          <p className="truncate text-caption text-ink-500">To {m.to_emails.join(", ")}{m.cc_emails.length > 0 && <> · Cc {m.cc_emails.join(", ")}</>}</p>
        </div>
        <div className="flex items-center gap-2">
          {st && <Chip tone={st.tone}>{st.label}</Chip>}
          <time dateTime={m.occurred_at} className="text-caption text-ink-500">
            {fmtStamp(m.occurred_at, tz, today)}
          </time>
        </div>
      </div>
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
                <span className="shrink-0 whitespace-nowrap text-caption text-ink-500">{kb(a.size)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
