import Link from "next/link";
import { Plus, Database, ArrowLeft, Users } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/admin/ui";
import { addPlan } from "@/lib/admin/actions";
import { MonthCalendar, type CalEvent } from "@/components/calendar/month-calendar";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  await requireAdmin();
  if (!isSupabaseAdminConfigured()) {
    return (
      <>
        <PageHeader title="Calendar" />
        <EmptyState icon={<Database className="h-5 w-5" />} title="Supabase belum terkonfigurasi" />
      </>
    );
  }

  const { member: memberId } = await searchParams;
  const db = createSupabaseAdminClient();
  const { data: members } = await db
    .from("leads")
    .select("id, business, name, status")
    .order("created_at", { ascending: false });
  const memberList = members ?? [];

  // Step 1 — pick a client.
  if (!memberId) {
    return (
      <>
        <PageHeader
          title="Calendar"
          description="Pilih klien dulu untuk melihat kalender & tanggal jatuh temponya."
        />
        {memberList.length === 0 ? (
          <EmptyState icon={<Users className="h-5 w-5" />} title="Belum ada member" />
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-white/5">
              {memberList.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/admin/calendar?member=${m.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-white/5"
                  >
                    <span className="truncate text-sm text-slate-200">
                      {m.business || m.name || "—"}
                    </span>
                    <StatusBadge status={m.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </>
    );
  }

  // Step 2 — that client's calendar.
  const [{ data: member }, plansRes, remRes] = await Promise.all([
    db.from("leads").select("business, name").eq("id", memberId).single(),
    db
      .from("plans")
      .select("id, title, due_date, status, phase")
      .eq("member_id", memberId)
      .not("due_date", "is", null),
    db
      .from("reminders")
      .select("id, title, due_date, done")
      .eq("member_id", memberId)
      .not("due_date", "is", null),
  ]);
  const memberName = member?.business || member?.name || "Klien";

  const groupOf = (s: string) =>
    s === "in_progress" ? "Sedang Dikerjakan" : s === "done" ? "Selesai" : "Terjadwal";
  const toneOf = (s: string): CalEvent["tone"] =>
    s === "in_progress" ? "sky" : s === "done" ? "good" : "coral";

  const events: CalEvent[] = [
    ...((plansRes.data ?? []).map((p) => ({
      date: p.due_date as string,
      title: p.title as string,
      group: groupOf(p.status as string),
      tone: toneOf(p.status as string),
      meta: (p.phase as string) || "due",
    })) as CalEvent[]),
    ...((remRes.data ?? []).map((r) => ({
      date: r.due_date as string,
      title: r.title as string,
      group: "Reminder",
      tone: (r.done ? "good" : "warn") as CalEvent["tone"],
      meta: r.done ? "selesai" : "reminder",
    })) as CalEvent[]),
  ];

  return (
    <>
      <Link
        href="/admin/calendar"
        className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-coral"
      >
        <ArrowLeft className="h-4 w-4" /> Ganti klien
      </Link>
      <PageHeader
        title="Calendar"
        description={`Jadwal & jatuh tempo — ${memberName}. Klik tanggal untuk melihat apa yang jatuh tempo hari itu.`}
      />

      <MonthCalendar
        events={events}
        groupOrder={["Terjadwal", "Sedang Dikerjakan", "Selesai", "Reminder"]}
        emptyLabel="Tidak ada yang jatuh tempo di tanggal ini."
      />

      <Card className="mt-6">
        <p className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-500">
          <Plus className="h-3.5 w-3.5" /> Jadwalkan plan (due date)
        </p>
        <form action={addPlan} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="member_id" value={memberId} />
          <input
            name="title"
            required
            placeholder="Judul plan (mis. Setup WA funnel)"
            className="rounded-xl border border-white/10 bg-obsidian/50 px-3 py-2.5 text-sm text-mist placeholder:text-slate-600 focus:border-coral/50 focus:outline-none sm:col-span-2"
          />
          <select
            name="phase"
            className="rounded-xl border border-white/10 bg-obsidian/50 px-3 py-2.5 text-sm text-slate-200 focus:border-coral/50 focus:outline-none"
          >
            <option value="" className="bg-obsidian">Fase —</option>
            <option value="Phase 1" className="bg-obsidian">Phase 1</option>
            <option value="Phase 2" className="bg-obsidian">Phase 2</option>
            <option value="Phase 3" className="bg-obsidian">Phase 3</option>
          </select>
          <input
            type="date"
            name="due_date"
            className="rounded-xl border border-white/10 bg-obsidian/50 px-3 py-2.5 text-sm text-slate-300 focus:border-coral/50 focus:outline-none"
          />
          <input
            name="detail"
            placeholder="Detail / janji (opsional)"
            className="rounded-xl border border-white/10 bg-obsidian/50 px-3 py-2.5 text-sm text-mist placeholder:text-slate-600 focus:border-coral/50 focus:outline-none sm:col-span-2 lg:col-span-3"
          />
          <button className="rounded-xl bg-gradient-to-br from-coral to-sunset px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110">
            Tambah
          </button>
        </form>
      </Card>
    </>
  );
}
