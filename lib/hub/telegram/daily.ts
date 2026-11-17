import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBrandKey } from "../secrets";
import { hubTz, todayIn } from "../tasks/dates";
import { loadToday } from "../today/data";
import { isEmpty, todayMessage } from "../today/model";
import { sendMessage } from "./api";
import { dueByBrand, type DailyRow } from "./daily-model";

export type DailyResult = { day: string; brands: number; chats: number; sent: number; failed: number; empty: number; noToken: number };

/**
 * Sends each opted-in chat its brand's day (late and due tasks, content planned, how many CRM follow-ups, unread mail), once per day.
 * A day with nothing in it is not sent, so the chat is not trained to ignore it. Nothing here throws: a brand that fails is logged and skipped.
 */
export async function sendDailyDigests(): Promise<DailyResult> {
  const day = todayIn(hubTz());
  const admin = createSupabaseAdminClient();
  const result: DailyResult = { day, brands: 0, chats: 0, sent: 0, failed: 0, empty: 0, noToken: 0 };
  const { data, error } = await admin.from("telegram_chats").select("brand_id, chat_id, daily, last_daily").eq("daily", true).limit(1000);
  if (error) {
    console.error("[telegram-daily] could not read chats:", error.message);
    return result;
  }
  const rows: DailyRow[] = (data ?? []).map((r) => ({ brand_id: String(r.brand_id), chat_id: Number(r.chat_id), daily: r.daily === true, last_daily: r.last_daily ? String(r.last_daily) : null }));
  for (const [brandId, chatIds] of dueByBrand(rows, day)) {
    try {
      const [{ data: brand }, token] = await Promise.all([admin.from("brands").select("name, status").eq("id", brandId).maybeSingle(), getBrandKey(brandId, "telegram", false)]);
      if (!brand || brand.status === "archived") continue;
      result.brands++;
      result.chats += chatIds.length;
      if (!token) {
        result.noToken += chatIds.length;
        continue;
      }
      const today = await loadToday({ brandId, actor: "founder", userId: "", access: { tasks: "view", crm: "view", content: "view", mail: "view" }, day, scope: "team" });
      const done: number[] = [];
      if (isEmpty(today)) {
        result.empty += chatIds.length;
        done.push(...chatIds);
      } else {
        const text = todayMessage(String(brand.name ?? "The hub"), today);
        for (const chatId of chatIds) {
          const r = await sendMessage(token, chatId, text);
          if (r.ok) {
            result.sent++;
            done.push(chatId);
          } else result.failed++;
        }
      }
      if (done.length) await admin.from("telegram_chats").update({ last_daily: day }).eq("brand_id", brandId).in("chat_id", done);
    } catch (e) {
      console.error("[telegram-daily] brand failed:", brandId, e instanceof Error ? e.message : e);
      result.failed += chatIds.length;
    }
  }
  return result;
}
