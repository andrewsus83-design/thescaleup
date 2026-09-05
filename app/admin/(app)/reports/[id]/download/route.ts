import { getAdminUser } from "@/lib/admin/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAdminUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!isSupabaseAdminConfigured())
    return new Response("Not configured", { status: 500 });

  const { id } = await params;
  const db = createSupabaseAdminClient();
  const { data: r } = await db
    .from("reports")
    .select("*, member:leads(business, name)")
    .eq("id", id)
    .single();
  if (!r) return new Response("Not found", { status: 404 });

  const content = (r.content ?? {}) as Record<string, unknown>;
  const context = (content.context ?? {}) as Record<string, unknown>;
  const roadmap = (content.roadmap ?? {}) as Record<string, string[]>;
  const member = (r.member as unknown as { business?: string; name?: string } | null) ?? null;

  const ctxRows = Object.entries(context)
    .filter(([, v]) => v && !(Array.isArray(v) && v.length === 0))
    .map(
      ([k, v]) =>
        `<tr><td class="k">${esc(k)}</td><td>${esc(Array.isArray(v) ? v.join(", ") : v)}</td></tr>`,
    )
    .join("");

  const roadmapHtml = Object.entries(roadmap)
    .map(
      ([phase, items]) =>
        `<div class="phase"><h3>${esc(phase.replace(/_/g, " "))}</h3><ul>${(items as string[])
          .map((i) => `<li>${esc(i)}</li>`)
          .join("")}</ul></div>`,
    )
    .join("");

  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(r.title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; margin: 0; color: #0f172a; background: #fff; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 48px 32px; }
  .brand { display:inline-block; font-weight:800; letter-spacing:-.02em; color:#E03E1A; font-size:14px; }
  h1 { font-size: 30px; margin: 10px 0 6px; letter-spacing: -0.02em; }
  .sum { color:#475569; font-size:15px; line-height:1.6; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .12em; color:#94a3b8; margin: 34px 0 12px; }
  table { width:100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 9px 0; border-bottom: 1px solid #eef2f7; vertical-align: top; }
  td.k { color:#94a3b8; text-transform: capitalize; width: 180px; }
  .phase { border:1px solid #eef2f7; border-radius:14px; padding:16px 18px; margin-bottom:12px; }
  .phase h3 { margin:0 0 8px; font-size:15px; text-transform:capitalize; color:#E03E1A; }
  .phase ul { margin:0; padding-left:18px; color:#334155; font-size:14px; line-height:1.7; }
  .foot { margin-top:44px; padding-top:18px; border-top:1px solid #eef2f7; color:#94a3b8; font-size:12px; }
</style></head>
<body><div class="wrap">
  <span class="brand">ScaleUp · Audit Report</span>
  <h1>${esc(r.title)}</h1>
  ${r.summary ? `<p class="sum">${esc(r.summary)}</p>` : ""}
  ${member ? `<p class="sum"><strong>Klien:</strong> ${esc(member.business || member.name)}</p>` : ""}
  ${ctxRows ? `<h2>Konteks Bisnis</h2><table>${ctxRows}</table>` : ""}
  ${roadmapHtml ? `<h2>Roadmap</h2>${roadmapHtml}` : ""}
  <div class="foot">Digenerate oleh ScaleUp — ${esc(new Date(r.created_at).toLocaleString("id-ID"))}. Dokumen ini bersifat rahasia.</div>
</div></body></html>`;

  const slug = (member?.business || member?.name || "report")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40);

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="scaleup-report-${slug}.html"`,
    },
  });
}
