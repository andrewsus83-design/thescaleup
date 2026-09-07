import "server-only";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

export type CrmContact = {
  id: string;
  name: string;
  whatsapp: string | null;
  email: string | null;
  source: string | null;
  stage: string;
  value: number | null;
  notes: string | null;
};

const DEFAULT_STAGES = ["Lead Baru", "Prospek", "Follow-up", "Closing", "Repeat"];

/** Pipeline stage names from the CRM builder config (the "stages" editor). */
export function crmStagesFromData(data: Record<string, unknown> | null | undefined): string[] {
  const s = data?.pipeline_stages;
  const list = Array.isArray(s) ? s.map((x) => String(x).trim()).filter(Boolean) : [];
  return list.length ? list : DEFAULT_STAGES;
}

function crmSourcesFromData(data: Record<string, unknown> | null | undefined): string[] {
  const v = data?.lead_sources;
  if (v && typeof v === "object" && !Array.isArray(v)) return Object.keys(v as object);
  if (Array.isArray(v)) return (v as unknown[]).map(String);
  return [];
}

export type CrmData = { stages: string[]; sources: string[]; contacts: CrmContact[] };

export async function loadCrm(memberId: string): Promise<CrmData> {
  const empty: CrmData = { stages: DEFAULT_STAGES, sources: [], contacts: [] };
  if (!isSupabaseAdminConfigured()) return empty;
  try {
    const db = createSupabaseAdminClient();
    const [{ data: project }, { data: rows }] = await Promise.all([
      db.from("builder_projects").select("data").eq("member_id", memberId).eq("builder", "crm").maybeSingle(),
      db
        .from("crm_contacts")
        .select("id, name, whatsapp, email, source, stage, value, notes")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    const cfg = (project?.data ?? {}) as Record<string, unknown>;
    return {
      stages: crmStagesFromData(cfg),
      sources: crmSourcesFromData(cfg),
      contacts: (rows ?? []) as CrmContact[],
    };
  } catch {
    return empty;
  }
}
