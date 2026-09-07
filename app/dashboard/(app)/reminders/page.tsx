import { Plus } from "lucide-react";
import { requireClient } from "@/lib/client/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card } from "@/components/admin/ui";
import { ReminderList } from "@/components/client/reminder-list";
import { clientAddTodo } from "@/lib/client/actions";

export const dynamic = "force-dynamic";

export default async function ClientRemindersPage() {
  const m = await requireClient();
  const db = createSupabaseAdminClient();
  const { data } = await db
    .from("reminders")
    .select("id, title, detail, done, due_date")
    .eq("member_id", m.id)
    .eq("audience", "client")
    .order("done", { ascending: true })
    .order("due_date", { ascending: true });

  return (
    <>
      <PageHeader title="Reminders & Todo" description="Tugas & pengingat Anda." />

      <Card className="mb-5">
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

      <ReminderList items={data ?? []} />
    </>
  );
}
