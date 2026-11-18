import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decrypt, encrypt, last4, parseKey } from "./crypto";

// Encrypted API keys. Needs SECRETS_KEY_<n> (base64, 32 bytes) in the server environment; SECRETS_KEY_CURRENT picks the
// version used for new writes (default 1). Values are never returned to the browser: only the last 4 characters are.

const currentVersion = () => Number(process.env.SECRETS_KEY_CURRENT || 1) || 1;
const keyFor = (version: number) => parseKey(process.env[`SECRETS_KEY_${version}`]);
const aadFor = (brandId: string | null, provider: string) => `${brandId ?? "workspace"}:${provider}`;

export function isEncryptionReady(): boolean {
  return keyFor(currentVersion()) !== null;
}

export type SecretMeta = { provider: string; last4: string | null; updated_at: string };

/** Which providers have a stored key (no values). */
export async function secretStatus(brandId: string | null): Promise<Record<string, SecretMeta>> {
  const admin = createSupabaseAdminClient();
  const q = brandId
    ? admin.from("brand_secrets").select("provider, last4, updated_at").eq("brand_id", brandId)
    : admin.from("workspace_secrets").select("provider, last4, updated_at");
  const { data } = await q;
  return Object.fromEntries((data ?? []).map((r) => [r.provider as string, r as SecretMeta]));
}

export async function saveSecret(brandId: string | null, provider: string, value: string, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const version = currentVersion();
  const key = keyFor(version);
  if (!key) return { ok: false, error: "Encryption is not set up yet. Add SECRETS_KEY_1 to the server environment first." };
  const ciphertext = encrypt(value, key, aadFor(brandId, provider));
  const admin = createSupabaseAdminClient();
  const row = { provider, ciphertext, key_version: version, last4: last4(value) || null, updated_by: userId };
  const { error } = brandId
    ? await admin.from("brand_secrets").upsert({ ...row, brand_id: brandId }, { onConflict: "brand_id,provider" })
    : await admin.from("workspace_secrets").upsert(row, { onConflict: "provider" });
  if (error) {
    console.error("[hub] saveSecret failed:", error.message);
    return { ok: false, error: "Could not save the key. Try again." };
  }
  return { ok: true };
}

export async function removeSecret(brandId: string | null, provider: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (brandId) await admin.from("brand_secrets").delete().eq("brand_id", brandId).eq("provider", provider);
  else await admin.from("workspace_secrets").delete().eq("provider", provider);
}

type Row = { provider: string; ciphertext: string; key_version: number };
function open(row: Row, brandId: string | null): string | null {
  const key = keyFor(row.key_version);
  if (!key) return null;
  try {
    return decrypt(row.ciphertext, key, aadFor(brandId, row.provider));
  } catch {
    console.error(`[hub] could not decrypt ${brandId ? "brand" : "workspace"} secret ${row.provider}`);
    return null;
  }
}

/** All workspace keys, decrypted. For server code only (the audit engine). */
export async function getWorkspaceSecrets(): Promise<Record<string, string>> {
  const { data } = await createSupabaseAdminClient().from("workspace_secrets").select("provider, ciphertext, key_version");
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as Row[]) {
    const v = open(r, null);
    if (v) out[r.provider] = v;
  }
  return out;
}

/** A brand's key. AI keys fall back to the workspace default; connections never do. */
export async function getBrandKey(brandId: string, provider: string, fallbackToWorkspace: boolean): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("brand_secrets").select("provider, ciphertext, key_version").eq("brand_id", brandId).eq("provider", provider).maybeSingle();
  if (data) {
    const v = open(data as Row, brandId);
    if (v) return v;
  }
  if (!fallbackToWorkspace) return null;
  return (await getWorkspaceSecrets())[provider] ?? null;
}

/** Several keys of one scope at once, decrypted (server only). A brand's own key wins; with fallback the workspace default fills the gaps. */
export async function getKeys(brandId: string | null, providers: string[], fallbackToWorkspace: boolean): Promise<Record<string, string>> {
  const admin = createSupabaseAdminClient();
  const out: Record<string, string> = {};
  if (brandId) {
    const { data } = await admin.from("brand_secrets").select("provider, ciphertext, key_version").eq("brand_id", brandId).in("provider", providers);
    for (const r of (data ?? []) as Row[]) {
      const v = open(r, brandId);
      if (v) out[r.provider] = v;
    }
  }
  const missing = providers.filter((p) => !out[p]);
  if (missing.length > 0 && (!brandId || fallbackToWorkspace)) {
    const { data } = await admin.from("workspace_secrets").select("provider, ciphertext, key_version").in("provider", missing);
    for (const r of (data ?? []) as Row[]) {
      const v = open(r, null);
      if (v) out[r.provider] = v;
    }
  }
  return out;
}
