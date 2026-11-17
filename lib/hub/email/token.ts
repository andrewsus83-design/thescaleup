// Node only (it uses node:crypto): never import this from a client component.
import { createHmac, timingSafeEqual } from "node:crypto";
import { isEmail } from "../mail/model";

// ---------------------------------------------------------------------------------------------- unsubscribe links
// A signed link needs no database lookup and cannot be guessed or changed to unsubscribe someone else.
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function signUnsubscribe(secret: Buffer, brandId: string, email: string): string {
  const payload = b64(JSON.stringify([brandId, email.toLowerCase()]));
  return `${payload}.${b64(createHmac("sha256", secret).update(`unsub:${payload}`).digest())}`;
}

export function verifyUnsubscribe(secret: Buffer, token: string): { brandId: string; email: string } | null {
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined || token.length > 700) return null;
  const want = createHmac("sha256", secret).update(`unsub:${payload}`).digest();
  let got: Buffer;
  try {
    got = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const v = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    if (!Array.isArray(v) || typeof v[0] !== "string" || typeof v[1] !== "string" || !isEmail(v[1])) return null;
    return { brandId: v[0], email: v[1].toLowerCase() };
  } catch {
    return null;
  }
}
