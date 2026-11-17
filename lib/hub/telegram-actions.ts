"use server";

import { accessFor } from "./access";
import { getMe, recentChats, sendMessage } from "./telegram/api";
import { MAX_LINKED, isChatKind, type Bot, type Chat, type Linked } from "./telegram/model";
import { allow } from "./ratelimit";
import { canManageTeam } from "./rules";
import { getBrandKey } from "./secrets";
import { audit } from "./session";
import { hubTz, todayIn } from "./tasks/dates";
import { taskContext, type Ctx } from "./tasks/context";
import { loadToday } from "./today/data";
import { todayMessage } from "./today/model";

// Connecting a brand to Telegram through a bot the brand owns. The token (Settings → Telegram) is encrypted with the other keys
// and only used here, on the server. The hub never sets a webhook: to find a chat it asks Telegram which chats have written to
// the bot lately, and the person picks which of them to link. Only the owner or founder can do any of this.

export type Failure = { ok: false; error: string };
const NOT_READY = "Telegram needs its database step first (20261117290000_telegram_chats.sql). Ask the person who runs the database updates.";
const NO_TOKEN = "Save the Telegram bot token first (above), then try again.";

async function context(brandId: unknown): Promise<{ ok: true; ctx: Ctx; token: string } | Failure> {
  const c = await taskContext(brandId, "brand");
  if (!c.ok) return c;
  if (!canManageTeam(c.ctx.actor)) return { ok: false, error: "Only the owner or founder can change the Telegram connection." };
  if (!allow(`telegram:${c.ctx.user.id}`, 120)) return { ok: false, error: "That is a lot of Telegram requests in an hour. Try again later." };
  const token = await getBrandKey(c.ctx.brandId, "telegram", false);
  if (!token) return { ok: false, error: NO_TOKEN };
  return { ok: true, ctx: c.ctx, token };
}

async function linkedChats(ctx: Ctx): Promise<Linked[] | null> {
  const { data, error } = await ctx.admin.from("telegram_chats").select("chat_id, kind, title").eq("brand_id", ctx.brandId).order("created_at").limit(MAX_LINKED + 5);
  if (error) {
    console.error("[telegram] telegram_chats not ready:", error.message);
    return null;
  }
  return (data ?? []).flatMap((r) => (isChatKind(r.kind) && Number.isSafeInteger(Number(r.chat_id)) ? [{ chat_id: Number(r.chat_id), kind: r.kind, title: String(r.title ?? "") }] : []));
}

/** Asks Telegram who the bot is (proves the token works) and lists the chats already linked. */
export async function checkTelegram(brandId: string): Promise<{ ok: true; bot: Bot; linked: Linked[] } | Failure> {
  const c = await context(brandId);
  if (!c.ok) return c;
  const [me, linked] = await Promise.all([getMe(c.token), linkedChats(c.ctx)]);
  if (!me.ok) return me;
  if (!linked) return { ok: false, error: NOT_READY };
  return { ok: true, bot: me.data, linked };
}

/** The chats that have written to the bot lately and are not linked yet. */
export async function findTelegramChats(brandId: string): Promise<{ ok: true; chats: Chat[] } | Failure> {
  const c = await context(brandId);
  if (!c.ok) return c;
  const [found, linked] = await Promise.all([recentChats(c.token), linkedChats(c.ctx)]);
  if (!found.ok) return found;
  if (!linked) return { ok: false, error: NOT_READY };
  const have = new Set(linked.map((l) => l.chat_id));
  return { ok: true, chats: found.data.filter((ch) => !have.has(ch.id)) };
}

/** Links a chat the bot has actually heard from (checked again here, not taken from the browser) and says hello in it. */
export async function linkTelegramChat(brandId: string, chatId: number): Promise<{ ok: true; linked: Linked[] } | Failure> {
  const c = await context(brandId);
  if (!c.ok) return c;
  const { ctx, token } = c;
  if (!Number.isSafeInteger(chatId)) return { ok: false, error: "That chat is not valid." };
  const [found, before] = await Promise.all([recentChats(token), linkedChats(ctx)]);
  if (!found.ok) return found;
  if (!before) return { ok: false, error: NOT_READY };
  const chat = found.data.find((x) => x.id === chatId);
  if (!chat) return { ok: false, error: "The bot has not heard from that chat lately. Send the bot a message there, then find the chats again." };
  if (!before.some((l) => l.chat_id === chatId) && before.length >= MAX_LINKED) return { ok: false, error: `You can link up to ${MAX_LINKED} chats. Remove one first.` };

  const { error } = await ctx.admin.from("telegram_chats").upsert({ brand_id: ctx.brandId, chat_id: chat.id, kind: chat.kind, title: chat.title, linked_by: ctx.user.id }, { onConflict: "brand_id,chat_id" });
  if (error) {
    console.error("[telegram] link failed:", error.message);
    return { ok: false, error: "Could not link the chat. Try again." };
  }
  const { data: brand } = await ctx.admin.from("brands").select("name").eq("id", ctx.brandId).maybeSingle();
  await sendMessage(token, chat.id, `Connected. This chat will get messages from ${brand?.name ?? "the hub"} on thescaleup.`); // best effort: the link is already saved
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "telegram.link", target: chat.title.slice(0, 80), meta: { kind: chat.kind } });
  const after = await linkedChats(ctx);
  return { ok: true, linked: after ?? [] };
}

export async function unlinkTelegramChat(brandId: string, chatId: number): Promise<{ ok: true; linked: Linked[] } | Failure> {
  const c = await context(brandId);
  if (!c.ok) return c;
  if (!Number.isSafeInteger(chatId)) return { ok: false, error: "That chat is not valid." };
  const { error } = await c.ctx.admin.from("telegram_chats").delete().eq("brand_id", c.ctx.brandId).eq("chat_id", chatId);
  if (error) return { ok: false, error: "Could not remove the chat. Try again." };
  await audit({ actor: c.ctx.user, brandId: c.ctx.brandId, action: "telegram.unlink", target: String(chatId) });
  return { ok: true, linked: (await linkedChats(c.ctx)) ?? [] };
}

/** Sends a test message to one linked chat. */
export async function testTelegramChat(brandId: string, chatId: number): Promise<{ ok: true } | Failure> {
  const c = await context(brandId);
  if (!c.ok) return c;
  const linked = await linkedChats(c.ctx);
  if (!linked) return { ok: false, error: NOT_READY };
  if (!linked.some((l) => l.chat_id === chatId)) return { ok: false, error: "That chat is not linked." };
  const sent = await sendMessage(c.token, chatId, "Test message from the hub. If you can read this, Telegram is connected.");
  return sent.ok ? { ok: true } : sent;
}

/** Sends the team's day (late and due tasks, content planned today, CRM follow-up count, unread mail) to every linked chat. */
export async function sendTodayToTelegram(brandId: string): Promise<{ ok: true; sent: number; failed: number } | Failure> {
  const c = await context(brandId);
  if (!c.ok) return c;
  const { ctx, token } = c;
  if (!allow(`telegram-today:${ctx.user.id}`, 10)) return { ok: false, error: "That is a lot of summaries in an hour. Try again later." };
  const linked = await linkedChats(ctx);
  if (!linked) return { ok: false, error: NOT_READY };
  if (!linked.length) return { ok: false, error: "Link a chat first, then send the summary." };
  const [access, brand] = await Promise.all([accessFor(ctx.brandId, ctx.actor), ctx.admin.from("brands").select("name").eq("id", ctx.brandId).maybeSingle()]);
  const day = todayIn(hubTz());
  const today = await loadToday({ brandId: ctx.brandId, actor: ctx.actor, userId: ctx.user.id, access, day, scope: "team" });
  const text = todayMessage(brand.data?.name ?? "The hub", today);
  let sent = 0;
  for (const l of linked) {
    const r = await sendMessage(token, l.chat_id, text);
    if (r.ok) sent++;
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "telegram.today", target: day, meta: { chats: linked.length, sent } });
  if (sent === 0) return { ok: false, error: "Telegram would not take the message in any chat. Use Send a test to see why." };
  return { ok: true, sent, failed: linked.length - sent };
}
