import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

const COOKIE = "sc_client";

export type ClientMember = {
  id: string;
  business: string;
  name?: string | null;
  email?: string | null;
  status: string;
  access_token: string;
};

export function clientCookieName() {
  return COOKIE;
}

/** Master code that opens the latest member (auth-off for demo/testing). */
export function clientMasterCode() {
  return process.env.CLIENT_ACCESS_CODE ?? "000000";
}

/** The member behind the current client-session cookie, or null. */
export async function getClientMember(): Promise<ClientMember | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const db = createSupabaseAdminClient();
    const sel = "id, business, name, email, status, access_token";
    const q =
      token === clientMasterCode()
        ? db
            .from("leads")
            .select(sel)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : db.from("leads").select(sel).eq("access_token", token).maybeSingle();
    const { data } = await q;
    if (!data) return null;
    return {
      id: data.id as string,
      business: (data.business as string) || (data.name as string) || "Bisnis",
      name: data.name as string | null,
      email: data.email as string | null,
      status: data.status as string,
      access_token: (data.access_token as string) ?? clientMasterCode(),
    };
  } catch {
    return null;
  }
}

export async function requireClient(): Promise<ClientMember> {
  const m = await getClientMember();
  if (!m) redirect("/dashboard/login");
  return m;
}
