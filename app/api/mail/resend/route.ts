import { applyDeliveryEvent, ingestReceived } from "@/lib/hub/mail/inbound";
import { cleanSecret, svixFailure, verifySvix } from "@/lib/hub/mail/svix";

// Resend calls this when mail arrives at a brand's address and when an email we sent is delivered or bounces.
// Set it up in Resend → Webhooks: URL https://<this site>/api/mail/resend, events email.received, email.sent,
// email.delivered, email.bounced, email.complained, email.failed. Put its signing secret in RESEND_WEBHOOK_SECRET.

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const secret = cleanSecret(process.env.RESEND_WEBHOOK_SECRET ?? "");
  if (!secret) return new Response("RESEND_WEBHOOK_SECRET is not set", { status: 503 });

  const body = await request.text(); // the signature covers the raw body, so it is read as text before anything parses it
  const headers = {
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
  };
  const ok = verifySvix({ ...headers, body, secret });
  if (!ok) {
    // Never the secret itself: just why the check failed, so a wrong or stale secret can be told apart from a bad request.
    console.warn("[mail webhook] rejected", JSON.stringify(svixFailure({ ...headers, secret })));
    return new Response("Invalid signature", { status: 401 });
  }

  let event: { type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const data = (event.data ?? {}) as { email_id?: string; bounce?: { message?: string }; failed?: { reason?: string } };

  if (event.type === "email.received") {
    if (!data.email_id) return new Response("Missing email_id", { status: 400 });
    const result = await ingestReceived(data.email_id);
    // "retry" answers 500 so Resend tries again; everything else is final.
    return result === "retry" ? new Response("Try again", { status: 500 }) : Response.json({ ok: true, result });
  }
  if (event.type) await applyDeliveryEvent(event.type, data);
  return Response.json({ ok: true });
}
