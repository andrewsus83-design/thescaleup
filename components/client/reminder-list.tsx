"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { clientToggleReminder } from "@/lib/client/actions";
import { cn } from "@/lib/utils";

type Reminder = {
  id: string;
  title: string;
  detail?: string | null;
  done: boolean;
  due_date?: string | null;
};

function Row({ r }: { r: Reminder }) {
  const [pending, start] = useTransition();
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-white/8 bg-card/40 p-3.5 transition-opacity",
        pending && "opacity-50",
      )}
    >
      <button
        onClick={() => start(() => clientToggleReminder(r.id, !r.done))}
        disabled={pending}
        className={cn(
          "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
          r.done
            ? "border-good bg-good text-white"
            : "border-white/20 hover:border-coral",
        )}
        aria-label="toggle"
      >
        {r.done && <Check className="h-3.5 w-3.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm",
            r.done ? "text-slate-500 line-through" : "text-slate-200",
          )}
        >
          {r.title}
        </p>
        {r.detail && <p className="mt-0.5 text-xs text-slate-500">{r.detail}</p>}
      </div>
      {r.due_date && (
        <span className="shrink-0 font-mono text-xs text-slate-500">
          {r.due_date}
        </span>
      )}
    </div>
  );
}

export function ReminderList({ items }: { items: Reminder[] }) {
  if (!items.length) {
    return (
      <p className="rounded-2xl border border-dashed border-white/10 bg-card/20 px-6 py-10 text-center text-sm text-slate-500">
        Belum ada reminder / todo.
      </p>
    );
  }
  return (
    <div className="space-y-2.5">
      {items.map((r) => (
        <Row key={r.id} r={r} />
      ))}
    </div>
  );
}
