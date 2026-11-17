// Reading ClickUp's replies and turning them into Wiki pages and tasks. No I/O: the API calls are in api.ts, the writes in the actions.
// Everything from ClickUp is treated as untrusted text: it is cut to size and checked the same way a typed page or task is.

import { dayIn } from "../tasks/dates";
import type { Priority, Stage } from "../tasks/model";
import { LIMITS, parseTags } from "../tasks/rules";
import { MAX, aiDefault, parsePage, type PageInput, type PageType } from "../wiki/model";

const o = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown, max = 500) => (typeof v === "string" ? v.slice(0, max) : typeof v === "number" ? String(v) : "");
/** A ClickUp id: letters, digits, dashes. Anything else is not used in an address. */
export const idOf = (v: unknown): string => {
  const s = str(v, 60);
  return /^[A-Za-z0-9_-]{1,60}$/.test(s) ? s : "";
};

// ---------------------------------------------------------------------------------------------- structure
export type CkWorkspace = { id: string; name: string };
export type CkList = { id: string; name: string; tasks: number; where: string };
export type CkSpace = { id: string; name: string };
export type CkDoc = { id: string; name: string; parentId: string; parentType: number };

export const parseWorkspaces = (j: unknown): CkWorkspace[] =>
  arr(o(j).teams).flatMap((t) => {
    const id = idOf(o(t).id);
    return id ? [{ id, name: str(o(t).name, 120) || id }] : [];
  });

export const parseSpaces = (j: unknown): CkSpace[] =>
  arr(o(j).spaces).flatMap((t) => {
    const id = idOf(o(t).id);
    return id ? [{ id, name: str(o(t).name, 120) || id }] : [];
  });

const listOf = (raw: unknown, where: string): CkList[] => {
  const id = idOf(o(raw).id);
  if (!id) return [];
  const n = Number(o(raw).task_count);
  return [{ id, name: str(o(raw).name, 120) || id, tasks: Number.isFinite(n) && n > 0 ? Math.floor(n) : 0, where }];
};

/** Folders of a space with their lists, flattened to lists labelled "Space / Folder". */
export function parseFolders(j: unknown, space: string): { folders: { id: string; name: string }[]; lists: CkList[] } {
  const folders: { id: string; name: string }[] = [];
  const lists: CkList[] = [];
  for (const f of arr(o(j).folders)) {
    const id = idOf(o(f).id);
    if (!id) continue;
    const name = str(o(f).name, 120) || id;
    folders.push({ id, name });
    for (const l of arr(o(f).lists)) lists.push(...listOf(l, `${space} / ${name}`));
  }
  return { folders, lists };
}

export const parseFolderless = (j: unknown, space: string): CkList[] => arr(o(j).lists).flatMap((l) => listOf(l, space));

/** One page of the Docs list, with the cursor for the next page (or null). */
export function parseDocs(j: unknown): { docs: CkDoc[]; next: string | null } {
  const root = o(j);
  const docs = arr(root.docs).flatMap((d): CkDoc[] => {
    const id = idOf(o(d).id);
    if (!id) return [];
    const parent = o(o(d).parent);
    const type = Number(parent.type);
    return [{ id, name: str(o(d).name, 200) || "Untitled", parentId: idOf(parent.id), parentType: Number.isFinite(type) ? type : 0 }];
  });
  const next = typeof root.next_cursor === "string" && root.next_cursor ? root.next_cursor.slice(0, 500) : null;
  return { docs, next };
}

export type CkPage = { id: string; parentId: string | null; name: string; content: string };

/** The pages of a Doc (nested or not) as one flat list, parents before children. */
export function flattenPages(j: unknown): CkPage[] {
  const out: CkPage[] = [];
  const walk = (list: unknown[], parent: string | null, depth: number) => {
    for (const p of list) {
      const id = idOf(o(p).id);
      if (!id || depth > 8 || out.length >= 200) continue;
      out.push({ id, parentId: parent ?? (idOf(o(p).parent_page_id) || null), name: str(o(p).name, 200), content: typeof o(p).content === "string" ? (o(p).content as string) : "" });
      walk(arr(o(p).pages), id, depth + 1);
    }
  };
  walk(Array.isArray(j) ? j : arr(o(j).pages), null, 0);
  return out;
}

// ---------------------------------------------------------------------------------------------- docs → Wiki
const TYPE_HINTS: [RegExp, PageType][] = [
  [/\b(sop|procedure|prosedur|playbook|checklist|how to|cara)\b/i, "sop"],
  [/\b(training|onboarding|lesson|course|curriculum|pelatihan)\b/i, "training"],
  [/\b(faq|frequently|pertanyaan)\b/i, "faq"],
  [/\b(vision|mission|values|constitution|brand|essence|philosophy|visi|misi|nilai)\b/i, "brand"],
  [/\b(product|produk|pricing|price|package|paket|service|layanan)\b/i, "product"],
  [/\b(customer|client|audience|persona|pelanggan)\b/i, "customer"],
  [/\b(research|competitor|market|riset|analysis|analisa)\b/i, "research"],
  [/\b(log|update|minutes|meeting|decision|changelog|weekly|monthly|laporan)\b/i, "update"],
  [/\b(role|roles|people|leadership|team|struktur|organization|organisation|jabatan)\b/i, "person"],
];

/** The Wiki type that best fits a page, from its title and where it sat in ClickUp. Falls back to "other". */
export function guessType(title: string, group: string): PageType {
  for (const [re, t] of TYPE_HINTS) if (re.test(title)) return t;
  for (const [re, t] of TYPE_HINTS) if (re.test(group)) return t;
  return "other";
}

/** "01B TES HQ Operations" → "01b tes hq operations": a tag is lower case, short, without odd characters. */
export const groupTag = (name: string) => name.toLowerCase().replace(/[<>"\\,]/g, " ").replace(/\s+/g, " ").trim().slice(0, 30).trim();

export type ImportedPage = { ok: true; value: PageInput } | { ok: false; reason: string };

/** A ClickUp page as a Wiki page input, checked like a typed page. A page that looks like it holds a password or key is refused, not edited. */
export function toWikiPage(p: { title: string; content: string; group: string; parentId: string | null; note?: string }): ImportedPage {
  const title = p.title.replace(/\s+/g, " ").trim().slice(0, MAX.title) || "Untitled";
  let body = p.content.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  const tooLong = body.length > MAX.body;
  if (tooLong) body = `${body.slice(0, MAX.body - 200).trimEnd()}\n\n(Shortened on import: the ClickUp page is longer than a Wiki page can be.)`;
  if (p.note) body = body ? `${body}\n\n${p.note}` : p.note;
  const tags = ["clickup", groupTag(p.group)].filter(Boolean).filter((t, i, a) => a.indexOf(t) === i).join(",");
  const checked = parsePage((k) => ({ title, summary: "", body, type: guessType(title, p.group), tags, parentId: p.parentId ?? "" }[k] ?? ""));
  if (checked.ok) return { ok: true, value: { ...checked.value, ai_readable: aiDefault(checked.value.type) } };
  return { ok: false, reason: /password|key/i.test(checked.error) ? "looks like it holds a password or key" : checked.error };
}

// ---------------------------------------------------------------------------------------------- tasks
export type CkTask = {
  id: string;
  name: string;
  description: string;
  status: string;
  statusType: string;
  priority: Priority;
  due: number | null;
  start: number | null;
  closed: number | null;
  assignees: string[];
  tags: string[];
  url: string;
  parentName: string;
};

const ms = (v: unknown): number | null => {
  const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 && n < 4_102_444_800_000 ? Math.floor(n) : null;
};

export function parseTasks(j: unknown): { tasks: CkTask[]; last: boolean } {
  const root = o(j);
  const tasks = arr(root.tasks).flatMap((t): CkTask[] => {
    const id = idOf(o(t).id);
    const name = str(o(t).name, 400).replace(/\s+/g, " ").trim();
    if (!id || !name) return [];
    const st = o(o(t).status);
    const pr = str(o(o(t).priority).priority, 20).toLowerCase();
    const url = str(o(t).url, 300);
    return [
      {
        id,
        name,
        description: str(o(t).markdown_description, 20_000) || str(o(t).text_content, 20_000) || str(o(t).description, 20_000),
        status: str(st.status, 80),
        statusType: str(st.type, 20).toLowerCase(),
        priority: pr === "urgent" || pr === "high" || pr === "low" ? pr : "normal",
        due: ms(o(t).due_date),
        start: ms(o(t).start_date),
        closed: ms(o(t).date_closed),
        assignees: arr(o(t).assignees).map((a) => str(o(a).email, 254).toLowerCase()).filter(Boolean),
        tags: arr(o(t).tags).map((g) => str(o(g).name, 60)).filter(Boolean),
        url: /^https:\/\/app\.clickup\.com\//.test(url) ? url : "",
        parentName: "",
      },
    ];
  });
  return { tasks, last: root.last_page === true || tasks.length === 0 };
}

/** Which stage of the brand's workflow a ClickUp status belongs to: done or closed → closed, review-like names → review, the rest → active. */
export function stageForStatus(status: string, type: string): Extract<Stage, "active" | "review" | "closed"> {
  if (type === "done" || type === "closed") return "closed";
  if (/\b(review|qa|testing|approval|check|verify|revisi|tinjau)\b/i.test(status)) return "review";
  return "active";
}

export type TaskRow = {
  title: string;
  description: string | null;
  priority: Priority;
  assignee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  tags: string[];
  stage: "active" | "review" | "closed";
  completed_at: string | null;
};

/** A ClickUp task as the row to insert. Assignees are matched to the brand's people by email; the rest are named in the description. */
export function toTaskRow(t: CkTask, ctx: { tz: string; listName: string; emails: ReadonlyMap<string, string> }): TaskRow {
  let assignee: string | null = null;
  const unmatched: string[] = [];
  for (const e of t.assignees) {
    const id = ctx.emails.get(e);
    if (id && !assignee) assignee = id;
    else if (!id) unmatched.push(e);
  }
  const due = t.due ? dayIn(ctx.tz, new Date(t.due)) : null;
  let start = t.start ? dayIn(ctx.tz, new Date(t.start)) : null;
  if (start && due && start > due) start = null;
  const foot = [`Imported from ClickUp, list "${ctx.listName}".`, t.url, t.status ? `ClickUp status: ${t.status}.` : "", unmatched.length ? `ClickUp assignees without a login here: ${unmatched.join(", ")}.` : ""].filter(Boolean).join("\n");
  const body = t.description.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  const room = LIMITS.description - foot.length - 4;
  const description = `${body.length > room ? `${body.slice(0, Math.max(0, room - 1))}…` : body}${body ? "\n\n" : ""}${foot}`.slice(0, LIMITS.description);
  const stage = stageForStatus(t.status, t.statusType);
  const tags = parseTags(["clickup", ...t.tags.map((g) => g.toLowerCase()), groupTag(ctx.listName)].join(","));
  return {
    title: t.name.slice(0, LIMITS.title),
    description,
    priority: t.priority,
    assignee_id: assignee,
    start_date: start,
    due_date: due,
    tags,
    stage,
    completed_at: stage === "closed" && t.closed ? new Date(t.closed).toISOString() : null,
  };
}

// ---------------------------------------------------------------------------------------------- what the screen and the actions pass around
export type ScanDoc = { id: string; name: string; where: string };
export type Scan = {
  ok: true;
  workspace: CkWorkspace;
  workspaces: CkWorkspace[];
  lists: CkList[];
  docs: ScanDoc[];
  docsMore: boolean;
  already: { pages: number; tasks: number };
};
export type Failure = { ok: false; error: string };
export type DocsDone = { ok: true; pages: number; skipped: number; empty: number; refused: { name: string; reason: string }[] };
export type TasksDone = { ok: true; imported: number; skipped: number; last: boolean };

/** What the browser sends back for a Doc: only ids and labels it was shown. Anything else is dropped. */
export function readDocRefs(raw: unknown): ScanDoc[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 5).flatMap((d): ScanDoc[] => {
    const id = idOf(o(d).id);
    return id ? [{ id, name: str(o(d).name, 200) || "Untitled", where: str(o(d).where, 120) }] : [];
  });
}

/** Where a Doc sat in ClickUp, as a label: "Space / Folder" when we know both, the Space when we know that, else "Workspace". */
export function docWhere(d: CkDoc, labels: { spaces: ReadonlyMap<string, string>; folders: ReadonlyMap<string, string>; lists: ReadonlyMap<string, string> }): string {
  if (d.parentType === 4) return labels.spaces.get(d.parentId) ?? "Space";
  if (d.parentType === 5) return labels.folders.get(d.parentId) ?? "Folder";
  if (d.parentType === 6) return labels.lists.get(d.parentId) ?? "List";
  return "Workspace";
}

// ---------------------------------------------------------------------------------------------- planning a Doc's import
export type DocShape = { keep: CkPage[]; single: boolean; empty: number; externals: string[] };

/** Which pages of a Doc are worth importing (those with text, or with pages beneath them), and the outside ids they will be remembered by. */
export function shapeDoc(docId: string, all: readonly CkPage[]): DocShape {
  const hasChild = new Set(all.map((p) => p.parentId).filter((v): v is string => !!v));
  const keep = all.filter((p) => p.content.trim() || hasChild.has(p.id));
  const single = keep.length === 1 && !hasChild.has(keep[0].id);
  const externals = !keep.length ? [] : single ? [`${docId}:${keep[0].id}`] : [`${docId}:root`, ...keep.map((p) => `${docId}:${p.id}`)];
  return { keep, single, empty: all.length - keep.length, externals };
}

export type DocPlan = {
  fresh: { id: string; input: PageInput }[];
  refs: { external_id: string; page_id: string }[];
  skipped: number;
  refused: { name: string; reason: string }[];
};

/**
 * What to create for one Doc, given which of its pages are already here (`have`: outside id → Wiki page id). A Doc with one
 * page is one Wiki page. A Doc with several gets a page of its own with the pages beneath it, nested as they were. A page that
 * is refused takes none of its children with it: they move up to its parent.
 */
export function planDoc(doc: { id: string; name: string; where: string }, shape: DocShape, have: ReadonlyMap<string, string | null>, newId: () => string): DocPlan {
  const plan: DocPlan = { fresh: [], refs: [], skipped: 0, refused: [] };
  if (!shape.keep.length) return plan;
  let rootId: string | null = null;
  if (!shape.single) {
    const existing = have.get(`${doc.id}:root`);
    if (existing) rootId = existing;
    else {
      const root = toWikiPage({ title: doc.name, content: "", group: doc.where, parentId: null, note: `Imported from the ClickUp Doc "${doc.name}". Its ${shape.keep.length} pages are below.` });
      if (!root.ok) {
        plan.refused.push({ name: doc.name, reason: root.reason });
        return plan;
      }
      rootId = newId();
      plan.fresh.push({ id: rootId, input: root.value });
      plan.refs.push({ external_id: `${doc.id}:root`, page_id: rootId });
    }
  }
  const resolved = new Map<string, string | null>(); // ClickUp page id → Wiki page id (or the nearest ancestor that exists)
  for (const p of shape.keep) {
    const external = `${doc.id}:${p.id}`;
    const existing = have.get(external);
    if (existing) {
      resolved.set(p.id, existing);
      plan.skipped++;
      continue;
    }
    const parent = p.parentId ? (resolved.get(p.parentId) ?? rootId) : rootId;
    const title = shape.single ? doc.name : p.name || "Untitled";
    const content = shape.single && p.name && p.name !== doc.name ? `# ${p.name}\n\n${p.content}` : p.content;
    const page = toWikiPage({ title, content, group: doc.where, parentId: parent });
    if (!page.ok) {
      plan.refused.push({ name: title, reason: page.reason });
      resolved.set(p.id, parent);
      continue;
    }
    const id = newId();
    resolved.set(p.id, id);
    plan.fresh.push({ id, input: page.value });
    plan.refs.push({ external_id: external, page_id: id });
  }
  return plan;
}
