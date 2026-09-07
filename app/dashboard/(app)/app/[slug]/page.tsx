import { notFound, redirect } from "next/navigation";
import {
  ExternalLink,
  Check,
  RefreshCw,
  CircleCheck,
  Clock,
} from "lucide-react";
import { requireClient } from "@/lib/client/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card } from "@/components/admin/ui";
import { getBuilder } from "@/lib/client/builders";
import { builderTasks, BUILDER_SLUGS } from "@/lib/builders";
import { clientRequestUpdate } from "@/lib/client/actions";
import { memberBookings } from "@/lib/booking/data";
import { BookingDashboard } from "@/components/booking/booking-dashboard";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function normalizeUrl(u?: string | null): string | null {
  const s = String(u ?? "").trim();
  if (!s) return null;
  if (s.startsWith("/") || s.startsWith("http")) return s; // root-relative (e.g. /site/[id]) or absolute
  return `https://${s}`;
}

// Per-product "open the real product" action. `keys` are the config fields the
// admin builder may fill with the live product URL; `fallback` is an in-app
// destination when no external URL exists yet.
const PRODUCT_ACTION: Record<
  string,
  { label: string; keys: string[]; fallback?: string }
> = {
  website: { label: "Kunjungi Website", keys: ["website_url", "url", "live_url", "domain"] },
  store: { label: "Buka Toko", keys: ["store_url", "storefront_url", "shop_url", "url"] },
  content: { label: "Lihat Konten di Hub", keys: ["content_url"], fallback: "/scalehub" },
  ads: { label: "Buka Dashboard Iklan", keys: ["dashboard_url", "report_url", "url"] },
  opportunity: { label: "Lihat Peluang", keys: ["doc_url", "url"] },
  crm: { label: "Buka CRM", keys: ["crm_url", "url"] },
  tasks: { label: "Buka Board", keys: ["board_url", "url"] },
  support: { label: "Buka Support", keys: ["inbox_url", "helpdesk_url", "url"] },
};

function resolveProductUrl(
  slug: string,
  data: Record<string, unknown>,
  website?: string | null,
): string | null {
  const cfg = PRODUCT_ACTION[slug];
  for (const k of cfg?.keys ?? []) {
    const u = normalizeUrl(data?.[k] as string);
    if (u) return u;
  }
  if (slug === "website") {
    const u = normalizeUrl(website);
    if (u) return u;
  }
  return cfg?.fallback ?? null;
}

/** The client sees each builder as a finished PRODUCT (ready to use) — never
 *  the builder wizard. The wizard lives only in the admin backend. */
export default async function ClientAppPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const m = await requireClient();
  const { slug } = await params;
  const b = getBuilder(slug);
  if (!b || !BUILDER_SLUGS.includes(slug)) notFound();

  const db = createSupabaseAdminClient();
  const [{ data: project }, { data: lead }] = await Promise.all([
    db
      .from("builder_projects")
      .select("data, status, updated_at")
      .eq("member_id", m.id)
      .eq("builder", slug)
      .maybeSingle(),
    db.from("leads").select("website").eq("id", m.id).maybeSingle(),
  ]);

  // Non-internal clients can only open a product that was actually built.
  if (!m.isInternal && !project) redirect("/dashboard");

  // Booking = a real reservation dashboard (list + share link), not a static card.
  if (slug === "booking") {
    const rows = await memberBookings(m.id);
    return (
      <>
        <PageHeader
          title={b.title}
          description="Kelola reservasi & bagikan link booking publik Anda (gaya Calendly)."
        />
        <BookingDashboard rows={rows} shareUrl={`${site.url}/book/${m.id}`} />
      </>
    );
  }

  const data = (project?.data ?? {}) as Record<string, unknown>;
  const ready = project?.status === "submitted";
  const Icon = b.icon;
  const tasks = builderTasks(slug);

  // Primary "open the real product" action, resolved from the admin-built config.
  const href = resolveProductUrl(slug, data, lead?.website as string);
  const primary = href
    ? { label: PRODUCT_ACTION[slug]?.label ?? "Buka produk", href }
    : null;

  async function requestUpdate() {
    "use server";
    await clientRequestUpdate();
  }

  return (
    <>
      <PageHeader
        title={b.title}
        description={b.tagline}
        action={
          <form action={requestUpdate}>
            <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10">
              <RefreshCw className="h-4 w-4" /> Minta perubahan
            </button>
          </form>
        }
      />

      {/* Product hero */}
      <Card className="mb-4 border-coral/15 bg-gradient-to-br from-coral/10 via-card/40 to-card/40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-coral/25 bg-coral/10 text-coral">
              <Icon className="h-6 w-6" />
            </span>
            <div>
              <p className="font-display text-lg font-bold text-mist">{b.title}</p>
              <span
                className={cn(
                  "mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  ready
                    ? "border-good/30 bg-good/10 text-good"
                    : "border-sky-500/30 bg-sky-500/10 text-sky-400",
                )}
              >
                {ready ? (
                  <>
                    <CircleCheck className="h-3.5 w-3.5" /> Aktif &amp; siap dipakai
                  </>
                ) : (
                  <>
                    <Clock className="h-3.5 w-3.5" /> Sedang disiapkan tim ScaleUp
                  </>
                )}
              </span>
            </div>
          </div>
          {primary && (
            <a
              href={primary.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-coral to-sunset px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              <ExternalLink className="h-4 w-4" /> {primary.label}
            </a>
          )}
        </div>
      </Card>

      {/* What the product includes (delivered capabilities) */}
      <Card>
        <p className="mb-3 font-mono text-xs uppercase tracking-wider text-slate-500">
          Yang termasuk di produk ini
        </p>
        <ul className="space-y-2.5">
          {tasks.map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-sm text-slate-300">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-white/5 pt-3 text-xs text-slate-500">
          Produk ini dibangun & dikelola tim ScaleUp. Butuh perubahan? Klik{" "}
          <span className="text-slate-300">Minta perubahan</span> di atas.
        </p>
      </Card>

      {slug === "website" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="border-good/20">
            <p className="mb-3 font-mono text-xs uppercase tracking-wider text-good">
              Kekuatan Website Anda — beda website kuat vs biasa
            </p>
            <ul className="space-y-2 text-sm text-slate-300">
              {[
                "Multi-halaman lengkap: Home, Layanan, FAQ, Blog, Kontak",
                "Meta title & description tiap halaman — rapi di Google",
                "Open Graph + Twitter Card — tampil menarik saat di-share di WA/IG/FB",
                "Structured data (Schema): LocalBusiness, FAQPage, BlogPosting — gampang dikutip Google & AI Search (GEO)",
                "Mobile-friendly, cepat, dan struktur heading yang benar",
                "Blog bawaan — mesin konten SEO/GEO jangka panjang",
                "Tombol WhatsApp di setiap halaman — fokus konversi",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-good" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-white/5 pt-3 text-xs text-slate-500">
              Website biasa hanya 1 halaman tanpa schema/OG — tidak muncul rapi di
              Google, tidak dikutip AI Search, dan lemah saat dibagikan.
            </p>
          </Card>

          <Card className="border-coral/20">
            <p className="mb-3 font-mono text-xs uppercase tracking-wider text-coral">
              Cara meningkatkan lebih lanjut
            </p>
            <ul className="space-y-2 text-sm text-slate-300">
              {[
                "Pasang domain sendiri (mis. brandanda.com) — makin dipercaya & kuat di Google",
                "Tambah foto produk asli + testimoni pelanggan nyata",
                "Terbitkan artikel blog rutin (2–4/bulan) agar naik di pencarian & AI",
                "Kumpulkan review di Google Business Profile (sinyal lokal kuat)",
                "Hubungkan Booking & CRM agar pengunjung langsung jadi pelanggan",
                "Pasang Google Analytics untuk pantau traffic & konversi",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-white/5 pt-3 text-xs text-slate-500">
              Mau ScaleUp bantu semua ini? Klik{" "}
              <span className="text-slate-300">Minta perubahan</span> di atas.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
