import { shortName, type Member, type TaskComment } from "@/lib/hub/tasks/model";
import { cn } from "@/lib/utils";
import { Avatar } from "./parts";

const stamp = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

/** Plain text only: React escapes it, and line breaks are kept. */
export function Comments({ comments, members, tz }: { comments: TaskComment[]; members: Member[]; tz: string }) {
  if (!comments.length) return <p className="text-small text-ink-500">No comments yet.</p>;
  const who = new Map(members.map((m) => [m.userId, m]));
  return (
    <ol className="space-y-5">
      {comments.map((c) => {
        const person = c.author_id ? who.get(c.author_id) : undefined;
        const name = c.author_label ?? (person ? shortName(person.email) : "Former member");
        return (
          <li key={c.id} className="flex gap-3">
            {c.author_label ? (
              <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-800 text-micro font-semibold text-paper-100">
                AI
              </span>
            ) : (
              <Avatar person={person} />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-small">
                <span className="font-semibold text-ink-800">{name}</span> <time dateTime={c.created_at} className="ml-2 text-caption text-ink-500">{stamp(c.created_at, tz)}</time>
              </p>
              <p className={cn("mt-1 whitespace-pre-wrap break-words text-body", c.author_label ? "rounded-field bg-paper-0 p-4" : "text-ink-800")}>{c.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
