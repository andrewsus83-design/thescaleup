import { requireAdmin } from "@/lib/admin/auth";
import { getClient, getClientKey } from "@/lib/report/data";
import { getReportRules, getTemplateName, getTemplateFile } from "@/lib/report/rules";
import { fetchZernioMetrics } from "@/lib/report/zernio";
import { buildReportWorkbook } from "@/lib/report/excel";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const sinceQ = url.searchParams.get("since") ?? "";
  const untilQ = url.searchParams.get("until") ?? "";
  const since = DATE.test(sinceQ) ? sinceQ : undefined;
  const until = DATE.test(untilQ) ? untilQ : undefined;

  const accountQ = url.searchParams.get("account") ?? "";
  const [apiKey, storedAccount, rules, templateType, templateFile] = await Promise.all([
    getClientKey(id, "zernio"),
    getClientKey(id, "zernio_account_id"),
    getReportRules(),
    getTemplateName(),
    getTemplateFile(),
  ]);
  const accountId = accountQ || storedAccount;

  const metrics = await fetchZernioMetrics({ apiKey, accountId, since, until, period: since && until ? `${since} → ${until}` : "last_30d" });
  if (!metrics.connected) {
    return new Response(`Tidak bisa menarik report: ${metrics.reason ?? "belum terkoneksi Zernio"}`, {
      status: 422,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const buf = await buildReportWorkbook(client, metrics, rules, templateType || "post_master", templateFile?.base64 ?? null);
  const fname = `${client.slug}-report-${until ?? "latest"}.xlsx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store",
    },
  });
}
