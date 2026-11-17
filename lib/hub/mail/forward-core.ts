// Copies the files of a message into the new, forwarded one. The sources differ (a received file is at Resend, a sent one is in
// storage), so everything that touches the outside world is passed in, and this is tested with fakes. No server-only import here.

import { randomUUID } from "node:crypto";
import { ATTACH_LIMITS, attachError, safeFilename, storageKey } from "./files";
import type { FileRef } from "./forward";

export type Source = { name: string; contentType: string; size: number | null; url: string };
export type Row = { id: string; filename: string; content_type: string; size: number; storage_key: string };
export type Deps = {
  /** Where to read the file from, or null when it is gone. */
  resolve(ref: FileRef): Promise<Source | null>;
  /** The bytes, or null when the download failed or the file is bigger than `max`. */
  download(url: string, max: number): Promise<Uint8Array | null>;
  upload(key: string, bytes: Uint8Array, contentType: string): Promise<boolean>;
  record(row: Row): Promise<boolean>;
  /** Removes a copy that was made: its object and its row. Must not fail when either is already gone. */
  forget(id: string, key: string): Promise<void>;
};

/**
 * Makes an unsent copy of each file (the same kind of row an upload makes), so the rest of sending treats them like files the
 * person attached. All or nothing: when one fails, the ones already copied are removed again.
 */
export async function copyForwarded(d: Deps, brandId: string, refs: readonly FileRef[], haveCount = 0): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const made: { id: string; key: string }[] = [];
  let total = 0;
  const fail = async (error: string) => {
    for (const m of made) await d.forget(m.id, m.key);
    return { ok: false as const, error };
  };
  for (const ref of refs) {
    const src = await d.resolve(ref);
    if (!src) return fail("A file of the original message is no longer available. Untick it, or try again.");
    const name = safeFilename(src.name || "file");
    const early = attachError(name, src.size ?? 1, haveCount + made.length, total);
    if (early) return fail(early);
    const bytes = await d.download(src.url, ATTACH_LIMITS.bytes - total);
    if (!bytes) return fail(`${name} could not be copied. Untick it, or try again.`);
    const bad = attachError(name, bytes.length, haveCount + made.length, total);
    if (bad) return fail(bad);
    const id = randomUUID();
    const key = storageKey(brandId, id, name);
    made.push({ id, key });
    if (!(await d.upload(key, bytes, src.contentType))) return fail(`${name} could not be copied. Untick it, or try again.`);
    if (!(await d.record({ id, filename: name, content_type: src.contentType, size: bytes.length, storage_key: key }))) return fail("Could not prepare the files. Try again.");
    total += bytes.length;
  }
  return { ok: true, ids: made.map((m) => m.id) };
}
