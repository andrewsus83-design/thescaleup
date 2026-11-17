// What a bulk change on the CRM list may be, shared by the page and the server action. No I/O.

export const BULK_OPS = ["stage", "follow", "tag_add", "tag_remove", "delete"] as const;
export type BulkOp = (typeof BULK_OPS)[number];

/** `ids`: people ticked on the page. `all`: everyone who matches the list's search and filters. */
export type BulkInput = {
  brandId: string;
  kind: string;
  op: BulkOp;
  /** stage: the stage key. follow: "clear" or a number of days. */
  arg: string;
  /** tag_add, tag_remove: the tags as typed, separated by commas. */
  tags?: string;
  ids?: string[];
  all?: { q: string; stage: string; due: boolean; tag: string; importId?: string | null };
};

export type BulkResult = { ok: true; changed: number } | { ok: false; error: string };
