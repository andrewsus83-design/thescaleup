// Per-client API providers for the Report platform. Each client stores its OWN
// keys for these services in report_client_settings.
//
// Zernio = the client's data source that replaces Apify for report generation.
// The rest (dataforseo, apify, perplexity, gemini, claude, firecrawl, serpapi)
// are wired for the research/audit pipeline used later, per client.

export type ClientProvider = {
  key: string;
  label: string;
  hint: string;
  group: "data" | "research";
};

export const CLIENT_PROVIDERS: ClientProvider[] = [
  { key: "zernio", label: "Zernio", hint: "sumber data laporan / Insights (token API Zernio klien)", group: "data" },
  { key: "zernio_account_id", label: "Zernio Account ID", hint: "id akun IG yang terhubung di Zernio (opsional)", group: "data" },
  { key: "dataforseo_login", label: "DataForSEO Login", hint: "email/login akun DataForSEO", group: "research" },
  { key: "dataforseo", label: "DataForSEO Password", hint: "password / API key DataForSEO (Basic auth)", group: "research" },
  { key: "apify", label: "Apify", hint: "apify_api_… (scraping sosial, dipakai untuk riset)", group: "research" },
  { key: "perplexity", label: "Perplexity", hint: "pplx-… (riset GEO / AI search)", group: "research" },
  { key: "gemini", label: "Google Gemini", hint: "AIza… (indexation / grounding)", group: "research" },
  { key: "claude", label: "Claude (Anthropic)", hint: "sk-ant-… (sintesis laporan)", group: "research" },
  { key: "firecrawl", label: "Firecrawl", hint: "fc-… (deep crawl website)", group: "research" },
  { key: "serpapi", label: "SerpAPI", hint: "serp api key (fallback SERP/SEO)", group: "research" },
];

/** Providers that carry a secret (masked in the UI). Non-secret config keys are excluded. */
export const SECRET_PROVIDER_KEYS = new Set(
  CLIENT_PROVIDERS.filter((p) => p.key !== "zernio_account_id").map((p) => p.key),
);
