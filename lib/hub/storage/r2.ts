import "server-only";
import { presignUrl } from "./sigv4";

// Cloudflare R2 through its S3 API, with presigned links only: the browser uploads straight to the bucket (so a file never passes
// through a Vercel function and its 4.5 MB request limit), and downloads are short-lived links. The bucket stays private.
// Needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET.

type Cfg = { host: string; bucket: string; accessKeyId: string; secretAccessKey: string };

/** A value as it was probably meant: trimmed, without the quotes people paste around it. */
const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["']+|["']+$/g, "").trim();

/**
 * Reads the four settings. When something is wrong the answer names the variable (never its value), so whoever manages the
 * workspace can fix it without guessing. A pasted endpoint such as https://<id>.r2.cloudflarestorage.com still yields the account id.
 */
function read(): { cfg: Cfg } | { problem: string } {
  const accountRaw = clean(process.env.R2_ACCOUNT_ID);
  if (!accountRaw) return { problem: "R2_ACCOUNT_ID is not set on the server." };
  const account = /[a-f0-9]{32}/i.exec(accountRaw)?.[0]?.toLowerCase();
  if (!account) return { problem: "R2_ACCOUNT_ID should be the 32-character account ID from Cloudflare." };
  const accessKeyId = clean(process.env.R2_ACCESS_KEY_ID);
  if (!accessKeyId) return { problem: "R2_ACCESS_KEY_ID is not set on the server." };
  const secretAccessKey = clean(process.env.R2_SECRET_ACCESS_KEY);
  if (!secretAccessKey) return { problem: "R2_SECRET_ACCESS_KEY is not set on the server." };
  const bucket = clean(process.env.R2_BUCKET);
  if (!bucket) return { problem: "R2_BUCKET is not set on the server." };
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) return { problem: "R2_BUCKET should be the bucket name only, such as thescaleup-assets." };
  return { cfg: { host: `${account}.r2.cloudflarestorage.com`, bucket, accessKeyId, secretAccessKey } };
}

function config(): Cfg | null {
  const r = read();
  return "cfg" in r ? r.cfg : null;
}

export const isR2Ready = () => config() !== null;

/** Why storage is not usable, in words that name the setting, or null when it is. */
export const r2Problem = (): string | null => {
  const r = read();
  return "problem" in r ? r.problem : null;
};

type Method = "GET" | "PUT" | "HEAD" | "DELETE";

/** A link that allows one request on one object for `seconds`. Null when storage is not set up. */
export function signedUrl(method: Method, key: string, seconds: number, query?: Record<string, string>): string | null {
  const c = config();
  if (!c) return null;
  return presignUrl({ method, host: c.host, path: `/${c.bucket}/${key}`, region: "auto", accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey, expires: seconds, query });
}

/** The size of an object in bytes, or null when it is not there (or storage cannot be reached). */
export async function objectSize(key: string): Promise<number | null> {
  const url = signedUrl("HEAD", key, 60);
  if (!url) return null;
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!res.ok) return null;
    const n = Number(res.headers.get("content-length"));
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Best effort: a file that cannot be deleted now is picked up by the cleanup later. */
export async function deleteObject(key: string): Promise<boolean> {
  const url = signedUrl("DELETE", key, 60);
  if (!url) return false;
  try {
    const res = await fetch(url, { method: "DELETE", signal: AbortSignal.timeout(10_000), cache: "no-store" });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}
