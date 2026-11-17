import "server-only";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { UUID } from "../tasks/context";
import { copyForwarded, type Deps } from "./forward-core";
import type { FileRef } from "./forward";
import { getReceivedAttachment } from "./resend";
import { deleteObject, signedUrl } from "../storage/r2";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

const TYPE = /^[\w.+-]+\/[\w.+-]+$/;

/** Reads a response body but gives up as soon as it is bigger than `max`. */
async function readCapped(res: Response, max: number): Promise<Uint8Array | null> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return null;
  if (!res.body) return null;
  const chunks: Uint8Array[] = [];
  let n = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(n);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** The real thing for forwarding: sent files come from our storage, received ones from Resend, and the copies go to our storage. */
export function forwardDeps(admin: Admin, brandId: string, userId: string): Deps {
  return {
    async resolve(ref: FileRef) {
      if (!UUID.test(ref.messageId)) return null;
      const { data: m } = await admin.from("mail_messages").select("resend_id, direction, attachments").eq("brand_id", brandId).eq("id", ref.messageId).maybeSingle();
      const meta = Array.isArray(m?.attachments) ? (m.attachments as { id?: string; filename?: string | null; content_type?: string | null; size?: number | null }[]).find((a) => a.id === ref.attachmentId) : undefined;
      if (!m || !meta) return null;
      const contentType = typeof meta.content_type === "string" && TYPE.test(meta.content_type) && meta.content_type.length <= 100 ? meta.content_type.toLowerCase() : "application/octet-stream";
      const size = Number.isFinite(Number(meta.size)) && Number(meta.size) > 0 ? Number(meta.size) : null;
      if (m.direction === "out") {
        if (!UUID.test(ref.attachmentId)) return null;
        const { data: file } = await admin.from("mail_attachments").select("filename, content_type, storage_key").eq("brand_id", brandId).eq("message_id", ref.messageId).eq("id", ref.attachmentId).maybeSingle();
        const url = file ? signedUrl("GET", file.storage_key as string, 300) : null;
        return file && url ? { name: String(file.filename), contentType: String(file.content_type || contentType), size, url } : null;
      }
      if (!m.resend_id) return null;
      const got = await getReceivedAttachment(m.resend_id as string, ref.attachmentId);
      if (!got.ok) return null;
      const url = got.data.download_url;
      if (!url || !/^https:\/\//i.test(url)) return null;
      return { name: meta.filename || got.data.filename || "file", contentType, size, url };
    },
    async download(url, max) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(30_000), cache: "no-store" });
        return res.ok ? await readCapped(res, max) : null;
      } catch {
        return null;
      }
    },
    async upload(key, bytes, contentType) {
      const url = signedUrl("PUT", key, 300);
      if (!url) return false;
      try {
        const res = await fetch(url, { method: "PUT", body: bytes as unknown as BodyInit, headers: { "content-type": contentType }, signal: AbortSignal.timeout(60_000), cache: "no-store" });
        return res.ok;
      } catch {
        return false;
      }
    },
    async record(row) {
      const { error } = await admin.from("mail_attachments").insert({ ...row, brand_id: brandId, uploaded_by: userId });
      if (error) console.error("[mail] could not record a forwarded file:", error.message);
      return !error;
    },
    async forget(id, key) {
      await deleteObject(key);
      await admin.from("mail_attachments").delete().eq("id", id).eq("brand_id", brandId).is("message_id", null);
    },
  };
}

export { copyForwarded };
