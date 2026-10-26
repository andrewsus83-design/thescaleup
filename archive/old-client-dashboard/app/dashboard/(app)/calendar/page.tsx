import { Plus } from "lucide-react";
import { requireClient } from "@/lib/client/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card } from "@/components/admin/ui";
import { MonthCalendar, type CalEvent } from "@/components/calendar/month-calendar";
import { ReminderList } from "@/components/client/reminder-list";
import { clientAddTodo } from "@/lib/client/actions";

export const dynamic = "force-dynamic";

export default async function ClientCalendarPage() {
  const m = await requireClient();
  const db = createSupabaseAdminClient();
  const [plansRes, remRes, remListRes] = await Promise.all([
    db
      .from("plans")
      .select("id, title, due_date, status, phase")
      .eq("member_id", m.id)
      .not("due_date", "is", null),
    db
      .from("reminders")
      .select("id, title, due_date, done")
      .eq("member_id", m.id)
      .not("due_date", "is", null),
    db
      .from("reminders")
      .select("id, title, detail, done, due_date")
      .eq("member_id", m.id)
      .eq("audience", "client")
      .order("done", { ascending: true })
      .order("due_date", { ascending: true }),
  ]);

  const groupOf = (s: string) =>
    s === "in_progress" ? "In Progress" : s === "done" ? "Highlights" : "Updates";
  const toneOf = (s: string): CalEvent["tone"] =>
    s === "in_progress" ? "sky" : s === "done" ? "good" : "slate";

  const events: CalEvent[] = [
    ...((plansRes.data ?? []).map((p) => ({
      date: p.due_date as string,
      title: p.title as string,
      group: groupOf(p.status as string),
      tone: toneOf(p.status as string),
      meta: (p.phase as string) || undefined,
    })) as CalEvent[]),
    ...((remRes.data ?? []).map((r) => ({
      date: r.due_date as string,
      title: r.title as string,
      group: "Updates",
      tone: (r.done ? "good" : "warn") as CalEvent["tone"],
      meta: r.done ? "selesai" : "reminder",
    })) as CalEvent[]),
  ];

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Pilih tanggal untuk melihat Updates, yang sedang In Progress, dan Highlights."
      />
      <MonthCalendar
        events={events}
        groupOrder={["Updates", "In Progress", "Highlights"]}
      />

      <div className="mt-8">
        <h2 className="mb-3 font-display text-lg font-bold text-mist">
          Reminders &amp; Todo
        </h2>
        <Card className="mb-4">
          <form
            action={clientAddTodo}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <label className="flex-1">
              <span className="mb-1.5 block text-xs text-slate-400">Todo baru</span>
              <input
                name="title"
                required
                placeholder="Contoh: pasang pixel Meta di landing page"
                className="w-full rounded-xl border border-white/10 bg-obsidian/50 px-3.5 py-2.5 text-sm text-mist placeholder:text-slate-600 focus:border-coral/50 focus:outline-none"
              />
            </label>
            <label>
              <span className="mb-1.5 block text-xs text-slate-400">Due date</span>
              <input
                name="due_date"
                type="date"
                className="rounded-xl border border-white/10 bg-obsidian/50 px-3.5 py-2.5 text-sm text-mist focus:border-coral/50 focus:outline-none"
              />
            </label>
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-coral to-sunset px-5 text-sm font-semibold text-white hover:brightness-110">
              <Plus className="h-4 w-4" /> Tambah
            </button>
          </form>
        </Card>
        <ReminderList items={remListRes.data ?? []} />
      </div>
    </>
  );
}
