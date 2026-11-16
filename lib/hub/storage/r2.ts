import "server-only";
import { presignUrl } from "./sigv4";

// Cloudflare R2 through its S3 API, with presigned links only: the browser uploads straight to the bucket (so a file never passes
// through a Vercel function and its 4.5 MB request limit), and downloads are short-lived links. The bucket stays private.
// Needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET.

type Cfg = { host: string; bucket: string; accessKeyId: string; secretAccessKey: string };

function config(): Cfg | null {
  const account = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  if (!account || !accessKeyId || !secretAccessKey || !bucket) return null;
  if (!/^[a-f0-9]{32}$/i.test(account) || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) return null;
  return { host: `${account}.r2.cloudflarestorage.com`, bucket, accessKeyId, secretAccessKey };
}

export const isR2Ready = () => config() !== null;

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
