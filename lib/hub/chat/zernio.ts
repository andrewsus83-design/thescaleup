import "server-only";
import { getBrandKey } from "../secrets";
import { addDays, dayIn } from "../tasks/dates";
import { buildComments, buildDm, CONNECT, dayStart, flattenComments, parseConversation, parseDmMessage, parsePost, type Built, type CommentRow, type DmMessage, type Failed, type Source } from "./connect";

// Reads the brand's inbox from Zernio with the brand's own key: conversations, their messages, commented posts and their comments.
// Read only: none of these calls marks anything as read or sends anything (docs.zernio.com, Inbox). Nothing from here is stored.

const base = () => ((process.env.ZERNIO_BASE_URL ?? "").trim() || "https://zernio.com/api").replace(/\/$/, "");
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Why Connect cannot read, in terms the person can act on. */
export type Problem = { kind: "no-key" | "auth" | "addon" | "busy" | "error"; message: string };
type Got = { ok: true; json: Record<string, unknown> } | { ok: false; problem: Problem };

function problemFor(status: number, body: string): Problem {
  if (status === 401) return { kind: "auth", message: "Zernio did not accept this brand's key. Paste it again in Settings, Social media connections." };
  if (status === 403 && /inbox/i.test(body)) return { kind: "addon", message: "Zernio says the Inbox add-on is not turned on for this key. Turn it on in your Zernio account, then check again." };
  if (status === 403) return { kind: "auth", message: "Zernio did not allow this key to read the inbox." };
  if (status === 429) {
    const wait = Number(/"retryAfter(?:Seconds)?"\s*:\s*(\d+)/.exec(body)?.[1]);
    return { kind: "busy", message: `Zernio is limiting requests right now. Try again${Number.isFinite(wait) && wait > 0 ? ` in about ${wait} seconds` : " in a minute"}.` };
  }
  return { kind: "error", message: `Zernio answered with an error (${status}). Try again in a moment.` };
}

async function zget(key: string, path: string, qs: Record<string, string>, label: string): Promise<Got> {
  try {
    const res = await fetch(`${base()}${path}?${new URLSearchParams(qs)}`, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[chat-connect] zernio", label, res.status, body.slice(0, 200).replace(/\s+/g, " "));
      return { ok: false, problem: problemFor(res.status, body) };
    }
    const json = (await res.json().catch(() => null)) as unknown;
    if (!isObj(json)) return { ok: false, problem: { kind: "error", message: "Zernio sent an answer that could not be read. Try again." } };
    return { ok: true, json };
  } catch (e) {
    console.error("[chat-connect] zernio call failed:", label, e instanceof Error ? e.message : e);
    return { ok: false, problem: { kind: "error", message: "Could not reach Zernio. Try again in a moment." } };
  }
}

const noKey: Problem = { kind: "no-key", message: "This brand has no Zernio key yet. Add it in Settings, Social media connections." };
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strOf = (v: unknown) => (typeof v === "string" && v ? v : "");

export type Loaded = { sources: Source[]; failed: Failed[]; more: boolean; commentsNote: string };

const DM_PAGES = 25; // 2,500 conversations
const POST_PAGES = 6;
const BUDGET_MS = 40_000;

/** Every conversation (and, if asked, every recent post that has comments) Zernio holds for this brand. No AI is used here. */
export async function loadSources(brandId: string, from: string, withComments: boolean, tz: string): Promise<{ ok: true; loaded: Loaded } | { ok: false; problem: Problem }> {
  const key = await getBrandKey(brandId, "zernio", false);
  if (!key) return { ok: false, problem: noKey };
  const started = Date.now();
  const seen = new Set<string>();
  const sources: Source[] = [];
  const failed = new Map<string, Failed>();
  let more = false;

  let cursor = "";
  for (let page = 0; page < DM_PAGES; page++) {
    if (Date.now() - started > BUDGET_MS) {
      more = true;
      break;
    }
    const r = await zget(key, "/v1/inbox/conversations", { limit: "100", ...(cursor ? { cursor } : {}) }, "conversations");
    if (!r.ok) {
      if (page === 0) return { ok: false, problem: r.problem };
      more = true;
      break;
    }
    for (const raw of asList(r.json.data)) {
      const s = parseConversation(raw);
      if (s && !seen.has(`dm:${s.accountId}:${s.id}`)) {
        seen.add(`dm:${s.accountId}:${s.id}`);
        sources.push(s);
      }
    }
    const meta = isObj(r.json.meta) ? r.json.meta : {};
    for (const f of asList(meta.failedAccounts)) {
      if (!isObj(f)) continue;
      const accountId = strOf(f.accountId);
      if (accountId) failed.set(accountId, { accountId, account: strOf(f.accountUsername), platform: strOf(f.platform), error: strOf(f.error), code: strOf(f.code) });
    }
    const pg = isObj(r.json.pagination) ? r.json.pagination : {};
    cursor = strOf(pg.nextCursor);
    if (pg.hasMore !== true || !cursor) break;
    if (page === DM_PAGES - 1) more = true;
  }

  let commentsNote = "";
  if (withComments) {
    const oldest = addDays(from, -CONNECT.postLookbackDays);
    let c = "";
    for (let page = 0; page < POST_PAGES; page++) {
      if (Date.now() - started > BUDGET_MS) {
        commentsNote = "Stopped early to stay within the time limit. Some older posts were not checked.";
        break;
      }
      const r = await zget(key, "/v1/inbox/comments", { limit: "50", view: "summary", ...(c ? { cursor: c } : {}) }, "commented-posts");
      if (!r.ok) {
        commentsNote = r.problem.message;
        break;
      }
      let reachedOld = false;
      for (const raw of asList(r.json.data)) {
        const s = parsePost(raw);
        if (s) {
          if (dayIn(tz, s.at) < oldest) reachedOld = true;
          else if (!seen.has(`c:${s.accountId}:${s.id}`)) {
            seen.add(`c:${s.accountId}:${s.id}`);
            sources.push(s);
          }
        } else if (isObj(raw) && typeof raw.createdTime === "string" && dayIn(tz, raw.createdTime) < oldest) reachedOld = true;
      }
      const pg = isObj(r.json.pagination) ? r.json.pagination : {};
      c = strOf(pg.nextCursor);
      if (reachedOld || pg.hasMore !== true || !c) break;
    }
  }
  return { ok: true, loaded: { sources, failed: [...failed.values()], more, commentsNote } };
}

const MSG_PAGES = 30; // 3,000 messages
const COMMENT_PAGES = 10;
const READ_BUDGET_MS = 25_000;

/** One source cut to the chosen dates. `built` is null when fewer than two messages fall inside them. */
export async function readSource(brandId: string, src: Source, from: string, to: string, tz: string): Promise<{ ok: true; built: Built | null } | { ok: false; problem: Problem }> {
  const key = await getBrandKey(brandId, "zernio", false);
  if (!key) return { ok: false, problem: noKey };
  const started = Date.now();

  if (src.kind === "dm") {
    const msgs: DmMessage[] = [];
    const fromMin = dayStart(from);
    let cursor = "";
    for (let page = 0; page < MSG_PAGES; page++) {
      const r = await zget(key, `/v1/inbox/conversations/${encodeURIComponent(src.id)}/messages`, { accountId: src.accountId, limit: "100", sortOrder: "desc", ...(cursor ? { cursor } : {}) }, "messages");
      if (!r.ok) return { ok: false, problem: r.problem };
      let reachedOld = false;
      for (const raw of asList(r.json.messages)) {
        const m = parseDmMessage(raw);
        if (!m) continue;
        msgs.push(m);
        const t = new Date(m.at).getTime() / 60_000;
        // The page is newest first, so once a message is clearly before the start (a day of slack for the timezone), older pages add nothing.
        if (t < fromMin - 1440) reachedOld = true;
      }
      const pg = isObj(r.json.pagination) ? r.json.pagination : {};
      cursor = strOf(pg.nextCursor);
      const newestFirst = r.json.sortOrderApplied !== "asc";
      if (pg.hasMore !== true || !cursor || (newestFirst && reachedOld) || Date.now() - started > READ_BUDGET_MS) break;
    }
    return { ok: true, built: buildDm(src, msgs, from, to, tz) };
  }

  const rows: CommentRow[] = [];
  let cursor = "";
  const raws: unknown[] = [];
  for (let page = 0; page < COMMENT_PAGES; page++) {
    const r = await zget(key, `/v1/inbox/comments/${encodeURIComponent(src.id)}`, { accountId: src.accountId, limit: "100", ...(cursor ? { cursor } : {}) }, "comments");
    if (!r.ok) return { ok: false, problem: r.problem };
    raws.push(...asList(r.json.comments));
    const pg = isObj(r.json.pagination) ? r.json.pagination : {};
    cursor = strOf(pg.cursor);
    if (pg.hasMore !== true || !cursor || Date.now() - started > READ_BUDGET_MS) break;
  }
  rows.push(...flattenComments(raws));
  return { ok: true, built: buildComments(src, rows, from, to, tz) };
}
