import { createHash, createHmac } from "node:crypto";

// AWS Signature Version 4 in query-string form ("presigned URL"). Cloudflare R2 speaks the S3 API, so this is all it takes to let the
// browser upload straight to the bucket, and to hand a short-lived download link to a person or to Resend. Pure: no I/O, so it is
// tested against the example in the AWS documentation.

const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data, "utf8").digest();
const sha256 = (data: string) => createHash("sha256").update(data, "utf8").digest("hex");

/** RFC 3986 encoding, which is what SigV4 asks for: everything except letters, digits and - _ . ~ */
export const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
/** A path with its slashes kept and every part encoded. */
export const encPath = (p: string) => p.split("/").map(enc).join("/");

export type PresignInput = {
  method: "GET" | "PUT" | "HEAD" | "DELETE";
  host: string;
  /** Already the full path as the service sees it, such as "/bucket/some/key.pdf". Not encoded. */
  path: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Seconds the link works for, 1 to 604800. */
  expires: number;
  now?: Date;
  /** Extra query parameters that become part of the signature, such as response-content-disposition. */
  query?: Record<string, string>;
};

const stamp = (d: Date) => d.toISOString().replace(/[:-]|\.\d{3}/g, "");

export function presignUrl(i: PresignInput): string {
  const at = stamp(i.now ?? new Date());
  const day = at.slice(0, 8);
  const scope = `${day}/${i.region}/s3/aws4_request`;
  const params: Record<string, string> = {
    ...i.query,
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${i.accessKeyId}/${scope}`,
    "X-Amz-Date": at,
    "X-Amz-Expires": String(Math.min(Math.max(Math.floor(i.expires), 1), 604_800)),
    "X-Amz-SignedHeaders": "host",
  };
  const query = Object.keys(params)
    .sort()
    .map((k) => `${enc(k)}=${enc(params[k])}`)
    .join("&");
  const uri = encPath(i.path);
  const canonical = [i.method, uri, query, `host:${i.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", at, scope, sha256(canonical)].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${i.secretAccessKey}`, day), i.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", key).update(toSign, "utf8").digest("hex");
  return `https://${i.host}${uri}?${query}&X-Amz-Signature=${signature}`;
}
