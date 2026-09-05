import Link from "next/link";
import {
  Images,
  UploadCloud,
  FileText,
  Video,
  Music,
  Trash2,
  Download,
  Database,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { PageHeader, Card, EmptyState } from "@/components/admin/ui";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { uploadAsset, deleteAsset } from "@/lib/admin/actions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_ICON: Record<string, typeof FileText> = {
  video: Video,
  audio: Music,
  pdf: FileText,
  document: FileText,
};

function fmtSize(n?: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const user = await requireAdmin();
  const { brand } = await searchParams;

  if (!isSupabaseAdminConfigured()) {
    return (
      <>
        <PageHeader title="Assets" />
        <EmptyState icon={<Database className="h-5 w-5" />} title="Supabase belum terkonfigurasi" />
      </>
    );
  }

  const db = createSupabaseAdminClient();
  const [{ data: assetsData }, { data: members }] = await Promise.all([
    db.from("assets").select("*, member:leads(business, name)").order("created_at", { ascending: false }),
    db.from("leads").select("id, business, name").order("business"),
  ]);

  const all = assetsData ?? [];
  const brands = Array.from(
    new Set(all.map((a) => a.brand).filter(Boolean)),
  ) as string[];
  const filtered = brand ? all.filter((a) => a.brand === brand) : all;

  // signed URLs
  const signed = await Promise.all(
    filtered.map((a) =>
      db.storage.from("assets").createSignedUrl(a.storage_path, 3600),
    ),
  );
  const withUrls = filtered.map((a, i) => ({
    ...a,
    url: signed[i]?.data?.signedUrl ?? null,
  }));

  return (
    <>
      <PageHeader
        title="Assets"
        description="Galeri aset klien & ScaleUp. Semua tipe file, disortir per brand/member."
      />

      {/* upload */}
      <Card className="mb-5">
        <form
          action={uploadAsset}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
        >
          <label className="lg:col-span-2">
            <span className="mb-2 block text-xs text-slate-500">File</span>
            <input
              type="file"
              name="file"
              required
              className="block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-coral/15 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-coral hover:file:bg-coral/25"
            />
          </label>
          <input
            name="brand"
            placeholder="Brand / label"
            className="rounded-xl border border-white/10 bg-obsidian/50 px-3 py-2.5 text-sm text-mist placeholder:text-slate-600 focus:border-coral/50 focus:outline-none"
          />
          <div className="flex gap-2">
            <select
              name="member_id"
              className="w-full rounded-xl border border-white/10 bg-obsidian/50 px-3 py-2.5 text-sm text-slate-200 focus:border-coral/50 focus:outline-none"
            >
              <option value="" className="bg-obsidian">— Member —</option>
              {(members ?? []).map((m) => (
                <option key={m.id} value={m.id} className="bg-obsidian">
                  {m.business || m.name || m.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-coral to-sunset px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 sm:col-span-2 lg:col-span-4">
            <UploadCloud className="h-4 w-4" /> Upload asset
          </button>
        </form>
      </Card>

      {/* brand filter */}
      {brands.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <Link
            href="/admin/assets"
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm",
              !brand ? "border-coral/40 bg-coral/10 text-coral" : "border-white/10 text-slate-400 hover:text-white",
            )}
          >
            Semua
          </Link>
          {brands.map((b) => (
            <Link
              key={b}
              href={`/admin/assets?brand=${encodeURIComponent(b)}`}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm",
                brand === b ? "border-coral/40 bg-coral/10 text-coral" : "border-white/10 text-slate-400 hover:text-white",
              )}
            >
              {b}
            </Link>
          ))}
        </div>
      )}

      {withUrls.length === 0 ? (
        <EmptyState icon={<Images className="h-5 w-5" />} title="Belum ada asset" hint="Upload file pertama Anda di atas." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {withUrls.map((a) => {
            const member = (a.member as unknown as { business?: string; name?: string } | null) ?? null;
            const Icon = KIND_ICON[a.kind ?? "document"] ?? FileText;
            return (
              <div
                key={a.id}
                className="group overflow-hidden rounded-2xl border border-white/8 bg-card/40"
              >
                <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-obsidian/60">
                  {a.kind === "image" && a.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                  ) : (
                    <Icon className="h-8 w-8 text-slate-600" />
                  )}
                  <span className="absolute left-2 top-2 rounded-md bg-black/50 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase text-slate-300 backdrop-blur">
                    {a.kind}
                  </span>
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium text-slate-200" title={a.name}>
                    {a.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {a.brand || member?.business || member?.name || "Umum"} · {fmtSize(a.size_bytes)}
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    {a.url && (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/5 px-2 py-1.5 text-xs text-slate-300 hover:bg-white/10"
                      >
                        <Download className="h-3.5 w-3.5" /> Buka
                      </a>
                    )}
                    {user.perms.delete && (
                      <form action={deleteAsset.bind(null, a.id, a.storage_path)}>
                        <ConfirmSubmit
                          message={`Hapus "${a.name}"?`}
                          className="inline-flex items-center rounded-lg bg-bad/10 px-2 py-1.5 text-xs text-bad hover:bg-bad/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </ConfirmSubmit>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
