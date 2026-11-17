// Turns the files a person chose into conversations, in the browser, before anything is sent: a WhatsApp .txt, a Telegram or Meta
// .json, a comments .csv, or a .zip holding any of them (an iPhone WhatsApp export, Meta's data download).

import { joinThreads, parseMeta, parseSocialCsv, parseTelegram, parseWhatsApp, LIMITS, type Convo } from "./model";
import { listZip, readZipText } from "./zip";

const MAX_TEXT = 40_000_000;
const base = (n: string) => n.split("/").pop() ?? n;
const stem = (n: string) => base(n).replace(/\.[^.]+$/, "");
const dir = (n: string) => n.split("/").slice(0, -1).join("/");

type Blob_ = { name: string; text: string; folder: string };

/** Reads the files. `skipped` says, in plain words, what could not be used. */
export async function readInputs(files: readonly File[]): Promise<{ convos: Convo[]; skipped: string[] }> {
  const blobs: Blob_[] = [];
  const skipped: string[] = [];
  for (const f of files) {
    try {
      if (/\.zip$/i.test(f.name)) {
        const entries = (await listZip(f)).filter((e) => /\.(txt|json|csv)$/i.test(e.name) && !/(^|\/)(__MACOSX|\.)/.test(e.name) && e.size > 0 && e.size <= MAX_TEXT);
        // Meta's export holds many .json files that are not chats (profile, posts); only message_N.json files are threads.
        const useful = entries.filter((e) => !/\.json$/i.test(e.name) || /(^|\/)message_\d+\.json$/i.test(e.name) || /(^|\/)result\.json$/i.test(e.name));
        for (const e of useful.slice(0, 400)) blobs.push({ name: e.name, text: await readZipText(f, e), folder: dir(e.name) || stem(f.name) });
        if (!useful.length) skipped.push(`${f.name}: no chat files found inside.`);
      } else if (f.size > MAX_TEXT) skipped.push(`${f.name}: too big. Export a shorter period.`);
      else blobs.push({ name: f.name, text: await f.text(), folder: "" });
    } catch (e) {
      skipped.push(`${f.name}: ${e instanceof Error ? e.message : "could not be read."}`);
    }
  }

  const convos: Convo[] = [];
  const meta = new Map<string, Convo[]>();
  for (const b of blobs) {
    const n = b.name.toLowerCase();
    if (n.endsWith(".txt")) {
      const s = stem(b.name);
      const who = /chat with (.+)$/i.exec(s)?.[1] ?? /obrolan whatsapp dengan (.+)$/i.exec(s)?.[1] ?? (s.toLowerCase() === "_chat" || s.toLowerCase() === "chat" ? b.folder || "WhatsApp chat" : s);
      const c = parseWhatsApp(b.text, who);
      if (c) convos.push(c);
      else skipped.push(`${base(b.name)}: not a WhatsApp chat export.`);
    } else if (n.endsWith(".json")) {
      let j: unknown;
      try {
        j = JSON.parse(b.text);
      } catch {
        skipped.push(`${base(b.name)}: not valid JSON.`);
        continue;
      }
      const tg = parseTelegram(j);
      if (tg.length) {
        convos.push(...tg);
        continue;
      }
      const channel = /facebook|messenger/i.test(`${b.folder} ${b.name}`) ? "Facebook Messenger" : "Instagram DMs";
      const m = parseMeta(j, channel);
      if (m) {
        const key = b.folder || m.name;
        meta.set(key, [...(meta.get(key) ?? []), m]);
      } else if ((j as { messages?: unknown[] } | null)?.messages?.length === 1) skipped.push(`${base(b.name)}: only one message, nothing to audit.`);
      else skipped.push(`${base(b.name)}: not a Telegram or Instagram/Facebook chat export.`);
    } else if (n.endsWith(".csv")) {
      const cs = parseSocialCsv(b.text, stem(b.name));
      if (cs.length) convos.push(...cs);
      else skipped.push(`${base(b.name)}: needs a date, an author and a text column, with at least two comments.`);
    }
  }
  // A Meta thread can be split over message_1.json, message_2.json ...: join them. Older files hold older messages.
  for (const parts of meta.values()) {
    const one = joinThreads(parts);
    if (one) convos.push(one);
  }
  return { convos: convos.slice(0, LIMITS.conversations), skipped };
}
