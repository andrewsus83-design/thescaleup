import { publicOrigin } from "@/lib/hub/email/secret";
import { unsubscribe } from "@/lib/hub/email/unsubscribe";

// The link mail apps call when someone presses their own "Unsubscribe" button (RFC 8058 one-click: a POST with no page). A GET, for
// example from someone opening the link, goes to the page that asks first, so a link checker cannot unsubscribe anyone by visiting it.
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ok = await unsubscribe(decodeURIComponent(token));
  return ok ? Response.json({ ok: true }) : new Response("This unsubscribe link is not valid.", { status: 400 });
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return Response.redirect(`${publicOrigin()}/unsubscribe/${encodeURIComponent(decodeURIComponent(token))}`, 302);
}
