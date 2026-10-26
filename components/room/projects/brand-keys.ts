// Provider catalog, per-brand API keys and spend for Project → Integrations (components/room/projects/integrations.tsx)
// and the workspace keys in Setting (components/room/settings-screen.tsx).
// MOCK DATA for the prototype, kept next to the UI on purpose: lib/room belongs to the data-layer work, which replaces
// this file with real tables (a key reference per brand and provider, and a usage ledger to sum the spend from).
//
// The catalog is the tool list of "3 · Tech Stack" plus the keys the running platform already stores (Setting → API keys
// and the Report's per-client keys): every provider that needs a credential. Hosting, database and file storage
// (Vercel, Supabase, Cloudflare R2) have no brand key and are not listed.

export type ProviderId =
  | "claude" | "gemini" | "openai"
  | "dataforseo" | "perplexity" | "serpapi"
  | "firecrawl" | "pagespeed" | "apify"
  | "zernio" | "gsc"
  | "resend" | "langfuse";

export type GroupId = "ai" | "search" | "pages" | "social" | "delivery";

/** How a provider charges: per call (metered, so it can be capped), a flat plan the provider bills, or nothing. */
export type Billing = "usage" | "plan" | "free";

export type Provider = {
  id: ProviderId;
  name: string;
  use: string;
  group: GroupId;
  billing: Billing;
  /** "key" = a secret the brand pastes; "grant" = the brand's owner gives read access (Search Console). */
  kind: "key" | "grant";
  /** What the key looks like, shown as the field's placeholder. */
  hint?: string;
  /** DataForSEO signs in with a login and a password: this is the label of the login field. */
  login?: string;
};

export const GROUPS: { id: GroupId; label: string; hint: string }[] = [
  { id: "ai", label: "AI models", hint: "Chat, analysis and writing" },
  { id: "search", label: "Search and AI answers", hint: "Rankings, citations and competitor data" },
  { id: "pages", label: "Websites and pages", hint: "Crawling, speed and scraping" },
  { id: "social", label: "Social and Google", hint: "Report data and search performance" },
  { id: "delivery", label: "Email and tracing", hint: "Sending reports and tracing cost" },
];

export const PROVIDERS: Provider[] = [
  { id: "claude", name: "Claude (Anthropic)", use: "Profile extraction, tips, insights, bilingual reports, builder drafts and the project chat", group: "ai", billing: "usage", kind: "key", hint: "sk-ant-…" },
  { id: "gemini", name: "Google Gemini", use: "Flash-Lite routes each chat message to its intent and slices the context", group: "ai", billing: "usage", kind: "key", hint: "AIza…" },
  { id: "openai", name: "OpenAI", use: "Fallback model for the audit engine when no Claude key is set", group: "ai", billing: "usage", kind: "key", hint: "sk-…" },
  { id: "dataforseo", name: "DataForSEO", use: "Search positions, AI-answer mentions and citations, competitor keywords, domain rank and backlinks", group: "search", billing: "usage", kind: "key", login: "Login (account email)" },
  { id: "perplexity", name: "Perplexity", use: "AI-answer sampling with citations, and the monthly scout research", group: "search", billing: "usage", kind: "key", hint: "pplx-…" },
  { id: "serpapi", name: "SerpApi", use: "Optional second source for search results", group: "search", billing: "usage", kind: "key", hint: "SerpApi key" },
  { id: "firecrawl", name: "Firecrawl", use: "Clean page text for checks and brand extraction (Jina Reader is the swap-in)", group: "pages", billing: "usage", kind: "key", hint: "fc-…" },
  { id: "pagespeed", name: "PageSpeed Insights", use: "Speed and technical checks on the brand's pages", group: "pages", billing: "free", kind: "key", hint: "AIza…" },
  { id: "apify", name: "Apify", use: "Scrapers where no API exists, used as a fallback only", group: "pages", billing: "usage", kind: "key", hint: "apify_api_…" },
  { id: "zernio", name: "Zernio", use: "Social analytics for the Report (reach, posts, followers) and post counts for audits", group: "social", billing: "plan", kind: "key", hint: "Zernio API key" },
  { id: "gsc", name: "Google Search Console", use: "Real search queries and index data, only for brands that grant access", group: "social", billing: "free", kind: "grant" },
  { id: "resend", name: "Resend", use: "Report emails sent from the brand's own verified domain", group: "delivery", billing: "plan", kind: "key", hint: "re_…" },
  { id: "langfuse", name: "Langfuse or Helicone", use: "Traces the tokens and cost of this brand's AI calls in its own project", group: "delivery", billing: "plan", kind: "key", hint: "Tracing key" },
];

export const providerOf = (id: ProviderId): Provider => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
/** Only pay-as-you-go providers are metered, so only they have a spend figure and a monthly cap. */
export const isMetered = (p: Provider) => p.billing === "usage";
export const BILLING_LABEL: Record<Billing, string> = { usage: "Pay as you go", plan: "Flat plan", free: "Free tier" };

/** What the vault keeps about a brand's own key: never the key itself, only its last 4 characters. */
export type OwnKey = {
  /** Last 4 characters of the key; empty for a grant. */
  last4: string;
  /** Monthly cap in USD. Only metered providers have one; 0 otherwise. */
  cap: number;
  active: boolean;
  /** The non-secret half of a login pair (DataForSEO). */
  login?: string;
  /** What a grant covers: the Search Console property. */
  property?: string;
};
export type BrandKeys = Partial<Record<ProviderId, OwnKey>>;

/** Setting → Cost: "Monthly chat cap per project". The workspace pays up to this much per brand each month. */
export const WORKSPACE_CAP = 40;

/** This month's spend per brand and provider, in USD. Brands created in the prototype start at zero. */
const USAGE: Record<string, Partial<Record<ProviderId, number>>> = {
  "kopi-senja": { claude: 3.1, gemini: 1.2, dataforseo: 0.75, perplexity: 0.9, serpapi: 0.12, firecrawl: 0.48, apify: 0.2 },
  "batik-laras": { claude: 1.4, gemini: 0.6, perplexity: 0.35, firecrawl: 0.22 },
};

/** Kopi Senja brings its own Claude and Zernio keys and a Search Console grant; Batik Laras has a Firecrawl key that is switched off.
 *  Together with the brands that bring nothing, every state is visible in the prototype. */
const INITIAL_KEYS: Record<string, BrandKeys> = {
  "kopi-senja": {
    claude: { last4: "x4Qm", cap: 25, active: true },
    zernio: { last4: "9vTe", cap: 0, active: true },
    gsc: { last4: "", cap: 0, active: true, property: "sc-domain:kopisenja.id" },
  },
  "batik-laras": { firecrawl: { last4: "m3Wd", cap: 15, active: false } },
};

export const initialKeys = (projectId: string): BrandKeys => INITIAL_KEYS[projectId] ?? {};
export const spendOf = (projectId: string, provider: ProviderId) => USAGE[projectId]?.[provider] ?? 0;

/** Everything one brand used this month, whichever key paid for it. */
export const costThisMonth = (projectId: string) => PROVIDERS.reduce((sum, p) => sum + spendOf(projectId, p.id), 0);

/** Who pays: an active own key bills the brand's own account; everything else is charged to the workspace. */
export function costSplit(projectId: string, keys: BrandKeys) {
  const own = PROVIDERS.filter((p) => keys[p.id]?.active).reduce((sum, p) => sum + spendOf(projectId, p.id), 0);
  return { own, workspace: costThisMonth(projectId) - own };
}

export const usd = (n: number) => `$${n.toFixed(2)}`;
