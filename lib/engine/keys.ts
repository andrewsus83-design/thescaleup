import "server-only";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

export type ApiKeys = {
  claude?: string;
  openai?: string;
  gemini?: string;
  perplexity?: string;
  firecrawl?: string;
  apify?: string;
  serp?: string;
};

/**
 * Resolve API keys from the admin Settings table (app_settings), falling back
 * to environment variables. Reads settings once per call.
 */
export async function getApiKeys(): Promise<ApiKeys> {
  const settings: Record<string, string> = {};
  if (isSupabaseAdminConfigured()) {
    try {
      const db = createSupabaseAdminClient();
      const { data } = await db.from("app_settings").select("key, value");
      for (const r of data ?? []) {
        if (r.key && r.value) settings[r.key as string] = r.value as string;
      }
    } catch {
      // app_settings table may not exist yet — fall back to env.
    }
  }
  const pick = (k: string, env?: string) =>
    settings[k]?.trim() || env?.trim() || undefined;

  return {
    claude: pick("claude", process.env.ANTHROPIC_API_KEY),
    openai: pick("openai", process.env.OPENAI_API_KEY),
    gemini: pick("gemini", process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY),
    perplexity: pick("perplexity", process.env.PERPLEXITY_API_KEY),
    firecrawl: pick("firecrawl", process.env.FIRECRAWL_API_KEY),
    apify: pick("apify", process.env.APIFY_API_KEY),
    serp: pick("serp", process.env.SERP_API_KEY),
  };
}
