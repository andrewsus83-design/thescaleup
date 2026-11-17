"use server";

import { accessFor } from "./access";
import { deleteWebhook, getMe, recentChats, sendMessage, setCommands, setWebhook, webhookInfo } from "./telegram/api";
import { makeLinkCode } from "./telegram/bot";
import { hookUrl, webhookSecret } from "./telegram/secret";
import { MAX_LINKED, isChatKind, type Bot, type Chat, type Linked } from "./telegram/model";
import { allow } from "./ratelimit";
import { canManageTeam } from "./rules";
import { getBrandKey } from "./secrets";
import { audit } from "./session";
import { hubTz, todayIn } from "./tasks/dates";
import { taskContext, UUID, type Ctx } from "./tasks/context";
import { loadToday } from "./today/data";
import { todayMessage } from "./today/model";

// Connecting a brand to Telegram through a bot the brand owns. The token (Settings → Telegram) is encrypted with the other keys
// and only used here, on the server. Messages out always work. "Commands" is the opt-in part that lets people write to the bot: it sets
// a webhook (so Telegram posts messages to the hub), and from then on the hub keeps its own list of the chats it has heard from, because
// Telegram stops answering "which chats wrote lately" while a webhook is set. Only the owner or founder turns that on or off.

export type Failure = { ok: false; error: string };
const NOT_READY = "Telegram needs its database step first (20261117290000_telegram_chats.sql). Ask the person who runs the database updates.";
const NOT_READY_TWO_WAY = "Commands need their database step first (20261117430000_telegram_two_way.sql). Ask the person who runs the database updates.";
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
  // `daily` comes from a later database step: until it has run, read without it and show every chat as "not every morning".
  let res = await ctx.admin.from("telegram_chats").select("chat_id, kind, title, daily").eq("brand_id", ctx.brandId).order("created_at").limit(MAX_LINKED + 5);
  if (res.error?.code === "42703") res = (await ctx.admin.from("telegram_chats").select("chat_id, kind, title").eq("brand_id", ctx.brandId).order("created_at").limit(MAX_LINKED + 5)) as unknown as typeof res;
  if (res.error) {
    console.error("[telegram] telegram_chats not ready:", res.error.message);
    return null;
  }
  return (res.data ?? []).flatMap((r) => (isChatKind(r.kind) && Number.isSafeInteger(Number(r.chat_id)) ? [{ chat_id: Number(r.chat_id), kind: r.kind, title: String(r.title ?? ""), daily: (r as { daily?: unknown }).daily === true }] : []));
}

/** True while Telegram is sending this bot's messages to the hub. */
async function commandsOn(ctx: Ctx, token: string): Promise<boolean> {
  const w = await webhookInfo(token);
  return w.ok && w.data.url === hookUrl(ctx.brandId);
}

/** The chats the bot has heard from: the hub's own list while commands are on (Telegram refuses to say while a webhook is set), Telegram's otherwise. */
async function heardChats(ctx: Ctx, token: string): Promise<{ ok: true; data: Chat[] } | Failure> {
  if (await commandsOn(ctx, token)) {
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const { data, error } = await ctx.admin.from("telegram_seen").select("chat_id, kind, title").eq("brand_id", ctx.brandId).gte("seen_at", since).order("seen_at", { ascending: false }).limit(20);
    if (error) return { ok: false, error: NOT_READY_TWO_WAY };
    return { ok: true, data: (data ?? []).flatMap((r) => (isChatKind(r.kind) && Number.isSafeInteger(Number(r.chat_id)) ? [{ id: Number(r.chat_id), kind: r.kind, title: String(r.title ?? "") }] : [])) };
  }
  return recentChats(token);
}

/** Asks Telegram who the bot is (proves the token works) and lists the chats already linked. */
export type Person = { userId: string; email: string };
export type Commands = { on: boolean; problem: string };

export async function checkTelegram(brandId: string): Promise<{ ok: true; bot: Bot; linked: Linked[]; commands: Commands; people: Person[] } | Failure> {
  const c = await context(brandId);
  if (!c.ok) return c;
  const [me, linked, hook, people] = await Promise.all([getMe(c.token), linkedChats(c.ctx), webhookInfo(c.token), linkedPeople(c.ctx)]);
  if (!me.ok) return me;
  if (!linked) return { ok: false, error: NOT_READY };
  const on = hook.ok && hook.data.url === hookUrl(c.ctx.brandId);
  const elsewhere = hook.ok && hook.data.url && !on ? "Another address is already set as this bot's listener. Turning commands on replaces it." : "";
  return { ok: true, bot: me.data, linked, commands: { on, problem: on && hook.ok ? hook.data.lastError : elsewhere }, people };
}

/** The people who linked their Telegram, with the email they sign in with. Empty until the database step has run. */
async function linkedPeople(ctx: Ctx): Promise<Person[]> {
  const { data, error } = await ctx.admin.from("telegram_links").select("user_id").eq("brand_id", ctx.brandId).order("created_at").limit(100);
  if (error) return [];
  return Promise.all((data ?? []).map(async (r) => ({ userId: String(r.user_id), email: (await ctx.admin.auth.admin.getUserById(String(r.user_id))).data.user?.email ?? "unknown" })));
}

/** Turns commands on: Telegram starts posting this bot's messages to the hub, and the bot gets its "/" menu. */
export async function enableTelegramCommands(brandId: string): Promise<{ ok: true; commands: Commands } | Failure> {
  const c = await context(brandId);
  if (!c.ok) return c;
  const secret = webhookSecret(c.ctx.brandId);
  if (!secret) return { ok: false, error: "Commands need the workspace encryption key (SECRETS_KEY_1) on the server first." };
  const probe = await c.ctx.admin.from("telegram_links").select("user_id", { head: true, count: "exact" }).eq("brand_id", c.ctx.brandId);
  if (probe.error) return { ok: false, error: NOT_READY_TWO_WAY };
  const set = await setWebhook(c.token, hookUrl(c.ctx.brandId), secret);
  if (!set.ok) return set;
  await setCommands(c.token, [
    { command: "today", description: "Your tasks due today or late" },
    { command: "tasks", description: "Your open tasks" },
    { command: "add", description: "Add a task for yourself" },
    { command: "remind", description: "Add a task with a day" },
    { command: "done", description: "Mark a task done" },
    { command: "help", description: "What I can do" },
  ]);
  await audit({ actor: c.ctx.user, brandId: c.ctx.brandId, action: "telegram.commands.on" });
  return { ok: true, commands: { on: true, problem: "" } };
}

export async function disableTelegramCommands(brandId: string): Promise<{ ok: true; commands: Commands } | Failure> {
  const c = await context(brandId);
  if (!c.ok) return c;
  const off = await deleteWebhook(c.token);
  if (!off.ok) return off;
  await audit({ actor: c.ctx.user, brandId: c.ctx.brandId, action: "telegram.commands.off" });
  return { ok: true, commands: { on: false, problem: "" } };
}

/** Takes a person's Telegram off the brand (they can link it again with a new code). */
export async function unlinkTelegramPerson(brandId: string, userId: string): Promise<{ ok: true; people: Person[] } | Failure> {
  const c = await context(brandId);
  if (!c.ok) return c;
  if (!UUID.test(userId)) return { ok: false, error: "That person is not valid." };
  const { error } = await c.ctx.admin.from("telegram_links").delete().eq("brand_id", c.ctx.brandId).eq("user_id", userId);
  if (error) return { ok: false, error: "Could not remove them. Try again." };
  await audit({ actor: c.ctx.user, brandId: c.ctx.brandId, action: "telegram.unlink.person", target: userId });
  return { ok: true, people: await linkedPeople(c.ctx) };
}

/**
 * For anyone on the team (not only the founder): a one-time code that links their own Telegram to their own login. The bot token never
 * leaves the server; the person only gets the bot's public name and the code.
 */
export async function myTelegramCode(brandId: string): Promise<{ ok: true; code: string; minutes: number; bot: string } | Failure> {
  const c = await taskContext(brandId, "tasks");
  if (!c.ok) return c;
  const { ctx } = c;
  if (!allow(`telegram-code:${ctx.user.id}`, 10)) return { ok: false, error: "That is a lot of codes. Try again later." };
  const token = await getBrandKey(ctx.brandId, "telegram", false);
  if (!token) return { ok: false, error: "Telegram is not connected for this brand yet. Ask the founder." };
  const [me, on] = await Promise.all([getMe(token), commandsOn(ctx, token)]);
  if (!me.ok) return me;
  if (!on) return { ok: false, error: "The founder has not turned on Telegram commands yet." };
  const made = await makeLinkCode(ctx.brandId, ctx.user.id);
  if (!made) return { ok: false, error: NOT_READY_TWO_WAY };
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "telegram.link.code" });
  return { ok: true, code: made.code, minutes: made.minutes, bot: me.data.username };
}

/** Unlinks the signed-in person's own Telegram. */
export async function unlinkMyTelegram(brandId: string): Promise<{ ok: true } | Failure> {
  const c = await taskContext(brandId, "tasks");
  if (!c.ok) return c;
  const { error } = await c.ctx.admin.from("telegram_links").delete().eq("brand_id", c.ctx.brandId).eq("user_id", c.ctx.user.id);
  if (error) return { ok: false, error: "Could not unlink. Try again." };
  await audit({ actor: c.ctx.user, brandId: c.ctx.brandId, action: "telegram.unlink.self", target: c.ctx.user.id });
  return { ok: true };
}

/** The chats that have written to the bot lately and are not linked yet. */
export async function findTelegramChats(brandId: string): Promise<{ ok: true; chats: Chat[] } | Failure> {
  const c = await context(brandId);
  if (!c.ok) return c;
  const [found, linked] = await Promise.all([heardChats(c.ctx, c.token), linkedChats(c.ctx)]);
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
  const [found, before] = await Promise.all([heardChats(ctx, token), linkedChats(ctx)]);
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

/** Turns the morning summary on or off for one linked chat. It is sent once a day, and only when there is something in the day. */
export async function setTelegramDaily(brandId: string, chatId: number, on: boolean): Promise<{ ok: true; linked: Linked[] } | Failure> {
  const c = await context(brandId);
  if (!c.ok) return c;
  const { ctx } = c;
  if (!Number.isSafeInteger(chatId)) return { ok: false, error: "That chat is not valid." };
  const { data, error } = await ctx.admin.from("telegram_chats").update({ daily: on === true, last_daily: null }).eq("brand_id", ctx.brandId).eq("chat_id", chatId).select("chat_id");
  if (error) {
    console.error("[telegram] daily failed:", error.message);
    return { ok: false, error: error.code === "42703" ? "The morning summary needs its database step first (20261117330000_telegram_daily.sql). Ask the person who runs the database updates." : "Could not change that. Try again." };
  }
  if (!data?.length) return { ok: false, error: "That chat is not linked any more. Reload the page." };
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: on ? "telegram.daily.on" : "telegram.daily.off", target: String(chatId) });
  const linked = await linkedChats(ctx);
  return linked ? { ok: true, linked } : { ok: false, error: NOT_READY };
}
