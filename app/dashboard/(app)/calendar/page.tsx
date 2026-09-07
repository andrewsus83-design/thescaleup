import { CalendarDays } from "lucide-react";
import { requireClient } from "@/lib/client/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, EmptyState } from "@/components/admin/ui";
import { planStatusMeta } from "@/lib/admin/plan-status";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function fmt(d: string) {
  return new Date(d).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function ClientCalendarPage() {
  const m = await requireClient();
  const db = createSupabaseAdminClient();
  const [itemsRes, remRes] = await Promise.all([
    db
      .from("plan_items")
      .select("id, title, due_date, status")
      .eq("member_id", m.id)
      .eq("status", "approved")
      .not("due_date", "is", null),
    db
      .from("reminders")
      .select("id, title, due_date, done")
      .eq("member_id", m.id)
      .not("due_date", "is", null),
  ]);

  type Ev = { date: string; title: string; kind: "plan" | "reminder"; status?: string; done?: boolean };
  const events: Ev[] = [
    ...(itemsRes.data ?? []).map((i) => ({
      date: i.due_date as string,
      title: i.title as string,
      kind: "plan" as const,
      status: i.status as string,
    })),
    ...(remRes.data ?? []).map((r) => ({
      date: r.due_date as string,
      title: r.title as string,
      kind: "reminder" as const,
      done: r.done as boolean,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const byDate = new Map<string, Ev[]>();
  for (const e of events) {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date)!.push(e);
  }

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Jadwal plan & reminder yang punya tanggal."
      />
      {events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="Belum ada agenda"
          hint="Item plan atau reminder dengan due date akan muncul di sini."
        />
      ) : (
        <div className="space-y-4">
          {[...byDate.entries()].map(([date, evs]) => (
            <Card key={date}>
              <p className="mb-3 font-mono text-xs uppercase tracking-wider text-coral">
                {fmt(date)}
              </p>
              <div className="space-y-2">
                {evs.map((e, i) => {
                  const meta =
                    e.kind === "plan" ? planStatusMeta(e.status) : null;
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-obsidian/40 px-4 py-2.5"
                    >
                      <span
                        className={cn(
                          "text-sm",
                          e.done ? "text-slate-500 line-through" : "text-slate-200",
                        )}
                      >
                        {e.title}
                      </span>
                      {meta ? (
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2 py-0.5 text-[0.66rem]",
                            meta.badge,
                          )}
                        >
                          {meta.label}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[0.66rem] text-slate-500">
                          reminder
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
