import { notFound } from "next/navigation";
import { Lock, Plug } from "lucide-react";
import { getClientBySlug, getLatestSnapshot, getConfiguredProviders } from "@/lib/report/data";
import { ReportDashboard } from "@/components/report/report-dashboard";
import { ConnectForm } from "@/components/report/connect-form";

export const dynamic = "force-dynamic";

export default async function ClientReport({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t } = await searchParams;
  const client = await getClientBySlug(slug);
  if (!client) notFound();

  const tokenOk = !!client.connectToken && t === client.connectToken;

  // Without the connect token, don't expose private data.
  if (!tokenOk) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Lock className="h-5 w-5" />
        </span>
        <h1 className="text-lg font-bold text-[#1B2A4A]">Laporan {client.name}</h1>
        <p className="mt-2 text-sm text-slate-500">
          Link laporan tidak valid atau kedaluwarsa. Minta link akses terbaru ke tim ScaleUp.
        </p>
      </div>
    );
  }

  const [configured, snapshot] = await Promise.all([
    getConfiguredProviders(client.id),
    getLatestSnapshot(client.id),
  ]);
  const connected = configured.includes("zernio");

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      {/* brand header */}
      <div className="mb-8 flex items-center gap-3 border-b border-slate-200 pb-6">
        <span
          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-base font-bold text-white"
          style={{ backgroundColor: client.brandColor }}
        >
          {client.name.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-[#1B2A4A]">{client.name}</h1>
          <p className="text-sm text-slate-500">
            {client.igHandle ? `@${client.igHandle} · ` : ""}Laporan performa sosial
          </p>
        </div>
      </div>

      {!connected ? (
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Plug className="h-4 w-4" /> Hubungkan akun Zernio Anda
          </div>
          <p className="mb-4 text-sm text-slate-500">
            Masukkan API key Zernio milik akun Anda. Data laporan (reach, impressions, engagement, dll.)
            akan ditarik langsung dari Zernio — aman, tanpa perlu berbagi password Instagram.
          </p>
          <ConnectForm slug={client.slug} token={client.connectToken!} />
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm font-semibold text-slate-600">
            Laporan terakhir{snapshot ? ` · ${snapshot.period}` : ""}
          </p>
          {snapshot ? (
            <ReportDashboard metrics={snapshot.data} brandColor={client.brandColor} accentColor={client.accentColor} />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">
              Akun sudah terhubung. Laporan pertama sedang disiapkan tim ScaleUp.
            </div>
          )}
        </>
      )}
    </div>
  );
}
