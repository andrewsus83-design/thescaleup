// What "Check connection" means for each saved key. Pure (no secrets, no network), so the settings page and the tests can share it.
// A check asks the provider one cheap question with the saved key and reports what came back. It never stores the answer.

export type CheckStatus = "ok" | "rejected" | "limited" | "unreachable" | "unsure" | "missing" | "error";
export type CheckResult = { status: CheckStatus; message: string };

/**
 * cost "free": the provider has an endpoint that only reads the account, so a check costs nothing.
 * cost "small": the provider has none, so the check sends one tiny paid request. It is never run on its own after a save.
 * needs: keys that only work together (DataForSEO's login and password).
 * Providers that nothing in the app uses yet have no entry: there is nothing to check them against.
 */
export type CheckSpec = { label: string; cost: "free" | "small"; needs?: string[] };

const DATAFORSEO: CheckSpec = { label: "DataForSEO", cost: "free", needs: ["dataforseo_login", "dataforseo"] };

export const CHECKS: Record<string, CheckSpec> = {
  claude: { label: "Anthropic", cost: "free" },
  openai: { label: "OpenAI", cost: "free" },
  gemini: { label: "Google", cost: "free" },
  perplexity: { label: "Perplexity", cost: "small" },
  dataforseo_login: DATAFORSEO,
  dataforseo: DATAFORSEO,
  serp: { label: "SerpApi", cost: "free" },
  firecrawl: { label: "Firecrawl", cost: "free" },
  apify: { label: "Apify", cost: "free" },
  zernio: { label: "Zernio", cost: "free" },
  telegram: { label: "Telegram", cost: "free" },
  clickup: { label: "ClickUp", cost: "free" },
  xendit: { label: "Xendit", cost: "free" },
};

export const checkSpec = (provider: string): CheckSpec | null => (Object.hasOwn(CHECKS, provider) ? CHECKS[provider] : null);

export const result = (status: CheckStatus, message: string): CheckResult => ({ status, message });

export const unreachable = (label: string): CheckResult => result("unreachable", `Could not reach ${label}. Try again.`);

/**
 * Reads the HTTP status a provider answered with. 401 and 403 mean the key was turned down. 429 and 402 usually mean the key
 * is fine but the account is busy or out of credit, so they are reported apart from a rejection. Anything else we did not
 * expect is "unsure": it never blames the key, because it may be our request that is wrong.
 * rejectOn lists other statuses that a provider uses for a bad key (Google answers 400, Telegram answers 404).
 * Messages are fixed text: they never contain the key or anything the provider sent back.
 */
export function interpret(label: string, status: number, rejectOn: number[] = []): CheckResult {
  if (status >= 200 && status < 300) return result("ok", `${label} accepted this key.`);
  if (status === 401 || status === 403 || rejectOn.includes(status)) return result("rejected", `${label} did not accept this key. Copy it again from ${label} and save it.`);
  if (status === 402) return result("limited", `${label} says the account is out of credit or over its plan. The key itself may be fine.`);
  if (status === 429) return result("limited", `${label} is limiting requests right now. The key may be fine. Try again in a minute.`);
  if (status >= 500) return result("unreachable", `${label} is having trouble right now. Try again in a few minutes.`);
  return result("unsure", `${label} answered in a way the check did not expect (${status}). The key may still be fine.`);
}
