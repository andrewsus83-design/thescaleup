import { SealKeyMissing, seal } from "../field-crypto";

// The two CRM fields that hold free text about a person, wrapped on the way into the database (see field-crypto.ts).

export type Sealed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Runs a sealing step and turns "the server has no key" into a message for the person. Any other failure is a bug and is thrown. */
export function trySeal<T>(fn: () => T): Sealed<T> {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    if (e instanceof SealKeyMissing) return { ok: false, error: e.message };
    throw e;
  }
}

export const sealSummary = (brandId: string, text: string): string => seal(brandId, "crm_people.summary", text);
export const sealNote = (brandId: string, text: string): string => seal(brandId, "crm_notes.body", text);
