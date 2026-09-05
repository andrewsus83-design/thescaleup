import { NextResponse } from "next/server";

export const runtime = "nodejs";

type LeadPayload = Record<string, unknown>;

/**
 * Lead capture endpoint for the onboarding form.
 *
 * Persists to Supabase if SUPABASE_URL + a key are configured (table: `leads`);
 * otherwise it logs and still returns ok so the client UX never breaks.
 * This is intentionally dependency-free (uses REST) so it is wire-ready before
 * the backend/machine is fully provisioned.
 */
export async function POST(req: Request) {
  let body: LeadPayload;
  try {
    body = (await req.json()) as LeadPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // Minimal validation — we want to lose as few leads as possible.
  const name = String(body.name ?? "").trim();
  const contact = String(body.whatsapp ?? body.email ?? "").trim();
  if (!name || !contact) {
    return NextResponse.json(
      { ok: false, error: "missing_contact" },
      { status: 422 },
    );
  }

  const record = {
    ...body,
    source: "landing_onboarding",
    user_agent: req.headers.get("user-agent") ?? null,
    created_at: new Date().toISOString(),
  };

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify(record),
      });
      if (!res.ok) {
        console.error("[lead] supabase insert failed", res.status, await res.text());
      }
    } catch (err) {
      console.error("[lead] supabase insert error", err);
    }
  } else {
    console.log("[lead] captured (no store configured):", JSON.stringify(record));
  }

  return NextResponse.json({ ok: true });
}
