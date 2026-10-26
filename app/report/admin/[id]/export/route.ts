import { requireAdmin } from "@/lib/admin/auth";
import { getClient, getClientKey, resolveClientZernioKey } from "@/lib/report/data";
import { getReportRules, getTemplateName, getTemplateFile } from "@/lib/report/rules";
import { fetchZernioMetrics } from "@/lib/report/zernio";
import { repairMetrics } from "@/lib/report/repair";
import { suggestPillars } from "@/lib/report/ai";
import { buildReportWorkbook } from "@/lib/report/excel";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import type { ReportMetrics } from "@/lib/report/types";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Find the most recent stored snapshot for a client + period (exact period match).
 *  Returns null if none found — callers fall back to a live Zernio fetch. */
async function getSnapshotForPeriod(clientId: string, period: string, accountId: string | null | undefined): Promise<ReportMetrics | null> {
  if (!isSupabaseAdminConfigured()) return null;
  try {
    const db = createSupabaseAdminClient();
    let q = db
      .from("report_snapshots")
      .select("data")
      .eq("client_id", clientId)
      .eq("period", period);
    if (accountId) q = q.eq("data->account->>id", accountId);
    const { data } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!data?.data) return null;
    return repairMetrics((data.data as ReportMetrics) ?? { connected: false, provider: "zernio", posts: [] });
  } catch {
    return null;
  }
}

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
  const [storedAccount, rules, templateType, templateFile] = await Promise.all([
    getClientKey(id, "zernio_account_id"),
    getReportRules(),
    getTemplateName(),
    getTemplateFile(),
  ]);
  const accountId = accountQ || storedAccount;
  const period = since && until ? `${since} → ${until}` : "last_30d";

  // Prefer the stored snapshot so the Excel matches exactly what was shown in the dashboard.
  // Fall back to a live Zernio fetch only when no matching snapshot exists.
  let metrics = await getSnapshotForPeriod(id, period, accountId);
  if (!metrics) {
    const apiKey = await resolveClientZernioKey(id, accountId);
    metrics = await fetchZernioMetrics({ apiKey, accountId, since, until, period });
    // AI-suggest pillars only on a live fetch (snapshot already has them from generateReport).
    if (metrics.connected) await suggestPillars(await getClientKey(id, "claude"), metrics.posts);
  }

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
