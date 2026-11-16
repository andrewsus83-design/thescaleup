import "server-only";

/** Minimal Resend client over fetch. Needs RESEND_API_KEY; MAIL_FROM must be a sender verified in Resend. */
export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail(opts: { to: string; subject: string; text: string; html?: string }): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set" };
  const from = process.env.MAIL_FROM || "ScaleUp <noreply@thescaleup.xyz>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, text: opts.text, html: opts.html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "mail failed" };
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function loginCodeMail(code: string) {
  return {
    subject: `Your ScaleUp sign-in code: ${code}`,
    text: `Your ScaleUp sign-in code is ${code}.\n\nIt expires in an hour. If you did not ask for it, ignore this email.`,
    html: `<p>Your ScaleUp sign-in code is</p><p style="font-size:28px;letter-spacing:6px;font-weight:700">${esc(code)}</p><p>It expires in an hour. If you did not ask for it, ignore this email.</p>`,
  };
}

export function inviteMail(opts: { brand: string; role: string; invitedBy: string; url: string }) {
  return {
    subject: `${opts.invitedBy} invited you to ${opts.brand} on ScaleUp`,
    text: `${opts.invitedBy} invited you to join ${opts.brand} on ScaleUp as ${opts.role}.\n\nOpen this link and sign in with this email address:\n${opts.url}\n\nThe link works once and expires in 7 days.`,
    html: `<p><b>${esc(opts.invitedBy)}</b> invited you to join <b>${esc(opts.brand)}</b> on ScaleUp as ${esc(opts.role)}.</p><p><a href="${esc(opts.url)}">Open the invitation</a></p><p>Sign in with this email address. The link works once and expires in 7 days.</p>`,
  };
}
