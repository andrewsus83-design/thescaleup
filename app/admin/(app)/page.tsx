import Link from "next/link";
import { Users, FileText, CalendarDays, Images, Database, ArrowRight } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { PageHeader, StatCard, Card, StatusBadge, EmptyState } from "@/components/admin/ui";
import { MEMBER_STATUSES } from "@/lib/admin/config";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await requireAdmin();

  if (!isSupabaseAdminConfigured()) {
    return (
      <>
        <PageHeader title={`Halo, ${user.email.split("@")[0]} 👋`} />
        <EmptyState
          icon={<Database className="h-5 w-5" />}
          title="Supabase belum terkonfigurasi di environment ini"
          hint="Set SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY agar data admin bisa dimuat."
        />
      </>
    );
  }

  const db = createSupabaseAdminClient();
  const [membersRes, reportsRes, plansRes, assetsRes] = await Promise.all([
    db
      .from("leads")
      .select("id, name, business, status, created_at, category")
      .order("created_at", { ascending: false }),
    db.from("reports").select("id", { count: "exact", head: true }),
    db.from("plans").select("id", { count: "exact", head: true }),
    db.from("assets").select("id", { count: "exact", head: true }),
  ]);

  const members = membersRes.data ?? [];
  const count = (s: string) =>
    members.filter((m) => (m.status ?? "pending") === s).length;
  const recent = members.slice(0, 6);

  return (
    <>
      <PageHeader
        title={`Halo, ${user.email.split("@")[0]} 👋`}
        description="Ringkasan pipeline & aktivitas ScaleUp."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Member" value={members.length} icon={<Users className="h-5 w-5" />} href="/admin/members" accent />
        <StatCard label="Pending" value={count("pending")} icon={<Users className="h-5 w-5" />} href="/admin/members?status=pending" />
        <StatCard label="Joined" value={count("joined")} icon={<Users className="h-5 w-5" />} href="/admin/members?status=joined" />
        <StatCard label="Report" value={reportsRes.count ?? 0} icon={<FileText className="h-5 w-5" />} href="/admin/reports" />
      </div>

      {/* pipeline breakdown */}
      <Card className="mt-4">
        <p className="mb-4 font-mono text-xs uppercase tracking-wider text-slate-500">
          Pipeline
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {MEMBER_STATUSES.map((s) => (
            <Link
              key={s.value}
              href={`/admin/members?status=${s.value}`}
              className="rounded-xl border border-white/8 bg-obsidian/40 p-3.5 transition-colors hover:border-white/15"
            >
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                <span className="text-xs text-slate-400">{s.label}</span>
              </div>
              <p className="mt-1.5 font-display text-2xl font-bold text-mist">
                {count(s.value)}
              </p>
            </Link>
          ))}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <StatCard label="Plan (Calendar)" value={plansRes.count ?? 0} icon={<CalendarDays className="h-5 w-5" />} href="/admin/calendar" />
        <StatCard label="Assets" value={assetsRes.count ?? 0} icon={<Images className="h-5 w-5" />} href="/admin/assets" />
        <StatCard label="Report terkirim" value={count("prospect") + count("joined")} icon={<FileText className="h-5 w-5" />} href="/admin/reports" />
      </div>

      {/* recent members */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-mist">Member terbaru</h2>
        <Link href="/admin/members" className="inline-flex items-center gap-1.5 text-sm text-coral hover:text-coral-soft">
          Semua member <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <Card className="mt-4 p-0">
        {recent.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<Users className="h-5 w-5" />} title="Belum ada member" hint="Member masuk otomatis dari form onboarding di /mulai." />
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {recent.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/admin/members/${m.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-200">
                      {m.business || m.name || "—"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {m.category || "Tanpa kategori"}
                    </p>
                  </div>
                  <StatusBadge status={m.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
