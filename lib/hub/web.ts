import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import type { Readable } from "node:stream";
import { checkUrl, isPrivateIp } from "./wiki/net";

// Reads one public web page for the Wiki builder. The address comes from a person, so: only public http(s) sites; every address a
// name resolves to is checked at the moment of connecting (a name that points inside our network is refused, and a name that
// changes its answer between a check and the connection cannot slip through); redirects are followed by hand and checked each
// time; the page is cut at a size limit; and it only ever returns text.

export type Fetched = { ok: true; finalUrl: string; contentType: string; body: string } | { ok: false; error: string };

type Lookup = (hostname: string, options: dns.LookupOptions, cb: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void) => void;

/** DNS lookup that refuses any answer pointing at a non-public address. */
const publicLookup: Lookup = (hostname, options, cb) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return cb(err, "", 4);
    const list = addresses as dns.LookupAddress[];
    if (!list.length || list.some((a) => isPrivateIp(a.address))) return cb(Object.assign(new Error("blocked address"), { code: "EBLOCKED" }) as NodeJS.ErrnoException, "", 4);
    if (options.all) return cb(null, list);
    cb(null, list[0].address, list[0].family);
  });
};

const TEXT_TYPE = /^(text\/|application\/xhtml\+xml)/i;
const MAX_REDIRECTS = 4;

function once(url: URL, timeoutMs: number, maxBytes: number): Promise<{ status: number; location: string | null; contentType: string; body: string }> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(
      url,
      {
        method: "GET",
        lookup: publicLookup as never,
        timeout: timeoutMs,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ScaleupBot/1.0; +https://thescaleup.xyz)", Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1", "Accept-Language": "id,en;q=0.8", "Accept-Encoding": "gzip, deflate, br" },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        const contentType = String(res.headers["content-type"] ?? "");
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location, contentType, body: "" });
        }
        if (status < 200 || status >= 300 || !TEXT_TYPE.test(contentType)) {
          res.resume();
          return resolve({ status: status >= 200 && status < 300 ? 415 : status, location: null, contentType, body: "" });
        }
        let stream: Readable = res;
        const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
        if (enc === "gzip" || enc === "x-gzip") stream = res.pipe(zlib.createGunzip());
        else if (enc === "deflate") stream = res.pipe(zlib.createInflate());
        else if (enc === "br") stream = res.pipe(zlib.createBrotliDecompress());
        else if (enc && enc !== "identity") {
          res.resume();
          return resolve({ status: 415, location: null, contentType, body: "" });
        }
        const chunks: Buffer[] = [];
        let size = 0;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          const charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ?? "utf-8";
          let text: string;
          try {
            text = new TextDecoder(charset, { fatal: false }).decode(Buffer.concat(chunks));
          } catch {
            text = new TextDecoder("utf-8").decode(Buffer.concat(chunks));
          }
          resolve({ status, location: null, contentType, body: text });
        };
        stream.on("data", (c: Buffer) => {
          size += c.length;
          chunks.push(size > maxBytes ? c.subarray(0, c.length - (size - maxBytes)) : c);
          if (size >= maxBytes) {
            res.destroy();
            stream.destroy();
            finish();
          }
        });
        stream.on("end", finish);
        stream.on("error", () => (chunks.length ? finish() : reject(new Error("read failed"))));
        res.on("error", () => (chunks.length ? finish() : reject(new Error("read failed"))));
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

/** Reads a public page as text. Failures come back as a short reason the person can act on, never as an exception. */
export async function fetchText(raw: string, opts: { timeoutMs?: number; maxBytes?: number } = {}): Promise<Fetched> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxBytes = opts.maxBytes ?? 1_500_000;
  let target = checkUrl(raw);
  if (!target.ok) return target;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const r = await once(target.url, timeoutMs, maxBytes);
      if (r.status >= 300 && r.status < 400 && r.location) {
        const next = checkUrl(new URL(r.location, target.url).toString());
        if (!next.ok) return { ok: false, error: "It sends visitors somewhere that cannot be read." };
        target = next;
        continue;
      }
      if (r.status === 401 || r.status === 403 || r.status === 429 || r.status === 999) return { ok: false, error: "The site refuses automatic reading (often a login wall or bot protection)." };
      if (r.status === 404 || r.status === 410) return { ok: false, error: "The page was not found." };
      if (r.status === 415) return { ok: false, error: "That is not a web page." };
      if (r.status < 200 || r.status >= 300) return { ok: false, error: `The site answered with an error (${r.status}).` };
      return { ok: true, finalUrl: target.url.toString(), contentType: r.contentType, body: r.body };
    }
    return { ok: false, error: "It redirects too many times." };
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "EBLOCKED") return { ok: false, error: "That address is not a public website." };
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") return { ok: false, error: "That website was not found. Check the address." };
    if ((e as Error).message === "timeout" || code === "ETIMEDOUT" || code === "ECONNRESET") return { ok: false, error: "The site did not answer in time." };
    return { ok: false, error: "The site could not be reached." };
  }
}
