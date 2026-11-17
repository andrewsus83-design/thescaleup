import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const KEEP_DAYS = 7;

/**
 * Tidies the two tables the bot fills as it goes: the list of messages already handled (only needed while Telegram could still resend one)
 * and link codes past their time. Called by the daily cron. Never throws; before the database step has run it just does nothing.
 */
export async function pruneTelegram(): Promise<{ updates: number; codes: number }> {
  try {
    const admin = createSupabaseAdminClient();
    const old = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString();
    const [u, c] = await Promise.all([
      admin.from("telegram_updates").delete({ count: "exact" }).lt("created_at", old),
      admin.from("telegram_codes").delete({ count: "exact" }).lt("expires_at", new Date().toISOString()),
    ]);
    return { updates: u.error ? 0 : (u.count ?? 0), codes: c.error ? 0 : (c.count ?? 0) };
  } catch {
    return { updates: 0, codes: 0 };
  }
}
