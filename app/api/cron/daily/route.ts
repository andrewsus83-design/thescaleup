import { cronAuthorized } from "@/lib/hub/telegram/daily-model";
import { sendDailyDigests } from "@/lib/hub/telegram/daily";
import { runSequences } from "@/lib/hub/email/sequence-run";
import { makeDueTasks } from "@/lib/hub/tasks/recurrence-run";
import { pruneTelegram } from "@/lib/hub/telegram/prune";

// Called once a morning by Vercel Cron (see vercel.json). It first makes the repeating tasks that are due (so the digest already lists them), then
// sends each opted-in Telegram chat its brand's day, then the emails of every running
// email sequence that are due (and adds the people who joined the CRM since automatic adding was switched on).
// Vercel sends `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET environment variable is set; without it this route refuses to run.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, error: "CRON_SECRET is not set." }, { status: 503 });
  if (!cronAuthorized(req.headers.get("authorization"), secret)) return Response.json({ ok: false }, { status: 401 });
  // Never throws, so a problem here cannot hold up the digest.
  const repeating = await makeDueTasks();
  console.log("[repeating-tasks]", JSON.stringify(repeating));
  const result = await sendDailyDigests();
  console.log("[telegram-daily]", JSON.stringify(result));
  // A failure in one must not stop the other, and the morning digest is never held up by it.
  let sequences: Awaited<ReturnType<typeof runSequences>> | null = null;
  try {
    sequences = await runSequences({ budgetMs: 35_000 });
    console.log("[sequences]", JSON.stringify(sequences));
  } catch (e) {
    console.error("[sequences] run failed:", e instanceof Error ? e.message : e);
  }
  const pruned = await pruneTelegram();
  console.log("[telegram-prune]", JSON.stringify(pruned));
  return Response.json({ ok: true, ...result, sequences, repeating });
}
