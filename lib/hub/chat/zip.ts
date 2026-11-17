// A small zip reader for the browser: lists a zip and reads text files out of it without loading the whole archive.
// WhatsApp on iPhone and Meta's data export both arrive as zip files. Only "stored" and "deflate" entries, and no zip64
// (archives over 4 GB), which covers these exports. Uses the browser's own DecompressionStream, so there is nothing to install.

export type ZipEntry = { name: string; size: number; csize: number; method: number; offset: number };

const u16 = (v: DataView, o: number) => v.getUint16(o, true);
const u32 = (v: DataView, o: number) => v.getUint32(o, true);

export async function listZip(file: Blob): Promise<ZipEntry[]> {
  const tailSize = Math.min(file.size, 65_557);
  const tail = new DataView(await file.slice(file.size - tailSize).arrayBuffer());
  let eocd = -1;
  for (let i = tailSize - 22; i >= 0; i--) if (u32(tail, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("That is not a zip file.");
  const count = u16(tail, eocd + 10);
  const dirSize = u32(tail, eocd + 12);
  const dirAt = u32(tail, eocd + 16);
  if (count === 0xffff || dirAt === 0xffffffff) throw new Error("That zip is too large to read here. Unzip it first and choose the files inside.");
  const dir = new DataView(await file.slice(dirAt, dirAt + dirSize).arrayBuffer());
  const out: ZipEntry[] = [];
  let p = 0;
  for (let n = 0; n < count && p + 46 <= dir.byteLength; n++) {
    if (u32(dir, p) !== 0x02014b50) break;
    const nameLen = u16(dir, p + 28);
    const extraLen = u16(dir, p + 30);
    const commentLen = u16(dir, p + 32);
    const bytes = new Uint8Array(dir.buffer, dir.byteOffset + p + 46, nameLen);
    out.push({ name: new TextDecoder("utf-8").decode(bytes), method: u16(dir, p + 10), csize: u32(dir, p + 20), size: u32(dir, p + 24), offset: u32(dir, p + 42) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** The text of one entry. */
export async function readZipText(file: Blob, e: ZipEntry): Promise<string> {
  const head = new DataView(await file.slice(e.offset, e.offset + 30).arrayBuffer());
  if (u32(head, 0) !== 0x04034b50) throw new Error("That zip looks damaged.");
  const start = e.offset + 30 + u16(head, 26) + u16(head, 28);
  const raw = file.slice(start, start + e.csize);
  if (e.method === 0) return raw.text();
  if (e.method !== 8) throw new Error("That zip uses a compression this page cannot read. Unzip it first.");
  const stream = raw.stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}
