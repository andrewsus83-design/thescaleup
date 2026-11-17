"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Btn, Chip } from "@/components/brand/primitives";
import { checkTelegram, findTelegramChats, linkTelegramChat, sendTodayToTelegram, setTelegramDaily, testTelegramChat, unlinkTelegramChat } from "@/lib/hub/telegram-actions";
import { KIND_LABEL, MAX_LINKED, type Bot, type Chat, type Linked } from "@/lib/hub/telegram/model";

/** Checks the bot, links the chats that should receive the hub's messages, and sends a test. */
export function TelegramPanel({ brandId, hasToken }: { brandId: string; hasToken: boolean }) {
  const [bot, setBot] = useState<Bot | null>(null);
  const [linked, setLinked] = useState<Linked[]>([]);
  const [found, setFound] = useState<Chat[] | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function run<T extends { ok: boolean }>(label: string, f: () => Promise<T | { ok: false; error: string }>, then: (r: T) => void) {
    setBusy(label);
    setError("");
    setNote("");
    const r = await f();
    setBusy("");
    if (!r.ok) return setError((r as { error: string }).error);
    then(r as T);
  }

  const check = () =>
    run("check", () => checkTelegram(brandId), (r) => {
      setBot(r.bot);
      setLinked(r.linked);
    });
  const find = () => run("find", () => findTelegramChats(brandId), (r) => setFound(r.chats));
  const link = (id: number) =>
    run(`link-${id}`, () => linkTelegramChat(brandId, id), (r) => {
      setLinked(r.linked);
      setFound((f) => (f ? f.filter((c) => c.id !== id) : f));
      setNote("Linked. The bot said hello in that chat.");
    });
  const daily = (id: number, on: boolean) => run(`daily-${id}`, () => setTelegramDaily(brandId, id, on), (r) => {
    setLinked(r.linked);
    setNote(on ? "This chat will get the day's summary every morning." : "The morning summary is off for this chat.");
  });
  const unlink = (id: number) => run(`unlink-${id}`, () => unlinkTelegramChat(brandId, id), (r) => setLinked(r.linked));
  const today = () =>
    run("today", () => sendTodayToTelegram(brandId), (r) => setNote(r.failed ? `Summary sent to ${r.sent} chat${r.sent === 1 ? "" : "s"}. ${r.failed} did not accept it.` : `Summary sent to ${r.sent} chat${r.sent === 1 ? "" : "s"}.`));
  const test = (id: number) => run(`test-${id}`, () => testTelegramChat(brandId, id), () => setNote("Test message sent. Check the chat in Telegram."));

  const spin = (key: string) => busy === key && <Loader2 className="size-4 animate-spin" aria-hidden />;

  return (
    <div className="space-y-6">
      {!hasToken && (
        <Alert tone="warn">
          Create a bot first: in Telegram open <strong>@BotFather</strong>, send <code className="font-mono">/newbot</code>, follow the steps, then copy the token it gives you and save it above.
        </Alert>
      )}
      {error && (
        <Alert tone="bad" role="alert">
          {error}
        </Alert>
      )}
      {note && (
        <Alert tone="ok" role="status">
          {note}
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Btn variant={bot ? "secondary" : "primary"} size="lg" onClick={check} disabled={!hasToken || busy !== ""}>
          {spin("check")}
          {bot ? "Check again" : "Check the connection"}
        </Btn>
        {bot && (
          <p className="text-body text-ink-700">
            Connected to <strong>{bot.name}</strong> (@{bot.username})
          </p>
        )}
      </div>

      {bot && (
        <>
          <section aria-labelledby="tg-linked" className="space-y-3">
            <h3 id="tg-linked" className="font-title text-h4 text-ink-800">
              Chats that get messages ({linked.length} of {MAX_LINKED})
            </h3>
            {linked.length === 0 ? (
              <p className="text-small text-ink-500">None yet. Link one below.</p>
            ) : (
              <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100">
                {linked.map((l) => (
                  <li key={l.chat_id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-body text-ink-800">{l.title || "Unnamed chat"}</span>
                    <Chip>{KIND_LABEL[l.kind]}</Chip>
                    <label className="flex min-h-11 items-center gap-2 text-small text-ink-800">
                      <input type="checkbox" checked={l.daily} disabled={busy !== ""} onChange={(e) => daily(l.chat_id, e.target.checked)} className="size-5 accent-ink-800" />
                      Every morning
                    </label>
                    <Btn size="sm" onClick={() => test(l.chat_id)} disabled={busy !== ""}>
                      {spin(`test-${l.chat_id}`)}
                      Send a test
                    </Btn>
                    <Btn size="sm" onClick={() => unlink(l.chat_id)} disabled={busy !== ""}>
                      {spin(`unlink-${l.chat_id}`)}
                      Remove
                    </Btn>
                  </li>
                ))}
              </ul>
            )}
            {linked.length > 0 && (
              <div className="space-y-2">
                <Btn onClick={today} disabled={busy !== ""}>
                  {spin("today")}
                  Send today&apos;s summary
                </Btn>
                <p className="text-caption text-ink-500">Posts what is late or due, the content planned for today, the number of CRM follow-ups and unread mail to every chat above. Customer names are never included. “Every morning” sends it for you at 08:00 Jakarta time, only on days that have something in them.</p>
              </div>
            )}
          </section>

          <section aria-labelledby="tg-find" className="space-y-3">
            <h3 id="tg-find" className="font-title text-h4 text-ink-800">
              Link a chat
            </h3>
            <ol className="list-decimal space-y-1 pl-5 text-body text-ink-700">
              <li>
                Open <strong>@{bot.username}</strong> in Telegram and send it <code className="font-mono">/start</code>. For a team group: add the bot to the group, then send <code className="font-mono">/start@{bot.username}</code> there.
              </li>
              <li>Click Find chats below, then link the one you want.</li>
            </ol>
            <Btn onClick={find} disabled={busy !== "" || linked.length >= MAX_LINKED}>
              {spin("find")}
              Find chats
            </Btn>
            {found && found.length === 0 && <p className="text-small text-ink-500">No new chats. Send the bot a message (step 1) and try again. Telegram only keeps them for 24 hours.</p>}
            {found && found.length > 0 && (
              <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100">
                {found.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-body text-ink-800">{c.title}</span>
                    <Chip>{KIND_LABEL[c.kind]}</Chip>
                    <Btn size="sm" variant="primary" onClick={() => link(c.id)} disabled={busy !== ""}>
                      {spin(`link-${c.id}`)}
                      Link
                    </Btn>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-small text-ink-500">Only link chats that should read this brand&apos;s messages. Anyone in a linked group will see them.</p>
          </section>
        </>
      )}
    </div>
  );
}
