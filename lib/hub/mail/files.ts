// Pure rules for files attached to a message: how many, how big, which names, and where they live in the bucket. No I/O.

/** Resend refuses a message over 40 MB after encoding, and encoding adds a third, so 25 MB of files is the safe ceiling. */
export const ATTACH_LIMITS = { files: 10, bytes: 25 * 1024 * 1024 } as const;

// Programs and scripts: mail providers reject them, and nobody should be opening them from a CRM.
const BLOCKED = new Set(["exe", "bat", "cmd", "com", "scr", "msi", "dll", "jar", "js", "jse", "vbs", "vbe", "wsf", "ps1", "lnk", "reg", "apk", "app", "dmg", "iso", "sh"]);

export const extOf = (name: string) => {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
};

/** A name that is safe in a header, a URL and a path: no slashes, no control characters, at most 120 characters. The ending is kept. */
export function safeFilename(raw: string): string {
  const base = raw.replace(/[\u0000-\u001f\u007f]/g, "").replace(/[\\/]+/g, "_").replace(/["<>:|?*]/g, "_").replace(/\s+/g, " ").trim().replace(/^\.+/, "");
  if (!base) return "file";
  if (base.length <= 120) return base;
  const ext = extOf(base);
  const tail = ext ? `.${ext.slice(0, 10)}` : "";
  return `${base.slice(0, 120 - tail.length)}${tail}`;
}

/** An error to show, or null when a file of `size` bytes called `name` can be added to a message that already holds `count` files and `total` bytes. */
export function attachError(name: string, size: number, count: number, total: number): string | null {
  const label = name.length > 40 ? `${name.slice(0, 39)}…` : name;
  if (!Number.isFinite(size) || size <= 0) return `${label} is empty.`;
  if (BLOCKED.has(extOf(name))) return `${label}: this kind of file cannot be sent by email. Zip it first, or share a link.`;
  if (count >= ATTACH_LIMITS.files) return `Up to ${ATTACH_LIMITS.files} files per message.`;
  if (total + size > ATTACH_LIMITS.bytes) return `${label} does not fit: a message can carry up to ${ATTACH_LIMITS.bytes / 1024 / 1024} MB of files in total.`;
  return null;
}

/** Where a file is kept. The id makes it unique, the brand keeps one tenant's files apart from another's. */
export const storageKey = (brandId: string, id: string, filename: string) => `mail/${brandId}/${id}/${safeFilename(filename)}`;

export const sizeLabel = (n?: number | null) => (n ? (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`) : "");

// Shown in the browser instead of downloaded. SVG and HTML are left out on purpose: they can carry scripts.
const INLINE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]);
export const opensInBrowser = (contentType: string | null | undefined) => INLINE.has((contentType ?? "").toLowerCase());

/** The Content-Disposition value for a download link: the file name is encoded so it cannot break out of the header. */
export function dispositionFor(filename: string, contentType: string | null | undefined): string {
  const name = safeFilename(filename);
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/[\\"]/g, "_");
  return `${opensInBrowser(contentType) ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
