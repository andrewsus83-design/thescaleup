import "server-only";
import { interpret, result, unreachable, checkSpec, type CheckResult } from "./key-check-model";
import { isToken } from "./telegram/model";

// Asks each provider one cheap question with the saved key. Every host is fixed in this file (Zernio's can be moved by the
// server's own ZERNIO_BASE_URL), redirects are refused, and the key goes in a header (SerpApi alone takes it in the address).
// Nothing here logs an address or a provider's reply, and the messages are fixed text, so a key cannot leak through them.

const TIMEOUT_MS = 10_000;
// A header value must be printable ASCII with no spaces. Anything else would make the request fail before it is sent.
const HEADER_SAFE = /^[\x21-\x7e]+$/;

type Req = { url: string; method?: "GET" | "POST"; headers?: Record<string, string>; body?: string; timeoutMs?: number; rejectOn?: number[] };

const zernioBase = () => ((process.env.ZERNIO_BASE_URL ?? "").trim() || "https://zernio.com/api").replace(/\/$/, "");
const bearer = (k: string) => ({ Authorization: `Bearer ${k}` });

const BUILD: Record<string, (k: string) => Req> = {
  claude: (k) => ({ url: "https://api.anthropic.com/v1/models?limit=1", headers: { "x-api-key": k, "anthropic-version": "2023-06-01" } }),
  openai: (k) => ({ url: "https://api.openai.com/v1/models", headers: bearer(k) }),
  gemini: (k) => ({ url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", headers: { "x-goog-api-key": k }, rejectOn: [400] }),
  // Perplexity has no endpoint that only reads the account, so this sends one request that asks for a single word.
  perplexity: (k) => ({
    url: "https://api.perplexity.ai/chat/completions",
    method: "POST",
    headers: { ...bearer(k), "Content-Type": "application/json" },
    body: JSON.stringify({ model: "sonar", max_tokens: 1, messages: [{ role: "user", content: "ok" }] }),
    timeoutMs: 20_000,
  }),
  serp: (k) => ({ url: `https://serpapi.com/account.json?api_key=${encodeURIComponent(k)}` }),
  firecrawl: (k) => ({ url: "https://api.firecrawl.dev/v2/team/credit-usage", headers: bearer(k) }),
  apify: (k) => ({ url: "https://api.apify.com/v2/users/me", headers: bearer(k) }),
  zernio: (k) => ({ url: `${zernioBase()}/v1/accounts?page=1&limit=1`, headers: bearer(k) }),
  clickup: (k) => ({ url: "https://api.clickup.com/api/v2/team", headers: { Authorization: k } }),
};

async function send(tag: string, req: Req): Promise<Response | null> {
  try {
    return await fetch(req.url, {
      method: req.method ?? "GET",
      headers: { Accept: "application/json", ...req.headers },
      body: req.body,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(req.timeoutMs ?? TIMEOUT_MS),
    });
  } catch (e) {
    console.error("[key-check] request failed:", tag, e instanceof Error ? e.name : "error"); // never the address: it can hold the key
    return null;
  }
}

const drop = (res: Response) => void res.body?.cancel().catch(() => undefined);

async function viaStatus(provider: string, label: string, req: Req): Promise<CheckResult> {
  const res = await send(provider, req);
  if (!res) return unreachable(label);
  drop(res);
  return interpret(label, res.status, req.rejectOn);
}

/** DataForSEO answers 200 even for a bad login, and says so in the body: status_code 20000 is a good login. */
async function dataforseo(label: string, login: string, password: string): Promise<CheckResult> {
  const auth = `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
  const res = await send("dataforseo", { url: "https://api.dataforseo.com/v3/appendix/user_data", headers: { Authorization: auth } });
  if (!res) return unreachable(label);
  let code = NaN;
  try {
    code = Number(((await res.json()) as { status_code?: unknown } | null)?.status_code);
  } catch {
    /* not JSON: the HTTP status says enough */
  }
  if (res.ok && code === 20000) return result("ok", `${label} accepted this login and password.`);
  if (code >= 40100 && code < 40200) return interpret(label, 401);
  if (code >= 40200 && code < 40300) return interpret(label, 402);
  return interpret(label, res.ok ? 400 : res.status);
}

async function telegram(label: string, token: string): Promise<CheckResult> {
  if (!isToken(token)) return result("rejected", "That does not look like a Telegram bot token. It looks like 123456789:AA… and comes from @BotFather.");
  const res = await send("telegram", { url: `https://api.telegram.org/bot${token.trim()}/getMe` });
  if (!res) return unreachable(label);
  const out = interpret(label, res.status, [404]); // Telegram answers 404 for a token it does not know
  if (out.status !== "ok") {
    drop(res);
    return out;
  }
  let name = "";
  try {
    const u = ((await res.json()) as { result?: { username?: unknown } } | null)?.result?.username;
    if (typeof u === "string" && /^[A-Za-z0-9_]{3,64}$/.test(u)) name = u;
  } catch {
    /* the status already said it works */
  }
  return result("ok", name ? `${label} accepted this token. The bot is @${name}.` : `${label} accepted this token.`);
}

/** Checks one provider with the values given (decrypted by the caller). Never throws. */
export async function runCheck(provider: string, keys: Record<string, string>): Promise<CheckResult> {
  const spec = checkSpec(provider);
  if (!spec) return result("unsure", "This key cannot be checked yet.");
  const { label } = spec;
  try {
    if (provider === "dataforseo" || provider === "dataforseo_login") {
      const login = keys.dataforseo_login;
      const password = keys.dataforseo;
      if (!login || !password) return result("missing", "DataForSEO needs both the login and the password. Save the missing one too.");
      if (/[\r\n]/.test(login + password)) return result("rejected", "The saved login or password has a line break in it. Paste it again.");
      return await dataforseo(label, login, password);
    }
    const key = keys[provider];
    if (!key) return result("missing", "The saved key could not be read. Save it again.");
    if (provider === "telegram") return await telegram(label, key);
    if (!HEADER_SAFE.test(key)) return result("rejected", `This key has characters a ${label} key does not have. Copy it again from ${label} and save it.`);
    const build = BUILD[provider];
    if (!build) return result("unsure", "This key cannot be checked yet.");
    return await viaStatus(provider, label, build(key));
  } catch (e) {
    console.error("[key-check] failed:", provider, e instanceof Error ? e.name : "error");
    return result("error", "The check failed on our side. Try again.");
  }
}
