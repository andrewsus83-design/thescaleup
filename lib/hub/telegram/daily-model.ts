// Pure rules for the morning summary: who is allowed to start the scheduled run, and which linked chats are due. No I/O.

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Vercel Cron calls the route with `Authorization: Bearer <CRON_SECRET>`. With no secret set the route does nothing, so a deployment
 * that never asked for the schedule cannot be started by anyone. The comparison does not leak how much of the secret was right.
 */
export function cronAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !header) return false;
  const m = /^Bearer (.+)$/.exec(header.trim());
  if (!m) return false;
  const a = createHash("sha256").update(m[1]).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

export type DailyRow = { brand_id: string; chat_id: number; daily: boolean; last_daily: string | null };

/** The chats that want the summary and have not had one for `day`, grouped by brand, at most `maxBrands` brands. */
export function dueByBrand(rows: readonly DailyRow[], day: string, maxBrands = 40): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.daily || r.last_daily === day || !Number.isSafeInteger(r.chat_id)) continue;
    if (!out.has(r.brand_id) && out.size >= maxBrands) continue;
    out.set(r.brand_id, [...(out.get(r.brand_id) ?? []), r.chat_id]);
  }
  return out;
}
