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

/** The paid member behind the current client-session cookie, or null. */
export async function getClientMember(): Promise<ClientMember | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const db = createSupabaseAdminClient();
    const { data } = await db
      .from("leads")
      .select("id, business, name, email, status, access_token")
      .eq("access_token", token)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id as string,
      business: (data.business as string) || (data.name as string) || "Bisnis",
      name: data.name as string | null,
      email: data.email as string | null,
      status: data.status as string,
      access_token: data.access_token as string,
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
