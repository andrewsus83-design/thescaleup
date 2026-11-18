import { decrypt, encrypt, parseKey } from "./crypto";

// Encryption for free text kept in the hub's own tables (CRM notes and "about" text), so a copy of the database, a backup or a
// look in the Supabase dashboard shows scrambled text and not what was said about a customer. It uses the workspace key
// (SECRETS_KEY_<n>), so nothing new has to be set up.
//
// A stored value looks like `enc:v1:<key version>:<base64>`. A value without that start is older plain text and is read as it is,
// so turning this on never hides anything; the backfill then wraps what is already there. Each value is tied to the field and the
// brand it belongs to, so it cannot be copied onto another brand's row and still open.
//
// What this does not do: whoever holds the server's keys (the service role key and SECRETS_KEY_1 live in the same place) can read
// everything. It protects the database and its backups, not the running app.

export const SEALED_PREFIX = "enc:v1:";
export type SealedField = "crm_people.summary" | "crm_notes.body" | "hr_people.private" | "hr_people.pay" | "hr_settings.rules" | "hr_leave.note" | "hr_payslips.body";

/** Shown in place of text that could not be opened (a missing key or a damaged value). */
export const UNREADABLE = "(This text could not be decrypted.)";
export const SEAL_KEY_MISSING = "Saving this needs the workspace encryption key (SECRETS_KEY_1) on the server. Nothing was saved.";

/** The key is missing on the server: callers show SEAL_KEY_MISSING and save nothing. */
export class SealKeyMissing extends Error {
  constructor() {
    super(SEAL_KEY_MISSING);
    this.name = "SealKeyMissing";
  }
}

const currentVersion = () => Number(process.env.SECRETS_KEY_CURRENT || 1) || 1;
const keyFor = (version: number) => parseKey(process.env[`SECRETS_KEY_${version}`]);
const aadFor = (field: SealedField, brandId: string) => `${field}:${brandId}`;

export const isSealed = (value: string): boolean => value.startsWith(SEALED_PREFIX);

/** True when new text can be sealed. */
export function sealReady(): boolean {
  return keyFor(currentVersion()) !== null;
}

/** Wraps text. Empty text stays empty (nothing to hide). Throws SealKeyMissing when the server has no key: never saves plain text instead. */
export function seal(brandId: string, field: SealedField, plain: string): string {
  if (plain === "") return "";
  const version = currentVersion();
  const key = keyFor(version);
  if (!key) throw new SealKeyMissing();
  return `${SEALED_PREFIX}${version}:${encrypt(plain, key, aadFor(field, brandId))}`;
}

/** Opens text. Older plain text comes back as it is; a value that cannot be opened comes back as UNREADABLE (and is logged), never as scrambled text. */
export function open(brandId: string, field: SealedField, stored: string): string {
  if (!isSealed(stored)) return stored;
  const rest = stored.slice(SEALED_PREFIX.length);
  const dot = rest.indexOf(":");
  const version = Number(rest.slice(0, dot));
  const key = dot > 0 && Number.isInteger(version) && version > 0 ? keyFor(version) : null;
  if (!key) {
    console.error(`[field-crypto] no key for ${field} (version ${dot > 0 ? rest.slice(0, dot) : "?"})`);
    return UNREADABLE;
  }
  try {
    return decrypt(rest.slice(dot + 1), key, aadFor(field, brandId));
  } catch {
    console.error(`[field-crypto] could not open ${field}`);
    return UNREADABLE;
  }
}

/** The longest a sealed value can be for text of `max` characters (4 bytes each at worst), for database length checks. */
export function sealedLimit(max: number): number {
  const bytes = max * 4 + 12 + 16;
  return SEALED_PREFIX.length + 4 + Math.ceil(bytes / 3) * 4;
}
