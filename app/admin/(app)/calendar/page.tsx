import { CalendarDays, Trash2, Plus, Database } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { PageHeader, Card, EmptyState } from "@/components/admin/ui";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { PlanStatusSelect } from "@/components/admin/plan-status-select";
import { addPlan, deletePlan } from "@/lib/admin/actions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const planStatusStyle: Record<string, string> = {
  planned: "text-slate-400",
  in_progress: "text-sky-400",
  done: "text-good",
};

export default async function CalendarPage() {
  const user = await requireAdmin();

  if (!isSupabaseAdminConfigured()) {
    return (
      <>
        <PageHeader title="Calendar" />
        <EmptyState icon={<Database className="h-5 w-5" />} title="Supabase belum terkonfigurasi" />
      </>
    );
  }

  const db = createSupabaseAdminClient();
  const [{ data: members }, { data: plans }] = await Promise.all([
    db.from("leads").select("id, business, name, status").order("business"),
    db
      .from("plans")
      .select("*, member:leads(business, name)")
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  const memberList = members ?? [];
  const planList = plans ?? [];

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Plan & janji scale-up untuk tiap member yang sudah join."
      />

      {/* add plan */}
      <Card className="mb-5">
        <p className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-500">
          <Plus className="h-3.5 w-3.5" /> Tambah plan
        </p>
        <form action={addPlan} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            name="member_id"
            className="rounded-xl border border-white/10 bg-obsidian/50 px-3 py-2.5 text-sm text-slate-200 focus:border-coral/50 focus:outline-none"
          >
            <option value="" className="bg-obsidian">
              — Pilih member —
            </option>
            {memberList.map((m) => (
              <option key={m.id} value={m.id} className="bg-obsidian">
                {m.business || m.name || m.id.slice(0, 8)}
              </option>
            ))}
          </select>
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
            name="start_date"
            className="rounded-xl border border-white/10 bg-obsidian/50 px-3 py-2.5 text-sm text-slate-300 focus:border-coral/50 focus:outline-none"
          />
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

      {/* plans */}
      {planList.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="Belum ada plan"
          hint="Tambahkan plan untuk mulai melacak janji scale-up ke member."
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-white/5">
            {planList.map((p) => {
              const member = (p.member as unknown as { business?: string; name?: string } | null) ?? null;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-slate-100">{p.title}</p>
                      {p.phase && (
                        <span className="rounded-full border border-coral/25 bg-coral/10 px-2 py-0.5 font-mono text-[0.62rem] text-coral">
                          {p.phase}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {member?.business || member?.name || "Umum"}
                      {p.due_date ? ` · due ${new Date(p.due_date).toLocaleDateString("id-ID")}` : ""}
                      {p.detail ? ` · ${p.detail}` : ""}
                    </p>
                  </div>
                  <span className={cn("text-xs font-medium", planStatusStyle[p.status] ?? "text-slate-400")}>
                    ●
                  </span>
                  <PlanStatusSelect id={p.id} status={p.status} />
                  {user.perms.delete && (
                    <form action={deletePlan.bind(null, p.id)}>
                      <ConfirmSubmit
                        message="Hapus plan ini?"
                        className="inline-flex items-center rounded-md bg-bad/10 px-2 py-1.5 text-xs text-bad hover:bg-bad/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </ConfirmSubmit>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
