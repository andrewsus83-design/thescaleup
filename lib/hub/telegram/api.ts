import "server-only";
import { isToken, messageText, parseBot, parseUpdates, type Bot, type Chat } from "./model";

// Telegram's Bot API. One fixed host. The token is part of Telegram's address, so it is checked for its shape first, is never
// logged, and errors say what to do without repeating the address.

const HOST = "https://api.telegram.org";
const TIMEOUT_MS = 12_000;

export type Res<T> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function explain(status: number, description: string): string {
  if (status === 401 || status === 404) return "Telegram did not accept this token. Copy it again from @BotFather (or ask it for a new one with /token) and save it.";
  if (status === 403) return "Telegram says the bot was blocked or removed there. Open the chat, start the bot again or add it back, then try again.";
  if (status === 400 && /chat not found/i.test(description)) return "Telegram cannot find that chat. Send the bot a message there first, then find the chat again.";
  if (status === 409) return "A webhook is set on this bot, so the hub cannot look for chats. Remove the webhook (or use a fresh bot made for the hub) and try again.";
  if (status === 429) return "Telegram asked us to slow down. Wait a minute and try again.";
  if (status >= 500) return "Telegram is having trouble right now. Try again in a few minutes.";
  return `Telegram refused the request (${status}).`;
}

async function call(token: string, method: string, body: Record<string, unknown> = {}): Promise<Res<unknown>> {
  if (!isToken(token)) return fail("That does not look like a Telegram bot token. It looks like 123456789:AA… and comes from @BotFather.");
  let r: Response;
  try {
    r = await fetch(`${HOST}/bot${token.trim()}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    console.error("[telegram] request failed:", method, e instanceof Error ? e.name : "error"); // never the address: it holds the token
    return fail("Could not reach Telegram. Try again.");
  }
  let j: unknown = null;
  try {
    j = await r.json();
  } catch {
    /* an error page; the status says enough */
  }
  const ok = (j as { ok?: unknown } | null)?.ok === true;
  if (!r.ok || !ok) {
    const description = typeof (j as { description?: unknown } | null)?.description === "string" ? ((j as { description: string }).description) : "";
    console.error("[telegram] status", r.status, method);
    return fail(explain(r.ok ? 400 : r.status, description));
  }
  return { ok: true, data: j };
}

export async function getMe(token: string): Promise<Res<Bot>> {
  const r = await call(token, "getMe");
  if (!r.ok) return r;
  const bot = parseBot(r.data);
  return bot ? { ok: true, data: bot } : fail("Telegram answered, but not with a bot. Check the token.");
}

/** The chats that have written to the bot recently (Telegram keeps updates for 24 hours). Does not mark anything as read. */
export async function recentChats(token: string): Promise<Res<Chat[]>> {
  const r = await call(token, "getUpdates", { limit: 100, timeout: 0, allowed_updates: ["message", "channel_post", "my_chat_member"] });
  return r.ok ? { ok: true, data: parseUpdates(r.data) } : r;
}

export async function sendMessage(token: string, chatId: number, text: string): Promise<Res<true>> {
  if (!Number.isSafeInteger(chatId)) return fail("That chat is not valid.");
  const t = messageText(text);
  if (!t) return fail("There is nothing to send.");
  const r = await call(token, "sendMessage", { chat_id: chatId, text: t, disable_web_page_preview: true });
  return r.ok ? { ok: true, data: true } : r;
}
