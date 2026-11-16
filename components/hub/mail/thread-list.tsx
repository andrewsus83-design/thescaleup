import Link from "next/link";
import type { ThreadRow } from "@/lib/hub/mail/data";
import { fmtStamp } from "@/lib/hub/tasks/dates";
import { cn } from "@/lib/utils";

/** One row per conversation: who, when, the subject and the start of the last message. Unread ones are bold and marked for screen readers too. */
export function ThreadList({ threads, base, tz, today }: { threads: ThreadRow[]; base: string; tz: string; today: string }) {
  return (
      <ul className="divide-y divide-ink-100 overflow-hidden rounded-bubble border border-hairline bg-paper-0">
        {threads.map((t) => (
          <li key={t.id}>
            <Link href={`${base}/${t.id}`} className="block px-5 py-4 hover:bg-paper-100">
              <div className="flex items-baseline justify-between gap-3">
                <p className={cn("min-w-0 truncate text-body text-ink-800", t.unread ? "font-bold" : "font-semibold")}>
                  {t.unread && <span className="sr-only">Unread. </span>}
                  {t.unread && <span aria-hidden className="mr-2 inline-block size-2 rounded-full bg-brand-500 align-middle" />}
                  {t.last_from || t.mailbox}
                </p>
                <time dateTime={t.last_message_at} className="shrink-0 text-caption text-ink-500">
                  {fmtStamp(t.last_message_at, tz, today)}
                </time>
              </div>
              <p className={cn("mt-0.5 truncate text-small text-ink-800", t.unread && "font-semibold")}>{t.subject || "(no subject)"}</p>
              <p className="mt-0.5 flex items-center gap-2 text-small text-ink-500">
                <span className="truncate">{t.last_snippet}</span>
                {t.message_count > 1 && <span className="shrink-0 font-mono text-micro">{t.message_count}</span>}
              </p>
            </Link>
          </li>
        ))}
      </ul>
  );
}
