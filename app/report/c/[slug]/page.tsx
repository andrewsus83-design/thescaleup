import { notFound } from "next/navigation";
import { Lock, Plug } from "lucide-react";
import { getClientBySlug, getLatestSnapshot, getConfiguredProviders } from "@/lib/report/data";
import { ReportDashboard } from "@/components/report/report-dashboard";
import { ConnectForm } from "@/components/report/connect-form";
import { ReportAvatar } from "@/components/report/report-avatar";
import { Card, EmptyState } from "@/components/brand/primitives";
import { capsCls, pageX } from "@/components/brand/styles";
import { cn } from "@/lib/utils";

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
      <div className="mx-auto flex min-h-screen max-w-md items-center px-5">
        <div className="w-full">
          <EmptyState
            icon={<Lock className="size-5" aria-hidden />}
            title={`Laporan ${client.name}`}
            hint="Link laporan tidak valid atau kedaluwarsa. Minta link akses terbaru ke tim ScaleUp."
          />
        </div>
      </div>
    );
  }

  const [configured, snapshot] = await Promise.all([
    getConfiguredProviders(client.id),
    getLatestSnapshot(client.id),
  ]);
  const connected = configured.includes("zernio");

  return (
    <div className={cn("mx-auto max-w-5xl py-10 sm:py-12", pageX)}>
      {/* brand header */}
      <div className="mb-10 flex items-center gap-4">
        <ReportAvatar name={client.name} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate font-title text-h2 text-ink-800">{client.name}</h1>
          <p className="text-small text-ink-500">
            {client.igHandle ? `@${client.igHandle} · ` : ""}Laporan performa sosial
          </p>
        </div>
      </div>

      {!connected ? (
        <Card className="mx-auto max-w-md">
          <h2 className="mb-3 flex items-center gap-3 font-title text-h3 text-ink-800">
            <Plug className="size-5 text-ink-500" aria-hidden /> Hubungkan akun Zernio Anda
          </h2>
          <p className="mb-6 text-small text-ink-500">
            Masukkan API key Zernio milik akun Anda. Data laporan (reach, impressions, engagement, dll.)
            akan ditarik langsung dari Zernio — aman, tanpa perlu berbagi password Instagram.
          </p>
          <ConnectForm slug={client.slug} token={client.connectToken!} />
        </Card>
      ) : (
        <>
          <p className={cn(capsCls, "mb-4")}>Laporan terakhir{snapshot ? ` · ${snapshot.period}` : ""}</p>
          {snapshot ? (
            <ReportDashboard metrics={snapshot.data} />
          ) : (
            <EmptyState title="Akun sudah terhubung" hint="Laporan pertama sedang disiapkan tim ScaleUp." />
          )}
        </>
      )}
    </div>
  );
}
