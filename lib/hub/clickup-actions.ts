"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDocPages, getListTasks, listDocs, listSpaceLists, listSpaces, listWorkspaces } from "./clickup/api";
import { insertPages } from "./clickup/insert";
import { docWhere, idOf, isDestination, planDoc, readDocRefs, shapeDoc, toContentRow, toLeadRow, toTaskRow, type DocsDone, type Failure, type Scan, type TasksDone } from "./clickup/model";
import { getStages } from "./crm/data";
import { allow } from "./ratelimit";
import { canManageTeam } from "./rules";
import { getBrandKey } from "./secrets";
import { audit } from "./session";
import { taskContext, type Ctx } from "./tasks/context";
import { getWorkflow, listMembers } from "./tasks/data";
import { hubTz } from "./tasks/dates";
import { startStatus, statusForStage } from "./tasks/rules";

// Moving a brand's ClickUp over, once, by hand. Read only on ClickUp's side: nothing is written back. The token is the brand's
// own (Settings → Import) and is only ever used here, on the server. Only the owner or founder can run it. The browser drives
// it in small batches (a few Docs, or one page of 100 tasks, per call) so no call runs long, and every batch skips what an
// earlier run already brought over (import_refs), so a second run only adds what is new.

const NOT_READY = "The importer needs its database step first (20261117270000_import_refs.sql). Ask the person who runs the database updates.";
const NO_TOKEN = "Save the ClickUp token first (above), then try again.";

async function importContext(brandId: unknown): Promise<{ ok: true; ctx: Ctx; token: string } | Failure> {
  const c = await taskContext(brandId, "brand");
  if (!c.ok) return c;
  if (!canManageTeam(c.ctx.actor)) return { ok: false, error: "Only the owner or founder can import from ClickUp." };
  const token = await getBrandKey(c.ctx.brandId, "clickup", false);
  if (!token) return { ok: false, error: NO_TOKEN };
  return { ok: true, ctx: c.ctx, token };
}

const refresh = (slug: string) => revalidatePath(`/hub/b/${slug}`, "layout");

type RefKind = "doc_page" | "task" | "lead" | "content";
const REF_COLUMN: Record<RefKind, "page_id" | "task_id" | "person_id" | "content_id"> = { doc_page: "page_id", task: "task_id", lead: "person_id", content: "content_id" };

/** Which of these outside ids were already brought over, and the id of what they became. Null when the table is not there yet. */
async function known(ctx: Ctx, kind: RefKind, ids: string[]): Promise<Map<string, string | null> | null> {
  if (!ids.length) return new Map();
  const col = REF_COLUMN[kind];
  const { data, error } = await ctx.admin.from("import_refs").select(`external_id, ${col}`).eq("brand_id", ctx.brandId).eq("source", "clickup").eq("kind", kind).in("external_id", ids);
  if (error) {
    console.error("[clickup] import_refs not ready:", error.message);
    return null;
  }
  return new Map((data ?? []).map((r) => [(r as unknown as Record<string, string>).external_id, ((r as unknown as Record<string, string | null>)[col]) ?? null]));
}

// ---------------------------------------------------------------------------------------------- scan
/** Reads the shape of the ClickUp workspace (spaces, lists, Docs) and how much of it is already here. Changes nothing. */
export async function scanClickUp(brandId: string, workspaceId?: string): Promise<Scan | Failure> {
  const c = await importContext(brandId);
  if (!c.ok) return c;
  const { ctx, token } = c;
  if (!allow(`clickup-scan:${ctx.user.id}`, 20)) return { ok: false, error: "That is a lot of scans in an hour. Try again later." };
  const probe = await ctx.admin.from("import_refs").select("external_id").eq("brand_id", ctx.brandId).limit(1);
  if (probe.error) return { ok: false, error: NOT_READY };

  const ws = await listWorkspaces(token);
  if (!ws.ok) return ws;
  if (!ws.data.length) return { ok: false, error: "This token does not see any ClickUp workspace." };
  const wanted = typeof workspaceId === "string" ? idOf(workspaceId) : "";
  const workspace = ws.data.find((w) => w.id === wanted) ?? ws.data[0];

  const spaces = await listSpaces(token, workspace.id);
  if (!spaces.ok) return spaces;
  const perSpace = await Promise.all(spaces.data.slice(0, 40).map((s) => listSpaceLists(token, s.id, s.name)));
  const failed = perSpace.find((r) => !r.ok);
  if (failed && !failed.ok) return failed;

  const lists = perSpace.flatMap((r) => (r.ok ? r.data.lists : []));
  const labels = {
    spaces: new Map(spaces.data.map((s) => [s.id, s.name] as const)),
    folders: new Map(perSpace.flatMap((r, i) => (r.ok ? r.data.folders.map((f) => [f.id, `${spaces.data[i].name} / ${f.name}`] as const) : []))),
    lists: new Map(lists.map((l) => [l.id, l.where === "" ? l.name : `${l.where} / ${l.name}`] as const)),
  };
  const docs = await listDocs(token, workspace.id);
  if (!docs.ok) return docs;

  const [pages, tasks] = await Promise.all([
    ctx.admin.from("import_refs").select("external_id", { count: "exact", head: true }).eq("brand_id", ctx.brandId).eq("source", "clickup").eq("kind", "doc_page"),
    ctx.admin.from("import_refs").select("external_id", { count: "exact", head: true }).eq("brand_id", ctx.brandId).eq("source", "clickup").in("kind", ["task", "lead", "content"]),
  ]);
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "import.clickup.scan", target: workspace.name.slice(0, 80), meta: { lists: lists.length, docs: docs.data.docs.length } });
  return {
    ok: true,
    workspace,
    workspaces: ws.data,
    lists,
    docs: docs.data.docs.map((d) => ({ id: d.id, name: d.name, where: docWhere(d, labels) })),
    docsMore: docs.data.more,
    already: { pages: pages.count ?? 0, tasks: tasks.count ?? 0 },
  };
}

// ---------------------------------------------------------------------------------------------- Docs → Wiki
/**
 * Brings up to five Docs over. A Doc with one page becomes one Wiki page. A Doc with several pages becomes a page for the Doc
 * with its pages beneath it, nested the way they were. Empty pages are left out. A page that looks like it holds a password or
 * key is not imported (it is named in the result, so someone can decide what to do with it).
 */
export async function importDocs(brandId: string, workspaceId: string, rawDocs: unknown): Promise<DocsDone | Failure> {
  const c = await importContext(brandId);
  if (!c.ok) return c;
  const { ctx, token } = c;
  const ws = idOf(workspaceId);
  const docs = readDocRefs(rawDocs);
  if (!ws || !docs.length) return { ok: false, error: "Nothing to import." };
  if (!allow(`clickup-docs:${ctx.brandId}`, 400)) return { ok: false, error: "That is a lot of importing in an hour. Try again later." };

  const out: DocsDone = { ok: true, pages: 0, skipped: 0, empty: 0, refused: [] };
  for (const doc of docs) {
    const got = await getDocPages(token, ws, doc.id);
    if (!got.ok) return got;
    const shape = shapeDoc(doc.id, got.data);
    out.empty += shape.empty;
    if (!shape.keep.length) continue;
    const have = await known(ctx, "doc_page", shape.externals);
    if (!have) return { ok: false, error: NOT_READY };
    const { fresh, refs, skipped, refused } = planDoc(doc, shape, have, randomUUID);
    out.skipped += skipped;
    out.refused.push(...refused);

    if (!fresh.length) continue;
    const saved = await insertPages(ctx.admin, ctx.brandId, ctx.user.id, fresh);
    if (!saved.ok) return saved;
    const { error } = await ctx.admin.from("import_refs").insert(refs.map((r) => ({ ...r, brand_id: ctx.brandId, source: "clickup", kind: "doc_page" })));
    if (error) {
      console.error("[clickup] refs insert failed:", error.message);
      await ctx.admin.from("wiki_pages").delete().eq("brand_id", ctx.brandId).in("id", fresh.map((f) => f.id)); // undo, so a retry does not make copies
      return { ok: false, error: "Could not record what was imported. Nothing was kept for this Doc. Try again." };
    }
    out.pages += fresh.length;
  }
  if (out.pages) {
    await audit({ actor: ctx.user, brandId: ctx.brandId, action: "import.clickup.docs", meta: { pages: out.pages, skipped: out.skipped, refused: out.refused.length } });
    refresh(ctx.slug);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- lists → Tasks, CRM or Content
/**
 * Brings one page (up to 100) of a list over, to where the person sent that list.
 *  - Tasks: each task goes into the brand's workflow status that matches its stage (done → closed, review-like → review, the
 *    rest → active), approved by whoever ran the import. People are matched to the team by email; the others are named in the
 *    description.
 *  - CRM leads: each becomes a lead in the first stage (a won, finished one becomes a client). Nothing from the funnel
 *    automations runs: an import must not create a task for every lead.
 *  - Content plan: each becomes a piece, planned for its due date.
 * `last` tells the caller to stop asking for pages.
 */
export async function importList(brandId: string, listId: string, listName: string, page: number, includeClosed: boolean, destination: string): Promise<TasksDone | Failure> {
  const c = await importContext(brandId);
  if (!c.ok) return c;
  const { ctx, token } = c;
  const list = idOf(listId);
  if (!list || !isDestination(destination) || destination === "skip") return { ok: false, error: "Nothing to import." };
  if (!allow(`clickup-tasks:${ctx.brandId}`, 600)) return { ok: false, error: "That is a lot of importing in an hour. Try again later." };

  const got = await getListTasks(token, list, Number.isInteger(page) ? page : 0, includeClosed === true);
  if (!got.ok) return got;
  const { tasks, last } = got.data;
  const refKind: RefKind = destination === "leads" ? "lead" : destination === "content" ? "content" : "task";
  const have = await known(ctx, refKind, tasks.map((t) => t.id));
  if (!have) return { ok: false, error: NOT_READY };
  const fresh = tasks.filter((t) => !have.has(t.id));
  if (!fresh.length) return { ok: true, imported: 0, skipped: tasks.length, refused: 0, last };

  const tz = hubTz();
  const name = listName.replace(/\s+/g, " ").trim().slice(0, 120) || "ClickUp";
  const now = new Date().toISOString();
  const rows: { id: string; ext: string; row: Record<string, unknown> }[] = [];
  let refused = 0;

  if (destination === "tasks") {
    const [workflow, members] = await Promise.all([getWorkflow(ctx.brandId), listMembers(ctx.brandId)]);
    const fallback = startStatus(workflow, ctx.actor)?.status ?? null;
    const statusOf = (stage: "active" | "review" | "closed") => statusForStage(workflow, stage) ?? statusForStage(workflow, "active") ?? fallback;
    if (!statusOf("active")) return { ok: false, error: "This brand's workflow has no status to put tasks in. Check Settings." };
    const emails = new Map(members.map((m) => [m.email.toLowerCase(), m.userId] as const));
    for (const t of fresh) {
      const { stage, ...rest } = toTaskRow(t, { tz, listName: name, emails }); // the database copies the stage from the status; it is never sent
      rows.push({ id: randomUUID(), ext: t.id, row: { ...rest, brand_id: ctx.brandId, status: statusOf(stage), source: "import", created_by: ctx.user.id, approved_by: ctx.user.id, approved_at: now } });
    }
  } else if (destination === "leads") {
    const stages = await getStages(ctx.brandId);
    for (const t of fresh) {
      const r = toLeadRow(t, { tz, listName: name, stages });
      if (!r.ok) {
        refused++;
        continue;
      }
      rows.push({ id: randomUUID(), ext: t.id, row: { ...r.value, brand_id: ctx.brandId, created_by: ctx.user.id, converted_at: r.value.kind === "client" ? now : null } });
    }
  } else {
    for (const t of fresh) {
      const r = toContentRow(t, { tz, listName: name });
      if (!r.ok) {
        refused++;
        continue;
      }
      rows.push({ id: randomUUID(), ext: t.id, row: { ...r.value, brand_id: ctx.brandId, source: "manual", created_by: ctx.user.id } });
    }
  }
  if (!rows.length) return { ok: true, imported: 0, skipped: tasks.length - refused, refused, last };

  const table = destination === "leads" ? "crm_people" : destination === "content" ? "content_items" : "tasks";
  const ins = await ctx.admin.from(table).insert(rows.map((r) => ({ ...r.row, id: r.id })));
  if (ins.error) {
    console.error(`[clickup] ${table} insert failed:`, ins.error.message);
    return { ok: false, error: "Could not save them. Try again." };
  }
  const col = REF_COLUMN[refKind];
  const refs = await ctx.admin.from("import_refs").insert(rows.map((r) => ({ brand_id: ctx.brandId, source: "clickup", kind: refKind, external_id: r.ext, [col]: r.id })));
  if (refs.error) {
    console.error("[clickup] refs insert failed:", refs.error.message);
    await ctx.admin.from(table).delete().eq("brand_id", ctx.brandId).in("id", rows.map((r) => r.id)); // undo, so a retry does not make copies
    return { ok: false, error: "Could not record what was imported. Nothing was kept for this page. Try again." };
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: `import.clickup.${destination}`, target: name.slice(0, 80), meta: { imported: rows.length, skipped: tasks.length - rows.length - refused, refused } });
  refresh(ctx.slug);
  return { ok: true, imported: rows.length, skipped: tasks.length - rows.length - refused, refused, last };
}
