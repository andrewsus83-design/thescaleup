import { cronAuthorized } from "@/lib/hub/telegram/daily-model";
import { sendDailyDigests } from "@/lib/hub/telegram/daily";

// Called once a morning by Vercel Cron (see vercel.json). It sends each opted-in Telegram chat its brand's day.
// Vercel sends `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET environment variable is set; without it this route refuses to run.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, error: "CRON_SECRET is not set." }, { status: 503 });
  if (!cronAuthorized(req.headers.get("authorization"), secret)) return Response.json({ ok: false }, { status: 401 });
  const result = await sendDailyDigests();
  console.log("[telegram-daily]", JSON.stringify(result));
  return Response.json({ ok: true, ...result });
}
