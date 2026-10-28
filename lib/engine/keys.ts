import "server-only";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import { decryptValue } from "@/lib/room/crypto";

export type ApiKeys = {
  claude?: string;
  openai?: string;
  gemini?: string;
  perplexity?: string;
  firecrawl?: string;
  apify?: string;
  dataforseo?: string;
  dataforseo_login?: string;
  serp?: string;
};

/**
 * Resolve API keys, preferring brand-level keys over workspace keys over env vars.
 * Pass `brandDbId` (the UUID from report_clients) to enable per-brand key resolution.
 * Brand key → workspace key → environment variable.
 */
export async function getApiKeys(brandDbId?: string): Promise<ApiKeys> {
  const workspace: Record<string, string> = {};
  const brand: Record<string, string> = {};

  if (isSupabaseAdminConfigured()) {
    const db = createSupabaseAdminClient();
    try {
      const { data } = await db.from("app_settings").select("key, value");
      for (const r of data ?? []) {
        if (r.key && r.value) workspace[r.key as string] = decryptValue(r.value as string);
      }
    } catch {
      // app_settings table may not exist yet — fall back to env.
    }

    if (brandDbId) {
      try {
        const { data } = await db
          .from("report_client_settings")
          .select("key, value")
          .eq("client_id", brandDbId)
          .not("key", "like", "meta:%");
        for (const r of data ?? []) {
          if (r.key && r.value) brand[r.key as string] = decryptValue(r.value as string);
        }
      } catch {
        // report_client_settings may not exist yet — continue with workspace keys.
      }
    }
  }

  // brand key → workspace key → env var
  const pick = (k: string, env?: string) =>
    brand[k]?.trim() || workspace[k]?.trim() || env?.trim() || undefined;

  return {
    claude: pick("claude", process.env.ANTHROPIC_API_KEY),
    openai: pick("openai", process.env.OPENAI_API_KEY),
    gemini: pick("gemini", process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY),
    perplexity: pick("perplexity", process.env.PERPLEXITY_API_KEY),
    firecrawl: pick("firecrawl", process.env.FIRECRAWL_API_KEY),
    apify: pick("apify", process.env.APIFY_API_KEY),
    dataforseo: pick("dataforseo", process.env.DATAFORSEO_PASSWORD ?? process.env.DATAFORSEO_API_KEY),
    dataforseo_login: pick("dataforseo_login", process.env.DATAFORSEO_LOGIN),
    serp: pick("serp", process.env.SERP_API_KEY),
  };
}
