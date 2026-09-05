import Link from "next/link";
import { Users, Database } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import {
  PageHeader,
  Card,
  StatusBadge,
  EmptyState,
  Th,
  Td,
} from "@/components/admin/ui";
import { MEMBER_STATUSES } from "@/lib/admin/config";
import { MemberRowActions } from "@/components/admin/member-actions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status } = await searchParams;

  if (!isSupabaseAdminConfigured()) {
    return (
      <>
        <PageHeader title="Member" />
        <EmptyState icon={<Database className="h-5 w-5" />} title="Supabase belum terkonfigurasi" />
      </>
    );
  }

  const db = createSupabaseAdminClient();
  const { data } = await db
    .from("leads")
    .select(
      "id, name, business, whatsapp, email, category, status, created_at",
    )
    .order("created_at", { ascending: false });

  const all = data ?? [];
  const filtered = status
    ? all.filter((m) => (m.status ?? "pending") === status)
    : all;
  const count = (s: string) =>
    all.filter((m) => (m.status ?? "pending") === s).length;

  const tabs = [
    { value: "", label: "Semua", n: all.length },
    ...MEMBER_STATUSES.map((s) => ({ value: s.value, label: s.label, n: count(s.value) })),
  ];

  return (
    <>
      <PageHeader
        title="Member"
        description="Pipeline klien dari onboarding sampai berlangganan."
      />

      {/* filter tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = (status ?? "") === t.value;
          return (
            <Link
              key={t.value || "all"}
              href={t.value ? `/admin/members?status=${t.value}` : "/admin/members"}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                active
                  ? "border-coral/40 bg-coral/10 text-coral"
                  : "border-white/10 text-slate-400 hover:text-white",
              )}
            >
              {t.label}
              <span className="font-mono text-xs opacity-70">{t.n}</span>
            </Link>
          );
        })}
      </div>

      <Card className="overflow-hidden p-0">
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="Belum ada member di status ini"
              hint="Member baru masuk otomatis dari form onboarding /mulai dengan status Pending."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-white/8 bg-white/[0.02]">
                <tr>
                  <Th>Bisnis / Nama</Th>
                  <Th>Kontak</Th>
                  <Th>Kategori</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Aksi</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-white/[0.02]">
                    <Td>
                      <Link
                        href={`/admin/members/${m.id}`}
                        className="font-medium text-slate-100 hover:text-coral"
                      >
                        {m.business || m.name || "—"}
                      </Link>
                      {m.business && m.name && (
                        <p className="text-xs text-slate-500">{m.name}</p>
                      )}
                    </Td>
                    <Td>
                      <span className="text-slate-300">
                        {m.whatsapp ? `+62 ${m.whatsapp}` : m.email || "—"}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-slate-400">{m.category || "—"}</span>
                    </Td>
                    <Td>
                      <StatusBadge status={m.status} />
                    </Td>
                    <Td>
                      <MemberRowActions id={m.id} status={m.status ?? "pending"} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
