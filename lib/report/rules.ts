import "server-only";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import type { ReportRule, ReportCustomParam } from "@/lib/report/types";

const RULES_KEY = "report_rules";
const TEMPLATE_KEY = "report_template_name";
const CUSTOM_KEY = "report_custom_params";
const TPL_FILE_KEY = "report_template_file";
const TPL_FILE_NAME_KEY = "report_template_filename";

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

/** Uploaded default template file (xlsx, base64) + its filename. */
export async function getTemplateFile(): Promise<{ filename: string; base64: string } | null> {
  if (!isSupabaseAdminConfigured()) return null;
  try {
    const db = createSupabaseAdminClient();
    const { data } = await db.from("app_settings").select("key, value").in("key", [TPL_FILE_KEY, TPL_FILE_NAME_KEY]);
    const map: Record<string, string> = {};
    for (const r of data ?? []) if (r.key && r.value) map[r.key as string] = r.value as string;
    if (!map[TPL_FILE_KEY]) return null;
    return { filename: map[TPL_FILE_NAME_KEY] ?? "template.xlsx", base64: map[TPL_FILE_KEY] };
  } catch {
    return null;
  }
}

export async function saveTemplateFile(filename: string, base64: string): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  const db = createSupabaseAdminClient();
  const now = new Date().toISOString();
  await db.from("app_settings").upsert(
    [
      { key: TPL_FILE_KEY, value: base64, updated_at: now },
      { key: TPL_FILE_NAME_KEY, value: filename, updated_at: now },
    ],
    { onConflict: "key" },
  );
}

export async function getTemplateFilename(): Promise<string | null> {
  if (!isSupabaseAdminConfigured()) return null;
  try {
    const db = createSupabaseAdminClient();
    const { data } = await db.from("app_settings").select("value").eq("key", TPL_FILE_NAME_KEY).maybeSingle();
    return (data?.value as string) ?? null;
  } catch {
    return null;
  }
}
