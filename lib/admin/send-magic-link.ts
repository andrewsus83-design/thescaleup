"use server";

import { headers } from "next/headers";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

const RESEND_KEY = () => process.env.RESEND_API_KEY ?? null;
const FROM_EMAIL = () => process.env.RESEND_FROM_EMAIL || "noreply@thescaleup.xyz";

export async function sendMagicLink(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, error: "Server belum dikonfigurasi." };
  }
  const key = RESEND_KEY();
  if (!key) {
    return { ok: false, error: "Email service belum dikonfigurasi (RESEND_API_KEY)." };
  }

  const addr = email.trim().toLowerCase();
  if (!addr) return { ok: false, error: "Email tidak valid." };

  // Build the redirect URL from the current host.
  const host = (await headers()).get("host") ?? "thescaleup.xyz";
  const protocol = host.includes("localhost") ? "http" : "https";
  const redirectTo = `${protocol}://${host}/auth/callback`;

  // Generate the magic link server-side using the admin client.
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: addr,
    options: { redirectTo },
  });

  if (error || !data?.properties?.action_link) {
    return { ok: false, error: error?.message ?? "Gagal membuat magic link." };
  }

  const link = data.properties.action_link;

  // Send via Resend HTTP API.
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL(),
      to: addr,
      subject: "Masuk ke The Scaleup Chat Room",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
          <h2 style="margin-bottom:8px">Masuk ke Chat Room</h2>
          <p style="color:#555;margin-bottom:24px">Klik tombol di bawah untuk masuk. Link berlaku sekali dan kadaluarsa dalam 1 jam.</p>
          <a href="${link}" style="display:inline-block;padding:12px 24px;background:#f97316;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
            Masuk Sekarang
          </a>
          <p style="margin-top:24px;color:#888;font-size:13px">
            Jika kamu tidak meminta ini, abaikan email ini.
          </p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Gagal mengirim email (${res.status}): ${body}` };
  }

  return { ok: true };
}
