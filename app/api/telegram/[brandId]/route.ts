import { handleUpdate } from "@/lib/hub/telegram/bot";
import { verifySecret, webhookSecret } from "@/lib/hub/telegram/secret";
import { UUID } from "@/lib/hub/tasks/context";

// Where Telegram delivers a brand's bot messages once "commands" are turned on in Settings > Telegram. Telegram puts the brand's secret in
// X-Telegram-Bot-Api-Secret-Token; anything without it is refused before it is read. After that the answer is always 200, so Telegram never
// resends a message the hub has already dealt with (or has chosen to ignore).
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  if (!UUID.test(brandId)) return new Response("Not found", { status: 404 });
  if (!webhookSecret(brandId)) return new Response("Not ready", { status: 503 });
  if (!verifySecret(brandId, req.headers.get("x-telegram-bot-api-secret-token"))) return new Response("Unauthorized", { status: 401 });
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > 100_000) return Response.json({ ok: true });
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    /* not JSON: nothing to do */
  }
  await handleUpdate(brandId, body);
  return Response.json({ ok: true });
}
