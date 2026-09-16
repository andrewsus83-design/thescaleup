import "server-only";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import type { ReportRule, ReportCustomParam } from "@/lib/report/types";

const RULES_KEY = "report_rules";
const TEMPLATE_KEY = "report_template_name";
const CUSTOM_KEY = "report_custom_params";

/** Read the global report rules (stored as JSON in app_settings). */
export async function getReportRules(): Promise<ReportRule[]> {
  if (!isSupabaseAdminConfigured()) return [];
  try {
    const db = createSupabaseAdminClient();
    const { data } = await db.from("app_settings").select("value").eq("key", RULES_KEY).maybeSingle();
    if (!data?.value) return [];
    const arr = JSON.parse(data.value as string);
    return Array.isArray(arr) ? (arr as ReportRule[]) : [];
  } catch {
    return [];
  }
}

export async function saveReportRules(rules: ReportRule[]): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  const db = createSupabaseAdminClient();
  await db
    .from("app_settings")
    .upsert({ key: RULES_KEY, value: JSON.stringify(rules), updated_at: new Date().toISOString() }, { onConflict: "key" });
}

export async function getTemplateName(): Promise<string> {
  if (!isSupabaseAdminConfigured()) return "";
  try {
    const db = createSupabaseAdminClient();
    const { data } = await db.from("app_settings").select("value").eq("key", TEMPLATE_KEY).maybeSingle();
    return (data?.value as string) ?? "";
  } catch {
    return "";
  }
}

export async function saveTemplateName(name: string): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  const db = createSupabaseAdminClient();
  await db
    .from("app_settings")
    .upsert({ key: TEMPLATE_KEY, value: name, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

/** Custom AI parameters (Claude Opus analyzes report data against these). */
export async function getCustomParams(): Promise<ReportCustomParam[]> {
  if (!isSupabaseAdminConfigured()) return [];
  try {
    const db = createSupabaseAdminClient();
    const { data } = await db.from("app_settings").select("value").eq("key", CUSTOM_KEY).maybeSingle();
    if (!data?.value) return [];
    const arr = JSON.parse(data.value as string);
    return Array.isArray(arr) ? (arr as ReportCustomParam[]) : [];
  } catch {
    return [];
  }
}

export async function saveCustomParams(params: ReportCustomParam[]): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  const db = createSupabaseAdminClient();
  await db
    .from("app_settings")
    .upsert({ key: CUSTOM_KEY, value: JSON.stringify(params), updated_at: new Date().toISOString() }, { onConflict: "key" });
}
