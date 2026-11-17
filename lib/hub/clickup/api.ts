import "server-only";
import { flattenPages, idOf, parseDocs, parseFolderless, parseFolders, parseSpaces, parseTasks, parseWorkspaces, type CkDoc, type CkList, type CkPage, type CkSpace, type CkTask, type CkWorkspace } from "./model";

// ClickUp's API, read only. One fixed host, the token goes in the Authorization header and nowhere else, and every id that
// ends up in an address has been checked by idOf. Errors say what to do; they never contain the token.

const HOST = "https://api.clickup.com";
const TIMEOUT_MS = 15_000;

export type Res<T> = { ok: true; data: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function explain(status: number): string {
  if (status === 401) return "ClickUp did not accept the token. Check it was copied whole (it starts with pk_) and has not been revoked.";
  if (status === 403) return "This token is not allowed to see that part of ClickUp.";
  if (status === 404) return "ClickUp has no such item. It may have been moved or deleted.";
  if (status === 429) return "ClickUp asked us to slow down. Wait a minute, then run it again: what was already imported is skipped.";
  if (status >= 500) return "ClickUp is having trouble right now. Try again in a few minutes.";
  return `ClickUp refused the request (${status}).`;
}

async function get(token: string, path: string, query: Record<string, string> = {}, retried = false): Promise<Res<unknown>> {
  const url = new URL(path, HOST);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  let r: Response;
  try {
    r = await fetch(url, { headers: { Authorization: token, Accept: "application/json" }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    console.error("[clickup] request failed:", path, e instanceof Error ? e.name : "error");
    return fail("Could not reach ClickUp. Try again.");
  }
  if (r.status === 429 && !retried) {
    const wait = Number(r.headers.get("retry-after"));
    await new Promise((res) => setTimeout(res, Number.isFinite(wait) && wait > 0 ? Math.min(wait, 8) * 1000 : 4000));
    return get(token, path, query, true);
  }
  if (!r.ok) {
    console.error("[clickup] status", r.status, path);
    return fail(explain(r.status));
  }
  try {
    return { ok: true, data: await r.json() };
  } catch {
    return fail("ClickUp sent something that is not readable. Try again.");
  }
}

const enc = (id: string) => encodeURIComponent(id);
const need = (id: string): string | null => (idOf(id) ? null : "That ClickUp id does not look right.");

export async function listWorkspaces(token: string): Promise<Res<CkWorkspace[]>> {
  const r = await get(token, "/api/v2/team");
  return r.ok ? { ok: true, data: parseWorkspaces(r.data) } : r;
}

export async function listSpaces(token: string, workspace: string): Promise<Res<CkSpace[]>> {
  const bad = need(workspace);
  if (bad) return fail(bad);
  const r = await get(token, `/api/v2/team/${enc(workspace)}/space`, { archived: "false" });
  return r.ok ? { ok: true, data: parseSpaces(r.data) } : r;
}

/** Every list of a space: the ones inside folders and the ones outside. */
export async function listSpaceLists(token: string, space: string, spaceName: string): Promise<Res<{ lists: CkList[]; folders: { id: string; name: string }[] }>> {
  const bad = need(space);
  if (bad) return fail(bad);
  const [f, l] = await Promise.all([get(token, `/api/v2/space/${enc(space)}/folder`, { archived: "false" }), get(token, `/api/v2/space/${enc(space)}/list`, { archived: "false" })]);
  if (!f.ok) return f;
  if (!l.ok) return l;
  const inFolders = parseFolders(f.data, spaceName);
  return { ok: true, data: { lists: [...parseFolderless(l.data, spaceName), ...inFolders.lists], folders: inFolders.folders } };
}

/** All Docs of a workspace, following the cursor. Stops at `cap` so a huge workspace cannot run away. */
export async function listDocs(token: string, workspace: string, cap = 500): Promise<Res<{ docs: CkDoc[]; more: boolean }>> {
  const bad = need(workspace);
  if (bad) return fail(bad);
  const docs: CkDoc[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 20; page++) {
    const r: Res<unknown> = await get(token, `/api/v3/workspaces/${enc(workspace)}/docs`, { limit: "100", ...(cursor ? { cursor } : {}) });
    if (!r.ok) return docs.length ? { ok: true, data: { docs, more: true } } : r;
    const got = parseDocs(r.data);
    docs.push(...got.docs);
    cursor = got.next;
    if (!cursor) return { ok: true, data: { docs, more: false } };
    if (docs.length >= cap) return { ok: true, data: { docs: docs.slice(0, cap), more: true } };
  }
  return { ok: true, data: { docs, more: true } };
}

/** The pages of one Doc as markdown, nested pages included. */
export async function getDocPages(token: string, workspace: string, doc: string): Promise<Res<CkPage[]>> {
  const bad = need(workspace) ?? need(doc);
  if (bad) return fail(bad);
  const r = await get(token, `/api/v3/workspaces/${enc(workspace)}/docs/${enc(doc)}/pages`, { max_page_depth: "-1", content_format: "text/md" });
  return r.ok ? { ok: true, data: flattenPages(r.data) } : r;
}

/** One page (up to 100) of a list's tasks, with markdown descriptions. */
export async function getListTasks(token: string, list: string, page: number, includeClosed: boolean): Promise<Res<{ tasks: CkTask[]; last: boolean }>> {
  const bad = need(list);
  if (bad) return fail(bad);
  const r = await get(token, `/api/v2/list/${enc(list)}/task`, {
    page: String(Math.max(0, Math.min(page, 500))),
    include_closed: includeClosed ? "true" : "false",
    subtasks: "true",
    include_markdown_description: "true",
  });
  return r.ok ? { ok: true, data: parseTasks(r.data) } : r;
}
