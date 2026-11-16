// Which keys can be stored, and where.
//  - scope "both":      the agency sets a default; a brand can bring its own, and falls back to the default when it has none.
//  - scope "workspace": the agency's own key, not shown on a brand.
//  - scope "brand":     a connection that belongs to one brand and never falls back (the brand's own accounts).
// "wired" is false while nothing in the app reads that key yet: the page says so instead of implying it is in use.

export type GroupId = "ai" | "research" | "pages" | "social" | "cost" | "google";
export type Scope = "both" | "workspace" | "brand";
export type ProviderDef = { key: string; label: string; use: string; hint: string; group: GroupId; scope: Scope; wired: boolean };

export const GROUPS: { id: GroupId; label: string; hint: string }[] = [
  { id: "ai", label: "AI models", hint: "Chat, analysis, writing and the agents" },
  { id: "research", label: "Search and research", hint: "Rankings, AI answers with citations, competitor data" },
  { id: "pages", label: "Pages and scraping", hint: "Reading websites and pulling data where no API exists" },
  { id: "social", label: "Social and messaging", hint: "Connected social accounts and WhatsApp" },
  { id: "cost", label: "Cost control", hint: "See what every AI call costs, per brand" },
  { id: "google", label: "Google", hint: "Drive files and Calendar events" },
];

export const PROVIDERS: ProviderDef[] = [
  { key: "claude", label: "Claude (Anthropic)", use: "Analysis, writing and the brand's agents", hint: "sk-ant-...", group: "ai", scope: "both", wired: true },
  { key: "openai", label: "OpenAI", use: "Fallback model when there is no Claude key", hint: "sk-...", group: "ai", scope: "both", wired: true },
  { key: "gemini", label: "Google Gemini (AI Studio)", use: "Routes each message to its intent and trims the context", hint: "AIza...", group: "ai", scope: "both", wired: true },
  { key: "perplexity", label: "Perplexity", use: "Research and AI-answer sampling with citations", hint: "pplx-...", group: "ai", scope: "both", wired: true },

  { key: "dataforseo_login", label: "DataForSEO login", use: "Search positions, AI mentions, competitor keywords", hint: "account email", group: "research", scope: "both", wired: true },
  { key: "dataforseo", label: "DataForSEO password", use: "Pairs with the login above", hint: "password or API key", group: "research", scope: "both", wired: true },
  { key: "serp", label: "SerpApi", use: "Second source for search results", hint: "API key", group: "research", scope: "both", wired: true },

  { key: "firecrawl", label: "Firecrawl", use: "Clean page text for checks and brand extraction", hint: "fc-...", group: "pages", scope: "both", wired: true },
  { key: "apify", label: "Apify", use: "Scrapers where no API exists (fallback only)", hint: "apify_api_...", group: "pages", scope: "both", wired: true },

  { key: "zernio", label: "Zernio", use: "Connects the brand's social accounts and WhatsApp (one key for both)", hint: "Zernio API key", group: "social", scope: "brand", wired: false },

  { key: "langfuse_public", label: "Langfuse public key", use: "Traces tokens and cost of AI calls, tagged by brand", hint: "pk-lf-...", group: "cost", scope: "both", wired: false },
  { key: "langfuse_secret", label: "Langfuse secret key", use: "Pairs with the public key above", hint: "sk-lf-...", group: "cost", scope: "both", wired: false },

  { key: "google_client_id", label: "Google OAuth client ID", use: "Lets a brand sign in with Google for Drive and Calendar", hint: "...apps.googleusercontent.com", group: "google", scope: "workspace", wired: false },
  { key: "google_client_secret", label: "Google OAuth client secret", use: "Pairs with the client ID above", hint: "GOCSPX-...", group: "google", scope: "workspace", wired: false },
];

export function providersFor(scope: "workspace" | "brand"): ProviderDef[] {
  return PROVIDERS.filter((p) => (scope === "workspace" ? p.scope !== "brand" : p.scope !== "workspace"));
}

/** A brand with no key of its own uses the workspace default. */
export const fallsBack = (p: ProviderDef) => p.scope === "both";

/** Returns an error message, or null when the pasted value looks like a usable secret. */
export function secretValueError(v: string): string | null {
  if (!v) return "Paste the key.";
  if (v.length > 500) return "That is too long for a key.";
  if (/\s/.test(v)) return "A key has no spaces or line breaks. Paste only the key.";
  return null;
}
