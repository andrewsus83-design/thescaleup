// Per-brand API keys and spend for Project → Integrations (components/room/projects/integrations.tsx).
// MOCK DATA for the prototype, kept next to the UI on purpose: lib/room belongs to the data-layer work, which replaces
// this file with real tables (a key reference per brand and provider, and a usage ledger to sum the spend from).

export type ProviderId = "claude" | "gemini" | "perplexity" | "dataforseo";

/** What the vault keeps about a brand's own key: never the key itself, only its last 4 characters. */
export type OwnKey = { last4: string; cap: number; active: boolean };
export type BrandKeys = Partial<Record<ProviderId, OwnKey>>;

export const PROVIDERS: { id: ProviderId; name: string; use: string }[] = [
  { id: "claude", name: "Claude (Anthropic)", use: "Chat answers, audit analysis and report writing" },
  { id: "gemini", name: "Google Gemini", use: "AI-answer sampling" },
  { id: "perplexity", name: "Perplexity", use: "Web search and citations" },
  { id: "dataforseo", name: "DataForSEO", use: "Search rankings and SEO data" },
];

/** Setting → Cost: "Monthly chat cap per project". The workspace pays up to this much per brand each month. */
export const WORKSPACE_CAP = 40;

/** This month's spend per brand and provider, in USD. Brands created in the prototype start at zero. */
const USAGE: Record<string, Record<ProviderId, number>> = {
  "kopi-senja": { claude: 3.1, gemini: 1.2, perplexity: 0.9, dataforseo: 0.75 },
  "batik-laras": { claude: 1.4, gemini: 0.6, perplexity: 0.35, dataforseo: 0 },
};

/** Kopi Senja already brings its own Claude key, so both states are visible in the prototype. */
const INITIAL_KEYS: Record<string, BrandKeys> = { "kopi-senja": { claude: { last4: "x4Qm", cap: 25, active: true } } };

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
