import "server-only";
import type { Fetched, Incoming } from "../payments/model";
import { MAX_PAGES, pageQuery, parsePage, XENDIT_BASE } from "./model";

// Reads a brand's payments from Xendit with the brand's own key. Read only: the single call made is "list transactions".
// The host is fixed, redirects are refused, and nothing here logs an address, a key or what Xendit sent back.

/** Xendit takes the key as the user name of Basic auth, with an empty password. */
export const basicAuth = (key: string) => `Basic ${Buffer.from(`${key}:`).toString("base64")}`;

/**
 * Successful payments created between `since` and `until`, newest first, up to MAX_PAGES pages. `finished` is false when the page
 * limit stopped it: the caller then carries on from `oldest` next time. A failure part-way still returns what was read before it.
 */
export async function listPayments(key: string, since: string, until: string, tz: string): Promise<Fetched> {
  const payments: Incoming[] = [];
  let seen = 0;
  let after: string | null = null;
  let oldest: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    let res: Response;
    try {
      res = await fetch(`${XENDIT_BASE}${pageQuery(since, until, after)}`, {
        headers: { Authorization: basicAuth(key), Accept: "application/json" },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (e) {
      console.error("[xendit] list failed:", e instanceof Error ? e.name : "error");
      return { ok: false, reason: "unreachable", payments, oldest };
    }
    if (!res.ok) {
      void res.body?.cancel().catch(() => undefined);
      const reason = res.status === 401 ? "key" : res.status === 403 ? "permission" : res.status === 429 ? "busy" : res.status >= 500 ? "unreachable" : "shape";
      if (reason === "shape") console.error("[xendit] list answered", res.status);
      return { ok: false, reason, payments, oldest };
    }
    const parsed = parsePage(await res.json().catch(() => null), tz);
    if (!parsed) return { ok: false, reason: "shape", payments, oldest };
    payments.push(...parsed.payments);
    seen += parsed.seen;
    if (parsed.oldest && (oldest === null || parsed.oldest < oldest)) oldest = parsed.oldest;
    if (!parsed.hasMore) return { ok: true, payments, seen, finished: true, oldest };
    // More pages are promised but there is no id to ask for the next one with: stop as a failure, so the read is not taken as complete.
    if (!parsed.lastId) return { ok: false, reason: "shape", payments, oldest };
    after = parsed.lastId;
  }
  return { ok: true, payments, seen, finished: false, oldest };
}
