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
  category: string | null;
};

const DEFAULT_STAGES = ["Lead Baru", "Prospek", "Follow-up", "Closing", "Repeat"];

/** Default customer segments — used when the CRM config defines none. */
const DEFAULT_CATEGORIES = [
  "Pelanggan Baru",
  "Pelanggan Setia",
  "VIP",
  "Reseller / Grosir",
  "Korporat / B2B",
  "Tidak Aktif",
];

/** Optional customer categories (segments) from the CRM builder config. */
export function crmCategoriesFromData(data: Record<string, unknown> | null | undefined): string[] {
  const v = data?.customer_categories;
  const list = Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
  return list.length ? list : DEFAULT_CATEGORIES;
}

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

export type CrmData = { stages: string[]; sources: string[]; categories: string[]; contacts: CrmContact[] };

export async function loadCrm(memberId: string): Promise<CrmData> {
  const empty: CrmData = { stages: DEFAULT_STAGES, sources: [], categories: DEFAULT_CATEGORIES, contacts: [] };
  if (!isSupabaseAdminConfigured()) return empty;
  try {
    const db = createSupabaseAdminClient();
    const contactsQuery = (cols: string) =>
      db
        .from("crm_contacts")
        .select(cols)
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(500);
    const [{ data: project }, contacts] = await Promise.all([
      db.from("builder_projects").select("data").eq("member_id", memberId).eq("builder", "crm").maybeSingle(),
      contactsQuery("id, name, whatsapp, email, source, stage, value, notes, category"),
    ]);
    let rows = (contacts.data ?? []) as unknown as CrmContact[];
    if (contacts.error) {
      // The optional `category` column migration may not be applied yet — still show
      // existing contacts (with category = null) instead of a silently empty board.
      const legacy = await contactsQuery("id, name, whatsapp, email, source, stage, value, notes");
      rows = ((legacy.data ?? []) as unknown as Record<string, unknown>[]).map(
        (r) => ({ ...r, category: null }) as unknown as CrmContact,
      );
    }
    const cfg = (project?.data ?? {}) as Record<string, unknown>;
    return {
      stages: crmStagesFromData(cfg),
      sources: crmSourcesFromData(cfg),
      categories: crmCategoriesFromData(cfg),
      contacts: rows,
    };
  } catch {
    return empty;
  }
}
