// Telegram's replies and what the hub keeps of them. No I/O: the calls to Telegram are in api.ts. Everything Telegram sends is
// treated as untrusted text: cut to size, and never put in an address.

const o = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

/** What @BotFather hands out: digits, a colon, then letters, digits, - and _. Checked before the token goes anywhere near an address. */
export const TOKEN_SHAPE = /^\d{5,15}:[A-Za-z0-9_-]{30,50}$/;
export const isToken = (v: unknown): v is string => typeof v === "string" && TOKEN_SHAPE.test(v.trim());

export const CHAT_KINDS = ["private", "group", "supergroup", "channel"] as const;
export type ChatKind = (typeof CHAT_KINDS)[number];
export const isChatKind = (v: unknown): v is ChatKind => typeof v === "string" && (CHAT_KINDS as readonly string[]).includes(v);
export const KIND_LABEL: Record<ChatKind, string> = { private: "Person", group: "Group", supergroup: "Group", channel: "Channel" };

export const MAX_LINKED = 10;
export const MAX_MESSAGE = 4000; // Telegram's limit is 4096 characters

export type Bot = { id: number; name: string; username: string };
export type Chat = { id: number; kind: ChatKind; title: string };

export function parseBot(j: unknown): Bot | null {
  const r = o(o(j).result);
  const id = Number(r.id);
  const username = text(r.username, 64);
  if (!Number.isSafeInteger(id) || !/^[A-Za-z0-9_]{3,64}$/.test(username)) return null;
  return { id, name: text(r.first_name, 64) || username, username };
}

/** A chat from Telegram, or null. The id is a whole number (negative for groups). The title is a group's name or a person's name. */
export function parseChat(raw: unknown): Chat | null {
  const c = o(raw);
  const id = Number(c.id);
  if (!Number.isSafeInteger(id) || !isChatKind(c.type)) return null;
  const person = [text(c.first_name, 60), text(c.last_name, 60)].filter(Boolean).join(" ");
  const title = text(c.title, 120) || person || (typeof c.username === "string" ? `@${text(c.username, 60)}` : "") || "Unnamed chat";
  return { id, kind: c.type, title: title.slice(0, 120) };
}

/** The chats that have written to the bot lately (a message, a post in a channel, or the bot being added to a group), newest first, once each. */
export function parseUpdates(j: unknown): Chat[] {
  const seen = new Set<number>();
  const out: Chat[] = [];
  for (const u of arr(o(j).result).reverse()) {
    const x = o(u);
    for (const raw of [o(x.message).chat, o(x.channel_post).chat, o(x.my_chat_member).chat, o(x.edited_message).chat]) {
      const chat = parseChat(raw);
      if (chat && !seen.has(chat.id)) {
        seen.add(chat.id);
        out.push(chat);
      }
    }
  }
  return out.slice(0, 20);
}

/** A message for Telegram: plain text (no formatting, so nothing in it can be read as markup), cut to fit. */
export function messageText(s: string): string {
  const t = s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\r\n?/g, "\n").trim();
  return t.length > MAX_MESSAGE ? `${t.slice(0, MAX_MESSAGE - 1)}…` : t;
}

export type Linked = { chat_id: number; kind: ChatKind; title: string; daily: boolean };
