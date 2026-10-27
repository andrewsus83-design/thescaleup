/**
 * One-time migration: re-encrypt any plaintext API key values in app_settings.
 * Safe to run multiple times — already-encrypted values are skipped.
 *
 * Usage (from repo root):
 *   node --env-file=.env.local scripts/encrypt-app-settings.mjs
 */
import { createClient } from "../node_modules/@supabase/supabase-js/dist/index.mjs";
import { createCipheriv, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const encHex = process.env.ROOM_ENCRYPTION_KEY;

if (!url || !serviceKey) { console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
if (!encHex || encHex.length !== 64) { console.error("ROOM_ENCRYPTION_KEY must be a 64-char hex string"); process.exit(1); }

const keyBuf = Buffer.from(encHex, "hex");
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: rows, error: readErr } = await db.from("app_settings").select("key, value");
if (readErr) { console.error("Read error:", readErr.message); process.exit(1); }

let migrated = 0;
let skipped = 0;

for (const row of rows ?? []) {
  // Skip meta rows (UI metadata, not secrets) and already-encrypted rows.
  if (row.key.startsWith("room_meta:") || row.value.startsWith(PREFIX)) {
    skipped++;
    continue;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBuf, iv);
  const ciphertext = Buffer.concat([cipher.update(row.value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const encrypted = `${PREFIX}${iv.toString("hex")}:${ciphertext.toString("hex")}:${tag.toString("hex")}`;

  const { error: upErr } = await db.from("app_settings")
    .update({ value: encrypted, updated_at: new Date().toISOString() })
    .eq("key", row.key);

  if (upErr) {
    console.error(`Failed to encrypt key=${row.key}:`, upErr.message);
  } else {
    console.log(`Encrypted: ${row.key}`);
    migrated++;
  }
}

console.log(`\nDone. Encrypted: ${migrated}, Skipped: ${skipped}`);
