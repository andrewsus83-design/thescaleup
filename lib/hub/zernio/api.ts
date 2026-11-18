import "server-only";
import { getKeys } from "../secrets";
import {
  NO_ACCOUNTS,
  NO_AGENCY_KEY,
  OBJECT_ID,
  parseAccounts,
  parseCreatedProfile,
  parseProfileId,
  problemFor,
  type ConnectedAccount,
  type PlatformId,
  type ScopeProblem,
} from "./model";

// The agency's ONE Zernio key, and each brand's own profile inside it. Every read for a brand goes through brandScope(), which returns
// the key together with that brand's profile id, so no read can forget to name the profile. The key never leaves the server.

const base = () => ((process.env.ZERNIO_BASE_URL ?? "").trim() || "https://zernio.com/api").replace(/\/$/, "");

type Reply = { ok: true; status: number; json: unknown } | { ok: false; status: number; json: unknown };

/** One call to Zernio. Never throws: status 0 means no answer came. Logs the tag and the status only, never an address or a key. */
async function zreq(key: string, method: "GET" | "POST" | "DELETE", path: string, opts: { qs?: Record<string, string>; body?: unknown } = {}): Promise<Reply> {
  const qs = opts.qs ? `?${new URLSearchParams(opts.qs)}` : "";
  try {
    const res = await fetch(`${base()}${path}${qs}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json", ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json().catch(() => null)) as unknown;
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    console.error("[zernio] call failed:", method, e instanceof Error ? e.name : "error");
    return { ok: false, status: 0, json: null };
  }
}

/** The agency's Zernio key (workspace scope). null when it has not been saved. */
export async function agencyKey(): Promise<string | null> {
  return (await getKeys(null, ["zernio"], false)).zernio ?? null;
}

// A found profile id is kept for a few minutes so a page does not ask Zernio who the brand is on every read. A miss is never kept.
const PROFILE_TTL_MS = 5 * 60_000;
const profileCache = new Map<string, { id: string; at: number }>();
// The accounts of a profile, kept for a minute: the inbox check asks once per conversation it reads.
const ACCOUNTS_TTL_MS = 60_000;
const accountsCache = new Map<string, { list: ConnectedAccount[]; at: number }>();

const remember = (brandId: string, id: string) => void profileCache.set(brandId, { id, at: Date.now() });
const cachedProfile = (brandId: string) => {
  const hit = profileCache.get(brandId);
  return hit && Date.now() - hit.at < PROFILE_TTL_MS ? hit.id : null;
};

type FoundProfile = { ok: true; id: string | null } | { ok: false; problem: ScopeProblem };

async function findProfile(key: string, brandId: string): Promise<FoundProfile> {
  const r = await zreq(key, "GET", "/v1/profiles", { qs: { externalId: brandId, limit: "5" } });
  if (!r.ok) return { ok: false, problem: problemFor(r.status) };
  return { ok: true, id: parseProfileId(r.json, brandId) };
}

export type Scope = { ok: true; key: string; profileId: string } | { ok: false; problem: ScopeProblem };

/** The key and the brand's profile for a read. Fails with a plain message when the agency has no key or the brand has connected nothing yet. */
export async function brandScope(brandId: string): Promise<Scope> {
  const key = await agencyKey();
  if (!key) return { ok: false, problem: { kind: "no-key", message: NO_AGENCY_KEY } };
  const hit = cachedProfile(brandId);
  if (hit) return { ok: true, key, profileId: hit };
  const found = await findProfile(key, brandId);
  if (!found.ok) return found;
  if (!found.id) return { ok: false, problem: { kind: "no-key", message: NO_ACCOUNTS } };
  remember(brandId, found.id);
  return { ok: true, key, profileId: found.id };
}

/** The brand's profile, made on the first connection. The brand's id is its externalId, so the same brand always finds the same profile. */
export async function ensureProfile(key: string, brandId: string, brandName: string): Promise<{ ok: true; id: string } | { ok: false; problem: ScopeProblem }> {
  const hit = cachedProfile(brandId);
  if (hit) return { ok: true, id: hit };
  const found = await findProfile(key, brandId);
  if (!found.ok) return found;
  if (found.id) {
    remember(brandId, found.id);
    return { ok: true, id: found.id };
  }
  const name = brandName.trim().slice(0, 80) || "Brand";
  // A second brand with the same name can be refused, so the second try adds a piece of the brand's id.
  for (const candidate of [name, `${name} (${brandId.slice(0, 8)})`]) {
    const made = await zreq(key, "POST", "/v1/profiles", { body: { name: candidate, externalId: brandId } });
    if (made.ok) {
      const id = parseCreatedProfile(made.json);
      if (!id) return { ok: false, problem: { kind: "error", message: "Zernio answered, but not in a shape this page understands. Try again in a moment." } };
      remember(brandId, id);
      return { ok: true, id };
    }
    if (made.status !== 409) return { ok: false, problem: problemFor(made.status) };
    // Someone may have made it a moment ago: look again before trying another name.
    const again = await findProfile(key, brandId);
    if (!again.ok) return again;
    if (again.id) {
      remember(brandId, again.id);
      return { ok: true, id: again.id };
    }
  }
  return { ok: false, problem: { kind: "error", message: "Zernio would not create this brand's profile. Try again." } };
}

export type Listed = { ok: true; accounts: ConnectedAccount[] } | { ok: false; problem: ScopeProblem };

/** The brand's connected social accounts. `fresh` skips the one-minute memory (the Settings page and every change use it). */
export async function listAccounts(key: string, profileId: string, fresh = false): Promise<Listed> {
  if (!OBJECT_ID.test(profileId)) return { ok: false, problem: { kind: "error", message: "That profile is not valid." } };
  const hit = accountsCache.get(profileId);
  if (!fresh && hit && Date.now() - hit.at < ACCOUNTS_TTL_MS) return { ok: true, accounts: hit.list };
  const r = await zreq(key, "GET", "/v1/accounts", { qs: { profileId, category: "social", excludeHidden: "true" } });
  if (!r.ok) return { ok: false, problem: problemFor(r.status) };
  const list = parseAccounts(r.json);
  accountsCache.set(profileId, { list, at: Date.now() });
  return { ok: true, accounts: list };
}

/** The accounts page: the brand's accounts, or an empty list when it has no profile yet. */
export async function accountsForBrand(brandId: string): Promise<{ ready: boolean; accounts: ConnectedAccount[]; problem: ScopeProblem | null }> {
  const key = await agencyKey();
  if (!key) return { ready: false, accounts: [], problem: { kind: "no-key", message: NO_AGENCY_KEY } };
  const found = await findProfile(key, brandId);
  if (!found.ok) return { ready: true, accounts: [], problem: found.problem };
  if (!found.id) return { ready: true, accounts: [], problem: null };
  remember(brandId, found.id);
  const listed = await listAccounts(key, found.id, true);
  return listed.ok ? { ready: true, accounts: listed.accounts, problem: null } : { ready: true, accounts: [], problem: listed.problem };
}

/**
 * Whether an account belongs to this brand. The inbox reads a conversation by an id the browser sends, and with one shared key that id
 * could belong to another brand, so every such read asks this first.
 */
export async function ownsAccount(scope: { key: string; profileId: string }, accountId: string): Promise<{ ok: true } | { ok: false; problem: ScopeProblem }> {
  if (!OBJECT_ID.test(accountId)) return { ok: false, problem: { kind: "error", message: "That account is not connected to this brand." } };
  const listed = await listAccounts(scope.key, scope.profileId);
  if (!listed.ok) return listed;
  return listed.accounts.some((a) => a.id === accountId) ? { ok: true } : { ok: false, problem: { kind: "error", message: "That account is not connected to this brand." } };
}

/** The address to send the person to for the platform's own approval screen. Zernio brings them back to `redirectUrl` afterwards. */
export async function startConnect(key: string, profileId: string, platform: PlatformId, redirectUrl: string, brandName: string): Promise<{ ok: true; authUrl: string } | { ok: false; problem: ScopeProblem }> {
  if (!OBJECT_ID.test(profileId)) return { ok: false, problem: { kind: "error", message: "That profile is not valid." } };
  const r = await zreq(key, "GET", `/v1/connect/${platform}`, { qs: { profileId, redirect_url: redirectUrl, welcome: "true", brandName: brandName.trim().slice(0, 60) || "Brand" } });
  if (!r.ok) return { ok: false, problem: r.status === 400 ? { kind: "error", message: "Zernio would not start that connection. Try again, or tell the agency." } : problemFor(r.status) };
  const url = typeof (r.json as { authUrl?: unknown } | null)?.authUrl === "string" ? ((r.json as { authUrl: string }).authUrl) : "";
  try {
    // Only a secure address opens in the popup: never a script or a plain-text link.
    if (new URL(url).protocol === "https:") return { ok: true, authUrl: url };
  } catch {
    /* falls through */
  }
  return { ok: false, problem: { kind: "error", message: "Zernio answered, but not in a shape this page understands. Try again in a moment." } };
}

/** Removes accounts from Zernio, only ones that are on this brand's profile (checked fresh, not from memory). */
export async function disconnectAccounts(key: string, profileId: string, accountIds: string[]): Promise<{ ok: true; removed: number } | { ok: false; problem: ScopeProblem; removed: number }> {
  const listed = await listAccounts(key, profileId, true);
  if (!listed.ok) return { ok: false, problem: listed.problem, removed: 0 };
  const mine = new Set(listed.accounts.map((a) => a.id));
  let removed = 0;
  for (const id of accountIds) {
    if (!mine.has(id)) continue;
    const r = await zreq(key, "DELETE", `/v1/accounts/${id}`);
    if (!r.ok && r.status !== 404) {
      accountsCache.delete(profileId);
      return { ok: false, problem: problemFor(r.status), removed };
    }
    removed++;
  }
  accountsCache.delete(profileId);
  return { ok: true, removed };
}

/** Forget what was kept about a profile (after a connection finished or an account was removed). */
export const forgetAccounts = (profileId: string) => void accountsCache.delete(profileId);
