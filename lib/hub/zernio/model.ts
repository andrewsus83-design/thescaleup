// Pure rules for the agency's one Zernio key: which platforms a brand can connect, how Zernio's answers are read, how its redirect
// back to us is understood, and which messages the person sees. No I/O and no secrets here, so the browser can import it too.
//
// The shape: the agency saves ONE Zernio key. Every brand gets its OWN Zernio profile inside that key (found again by the brand's id,
// stored in the profile's externalId), and every read names that profile. A brand never sees another brand's accounts.

export const CONNECT_PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "twitter", label: "X (Twitter)" },
  { id: "threads", label: "Threads" },
  { id: "pinterest", label: "Pinterest" },
] as const;

export type PlatformId = (typeof CONNECT_PLATFORMS)[number]["id"];

export const isPlatform = (v: unknown): v is PlatformId => typeof v === "string" && CONNECT_PLATFORMS.some((p) => p.id === v);
export const platformLabel = (id: string): string => CONNECT_PLATFORMS.find((p) => p.id === id)?.label ?? id;

/** Zernio ids are Mongo ObjectIds. Checked before an id goes into an address or a filter. */
export const OBJECT_ID = /^[0-9a-f]{24}$/i;

/** Both the popup page and the page that opened it use this name to talk to each other. */
export const CONNECT_CHANNEL = "scaleup-connect";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// ---- what Zernio says about accounts and profiles ----

export type ConnectedAccount = { id: string; platform: PlatformId; username: string; name: string; picture: string | null; needsReconnect: boolean };

/** The social accounts of a `GET /v1/accounts` answer. Ads, phone and other rows are left out; a row without a usable id is skipped. */
export function parseAccounts(json: unknown): ConnectedAccount[] {
  const list = isObj(json) && Array.isArray(json.accounts) ? json.accounts : [];
  const seen = new Set<string>();
  const out: ConnectedAccount[] = [];
  for (const raw of list) {
    if (!isObj(raw)) continue;
    const id = str(raw._id, 40) || str(raw.id, 40);
    if (!OBJECT_ID.test(id) || seen.has(id) || !isPlatform(raw.platform)) continue;
    seen.add(id);
    const picture = str(raw.profilePicture, 500);
    out.push({
      id,
      platform: raw.platform,
      username: str(raw.username, 80),
      name: str(raw.displayName, 80),
      picture: picture.startsWith("https://") ? picture : null,
      needsReconnect: raw.needsReconnection === true || raw.isActive === false,
    });
  }
  return out;
}

/** The profile that belongs to this brand (its externalId is the brand's id) in a `GET /v1/profiles` answer. */
export function parseProfileId(json: unknown, brandId: string): string | null {
  const list = isObj(json) && Array.isArray(json.profiles) ? json.profiles : [];
  for (const p of list) {
    if (isObj(p) && p.externalId === brandId && typeof p._id === "string" && OBJECT_ID.test(p._id)) return p._id;
  }
  return null;
}

/** The id of the profile a `POST /v1/profiles` just made. */
export function parseCreatedProfile(json: unknown): string | null {
  const p = isObj(json) && isObj(json.profile) ? json.profile : null;
  return p && typeof p._id === "string" && OBJECT_ID.test(p._id) ? p._id : null;
}

// ---- where Zernio sends the person back to ----

/**
 * The address Zernio returns the person to after the platform's own approval screen. Only our own hosts count, so a forged Host
 * header cannot send the person (or the connection result) anywhere else.
 */
export function redirectOrigin(host: string | null, siteUrl: string): string {
  const h = (host ?? "").toLowerCase().trim();
  if (/^localhost(:\d{1,5})?$/.test(h)) return `http://${h}`;
  if (/^([a-z0-9-]+\.)*(thescaleup\.xyz|vercel\.app)$/.test(h)) return `https://${h}`;
  return siteUrl.replace(/\/$/, "");
}

export const doneUrl = (origin: string) => `${origin}/hub/connect/done`;

export type ConnectOutcome = { ok: true; platform: string; username: string } | { ok: false; platform: string; message: string };

const CONNECT_ERRORS: Record<string, string> = {
  oauth_denied: "The connection was cancelled, or the platform did not allow it.",
  account_mismatch: "That is not the account that was expected. Sign in with the right one.",
  reconnect_account_mismatch: "That is a different account from the one being reconnected.",
  missing_tiktok_permissions: "TikTok did not grant every permission. Connect again and accept all of them.",
  missing_google_permissions: "Google did not grant every permission. Connect again and accept all of them.",
  no_facebook_pages: "That Facebook login has no Pages to connect.",
  no_youtube_channel: "That Google login has no YouTube channel.",
  code_already_redeemed: "That link was already used. Start the connection again.",
};

/** What the address Zernio sent the person back to says. Anything unknown counts as a plain failure; the text shown is always ours. */
export function readRedirect(params: Record<string, string | string[] | undefined>): ConnectOutcome {
  const one = (k: string) => {
    const v = params[k];
    return str(Array.isArray(v) ? v[0] : v, 120);
  };
  const platformRaw = one("platform") || one("connected");
  const platform = isPlatform(platformRaw) ? platformRaw : "";
  const error = one("error");
  if (error) return { ok: false, platform, message: Object.hasOwn(CONNECT_ERRORS, error) ? CONNECT_ERRORS[error] : "The connection did not finish. Try again." };
  if (one("accountId") || one("connected")) return { ok: true, platform, username: one("username").slice(0, 80) };
  return { ok: false, platform, message: "The connection did not finish. Try again." };
}

// ---- what the person is told when Zernio cannot be read ----

export type ScopeProblem = { kind: "no-key" | "auth" | "error"; message: string };

export const NO_AGENCY_KEY = "Zernio is not set up yet. The agency owner adds the Zernio key in the workspace settings.";
export const NO_ACCOUNTS = "No social accounts are connected yet. Connect them in Settings, Social media connections.";

/** A Zernio status as a problem, in words that say who can fix it. 0 means no answer came. */
export function problemFor(status: number): ScopeProblem {
  if (status === 401 || status === 403) return { kind: "auth", message: "Zernio did not accept the agency's key. The agency owner can check it in the workspace settings." };
  if (status === 402) return { kind: "error", message: "The agency's Zernio plan needs a payment method before more accounts can be connected. Tell the agency." };
  if (status === 429) return { kind: "error", message: "Zernio is limiting requests right now. Try again in a minute." };
  if (status === 0) return { kind: "error", message: "Could not reach Zernio. Try again in a moment." };
  return { kind: "error", message: `Zernio answered with an error (${status}). Try again in a moment.` };
}
