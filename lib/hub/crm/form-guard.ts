import { createHmac, timingSafeEqual } from "node:crypto";

// Two cheap checks that keep scripts from flooding a public form. The form page is stamped with the time it was made, signed with the
// workspace key; a real person takes a few seconds to fill it in, a script does not. Server code only.

const sig = (formId: string, t: string, key: Buffer) => createHmac("sha256", key).update(`form:${formId}:${t}`).digest("base64url").slice(0, 32);

export function issueStamp(formId: string, key: Buffer, now: number = Date.now()): string {
  const t = String(Math.floor(now));
  return `${t}.${sig(formId, t, key)}`;
}

/** How old the stamp is in milliseconds, or null when it is missing, forged, or from another form. */
export function stampAge(formId: string, stamp: string, key: Buffer, now: number = Date.now()): number | null {
  const [t, s] = stamp.split(".");
  if (!t || !s || !/^\d{10,15}$/.test(t)) return null;
  const want = Buffer.from(sig(formId, t, key));
  const got = Buffer.from(s);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const age = now - Number(t);
  return Number.isFinite(age) ? age : null;
}

/** The visitor's connection as an opaque string, never an address. */
export function connectionKey(forwarded: string | null, formId: string, key: Buffer | null): string {
  const ip = (forwarded ?? "").split(",")[0].trim().slice(0, 64);
  if (!ip) return "";
  return createHmac("sha256", key ?? Buffer.from(formId)).update(`ip:${formId}:${ip}`).digest("hex").slice(0, 32);
}

export const STAMP_MIN_MS = 3_000;
export const STAMP_MAX_MS = 6 * 60 * 60 * 1000;
