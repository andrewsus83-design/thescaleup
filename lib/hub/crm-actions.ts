"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "./actions";
import { NO_FILTER, countInStage, findIds, getRules, getStages, type PeopleFilter } from "./crm/data";
import { logStage, runRules } from "./crm/flow";
import { cleanImportRows, type ImportChunkResult } from "./crm/import";
import { BULK_OPS, type BulkInput, type BulkResult } from "./crm/bulk";
import { firstStage, followUpIn, isKind, isStageFor, parseNote, parsePerson, parseRulesInput, parseStagesInput, parseTags, pruneRules } from "./crm/model";
import { searchTerm } from "./mail/model";
import { atLeast } from "./permissions";
import { allow } from "./ratelimit";
import { canManageTeam } from "./rules";
import { audit } from "./session";
import { listMembers } from "./tasks/data";
import { hubTz, todayIn } from "./tasks/dates";
import { UUID, str, taskContext, type Ctx } from "./tasks/context";

const refresh = (slug: string) => revalidatePath(`/hub/b/${slug}`, "layout");

/** Who is asking and whether their CRM access lets them change things. */
async function editContext(brandId: unknown): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const c = await taskContext(brandId, "crm");
  if (!c.ok) return c;
  if (!atLeast(c.ctx.level, "edit")) return { ok: false, error: "You can see the CRM here but not change it." };
  return c;
}

/** Adds a lead or client (no `id`) or saves the details of one. A new one opens on its own page. */
export async function savePerson(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const parsed = parsePerson((k) => str(fd, k));
  if (!parsed.ok) return { error: parsed.error };
  const id = str(fd, "id");

  if (id) {
    if (!UUID.test(id)) return { error: "That person no longer exists." };
    const { data, error } = await ctx.admin.from("crm_people").update(parsed.value).eq("brand_id", ctx.brandId).eq("id", id).select("id").maybeSingle();
    if (error) {
      console.error("[crm] save failed:", error.message);
      return { error: "Could not save. Try again." };
    }
    if (!data) return { error: "That person no longer exists." };
    await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.update", target: id });
    refresh(ctx.slug);
    return { message: "Saved." };
  }

  const kind = str(fd, "kind");
  if (!isKind(kind)) return { error: "Pick lead or client." };
  if (!allow(`crm-add:${ctx.user.id}`, 300)) return { error: "That is a lot of people in an hour. Try again a bit later." };
  const start = firstStage(await getStages(ctx.brandId), kind);
  const { data, error } = await ctx.admin
    .from("crm_people")
    .insert({ brand_id: ctx.brandId, kind, stage: start, created_by: ctx.user.id, ...parsed.value })
    .select("id")
    .single();
  if (error) {
    console.error("[crm] add failed:", error.message);
    return { error: "Could not add them. Try again." };
  }
  await logStage(ctx, { personId: data.id, kind, from: null, to: start });
  await runRules(ctx, { id: data.id, kind, name: parsed.value.name, company: parsed.value.company }, start, { keepFollowUp: parsed.value.next_follow_up !== null });
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.create", target: data.id, meta: { kind } });
  refresh(ctx.slug);
  redirect(`/hub/b/${ctx.slug}/crm/${data.id}`);
}

/** Moves a lead or client to another stage of their own kind. */
export async function setStage(fd: FormData): Promise<void> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return;
  const { ctx } = c;
  const id = str(fd, "id");
  if (!UUID.test(id)) return;
  const { data: row } = await ctx.admin.from("crm_people").select("kind, stage, name, company").eq("brand_id", ctx.brandId).eq("id", id).maybeSingle();
  const stage = str(fd, "stage");
  if (!row || !isKind(row.kind) || row.stage === stage || !isStageFor(await getStages(ctx.brandId), row.kind, stage)) return;
  const { error } = await ctx.admin.from("crm_people").update({ stage }).eq("brand_id", ctx.brandId).eq("id", id);
  if (!error) {
    await logStage(ctx, { personId: id, kind: row.kind, from: row.stage, to: stage });
    await runRules(ctx, { id, kind: row.kind, name: String(row.name ?? ""), company: String(row.company ?? "") }, stage);
    await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.stage", target: id, meta: { stage } });
  }
  refresh(ctx.slug);
}

/** A lead who bought becomes a client. Their details and notes stay. */
export async function convertToClient(fd: FormData): Promise<void> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return;
  const { ctx } = c;
  const id = str(fd, "id");
  if (!UUID.test(id)) return;
  const { data: before } = await ctx.admin.from("crm_people").select("stage, name, company").eq("brand_id", ctx.brandId).eq("id", id).eq("kind", "lead").maybeSingle();
  if (!before) return;
  const start = firstStage(await getStages(ctx.brandId), "client");
  const { data, error } = await ctx.admin
    .from("crm_people")
    .update({ kind: "client", stage: start, converted_at: new Date().toISOString() })
    .eq("brand_id", ctx.brandId)
    .eq("id", id)
    .eq("kind", "lead")
    .select("id")
    .maybeSingle();
  if (!error && data) {
    await logStage(ctx, { personId: id, kind: "client", from: before.stage, to: start, converted: true });
    await runRules(ctx, { id, kind: "client", name: String(before.name ?? ""), company: String(before.company ?? "") }, start);
    await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.convert", target: id });
  }
  refresh(ctx.slug);
}

/** Sets the next follow-up a few days from today (`days` of 1 to 60), or clears it (`clear`). */
export async function setFollowUp(fd: FormData): Promise<void> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return;
  const { ctx } = c;
  const id = str(fd, "id");
  if (!UUID.test(id)) return;
  let next: string | null = null;
  if (str(fd, "clear") !== "1") {
    const days = Number(str(fd, "days"));
    if (!Number.isInteger(days) || days < 1 || days > 60) return;
    next = followUpIn(todayIn(hubTz()), days);
  }
  const { error } = await ctx.admin.from("crm_people").update({ next_follow_up: next }).eq("brand_id", ctx.brandId).eq("id", id);
  if (!error) await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.followup", target: id });
  refresh(ctx.slug);
}

/** Adds a note to the person's log and moves them to the top of the list. */
export async function addNote(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const id = str(fd, "id");
  if (!UUID.test(id)) return { error: "That person no longer exists." };
  const note = parseNote(str(fd, "body"));
  if (!note.ok) return { error: note.error };
  if (!allow(`crm-note:${ctx.user.id}`, 400)) return { error: "That is a lot of notes in an hour. Try again a bit later." };
  const { data: person } = await ctx.admin.from("crm_people").select("id").eq("brand_id", ctx.brandId).eq("id", id).maybeSingle();
  if (!person) return { error: "That person no longer exists." };
  const { error } = await ctx.admin.from("crm_notes").insert({ brand_id: ctx.brandId, person_id: id, body: note.value, author_id: ctx.user.id, author_label: ctx.user.email });
  if (error) {
    console.error("[crm] note failed:", error.message);
    return { error: "Could not add the note. Try again." };
  }
  await ctx.admin.from("crm_people").update({ updated_at: new Date().toISOString() }).eq("brand_id", ctx.brandId).eq("id", id);
  refresh(ctx.slug);
  return { message: "Note added." };
}

/** Removes a note: its author or a manager. */
export async function deleteNote(fd: FormData): Promise<void> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return;
  const { ctx } = c;
  const id = str(fd, "noteId");
  if (!UUID.test(id)) return;
  const { data: note } = await ctx.admin.from("crm_notes").select("author_id").eq("brand_id", ctx.brandId).eq("id", id).maybeSingle();
  if (!note || (note.author_id !== ctx.user.id && !canManageTeam(ctx.actor))) return;
  const { error } = await ctx.admin.from("crm_notes").delete().eq("brand_id", ctx.brandId).eq("id", id);
  if (!error) await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.note.delete", target: id });
  refresh(ctx.slug);
}

/** Removes a person and their notes. Managers only: it cannot be undone. */
export async function deletePerson(fd: FormData): Promise<void> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return;
  const { ctx } = c;
  if (!canManageTeam(ctx.actor)) return;
  const id = str(fd, "id");
  if (!UUID.test(id)) return;
  const { data } = await ctx.admin.from("crm_people").delete().eq("brand_id", ctx.brandId).eq("id", id).select("kind").maybeSingle();
  if (data) await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.delete", target: id });
  refresh(ctx.slug);
  redirect(data?.kind === "client" ? `/hub/b/${ctx.slug}/crm/clients` : `/hub/b/${ctx.slug}/crm`);
}

/** Saves the brand's own stages. Managers only. A stage that still has people in it cannot be removed. */
export async function saveStages(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  if (!canManageTeam(ctx.actor)) return { error: "Only a manager can change the stages." };
  const current = await getStages(ctx.brandId);
  const parsed = parseStagesInput(str(fd, "stages"), current);
  if (!parsed.ok) return { error: parsed.error };
  const kept = new Set(parsed.stages.map((s) => s.key));
  for (const gone of current.filter((s) => !kept.has(s.key))) {
    const n = await countInStage(ctx.brandId, gone.kind, gone.key);
    if (n > 0) return { error: `${n} ${n === 1 ? "person is" : "people are"} still in "${gone.label}". Move them to another stage first, then remove it.` };
  }
  if (!allow(`crm-stages:${ctx.user.id}`, 60)) return { error: "That is a lot of changes in an hour. Try again a bit later." };
  // Rules follow their stages: one for a stage that is gone (or no longer takes a follow-up) goes with it.
  const keptRules = pruneRules((await getRules(ctx.brandId)).rules, parsed.stages);
  const { error } = await ctx.admin.from("crm_workflows").upsert({ brand_id: ctx.brandId, stages: parsed.stages, rules: keptRules, updated_by: ctx.user.id, updated_at: new Date().toISOString() }, { onConflict: "brand_id" });
  if (error) {
    console.error("[crm] stages failed:", error.message);
    return { error: "Could not save the stages. Try again." };
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.stages", meta: { count: parsed.stages.length } });
  refresh(ctx.slug);
  return { message: "Stages saved." };
}

/** Saves what each stage does when someone enters it. Managers only. */
export async function saveRules(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  if (!canManageTeam(ctx.actor)) return { error: "Only a manager can change the automations." };
  const [stages, members] = await Promise.all([getStages(ctx.brandId), listMembers(ctx.brandId)]);
  const parsed = parseRulesInput(str(fd, "rules"), stages, new Set(members.map((m) => m.userId)));
  if (!parsed.ok) return { error: parsed.error };
  if (!allow(`crm-rules:${ctx.user.id}`, 60)) return { error: "That is a lot of changes in an hour. Try again a bit later." };
  const { error } = await ctx.admin.from("crm_workflows").upsert({ brand_id: ctx.brandId, stages, rules: parsed.rules, updated_by: ctx.user.id, updated_at: new Date().toISOString() }, { onConflict: "brand_id" });
  if (error) {
    console.error("[crm] rules failed:", error.message);
    return { error: "Could not save the automations. Try again." };
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.rules", meta: { count: parsed.rules.length } });
  refresh(ctx.slug);
  return { message: parsed.rules.length ? "Automations saved." : "Saved. No stage does anything on its own." };
}

const MISSING_SQL = "The CRM import needs a database update that has not been run yet.";
const sqlMissing = (code: string | undefined) => code === "PGRST202" || code === "42883" || code === "42P01" || code === "42703";

/** Starts an import: writes down the file and the tags it adds, and gives back the id its batches report to. */
export async function startPeopleImport(input: { brandId: string; kind: string; fileName: string; tags: string }): Promise<{ ok: true; importId: string } | { ok: false; error: string }> {
  const c = await editContext(input?.brandId);
  if (!c.ok) return { ok: false, error: c.error };
  const { ctx } = c;
  if (!isKind(input.kind)) return { ok: false, error: "Pick lead or client." };
  if (!allow(`crm-import-start:${ctx.user.id}`, 60)) return { ok: false, error: "That is a lot of importing in an hour. Try again a bit later." };
  const fileName = typeof input.fileName === "string" ? input.fileName.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 200) : "";
  const { data, error } = await ctx.admin.from("crm_imports").insert({ brand_id: ctx.brandId, kind: input.kind, file_name: fileName, tags: parseTags(typeof input.tags === "string" ? input.tags : ""), created_by: ctx.user.id }).select("id").single();
  if (error) {
    console.error("[crm] import start failed:", error.code, error.message);
    return { ok: false, error: sqlMissing(error.code) ? MISSING_SQL : "Could not start the import. Try again." };
  }
  return { ok: true, importId: data.id as string };
}

/**
 * One batch of an import from a spreadsheet. The rows are checked again here, then written in one go by the database, which leaves
 * out anyone already in the CRM. Stage automations are not run: a file of 2,000 leads would otherwise create 2,000 tasks.
 */
export async function importPeopleChunk(input: { brandId: string; importId: string; rows: unknown }): Promise<ImportChunkResult> {
  const c = await editContext(input?.brandId);
  if (!c.ok) return { ok: false, error: c.error };
  const { ctx } = c;
  if (typeof input.importId !== "string" || !UUID.test(input.importId)) return { ok: false, error: "This import was not started. Reload the page and try again." };
  const rows = cleanImportRows(input.rows);
  if (!rows) return { ok: false, error: "Some rows were not valid. Reload the page and try the file again." };
  if (!allow(`crm-import:${ctx.user.id}`, 300)) return { ok: false, error: "That is a lot of importing in an hour. Try again a bit later." };
  const { data: imp } = await ctx.admin.from("crm_imports").select("kind, tags, undone_at").eq("brand_id", ctx.brandId).eq("id", input.importId).maybeSingle();
  if (!imp || !isKind(imp.kind) || imp.undone_at) return { ok: false, error: "This import was not started or was already undone. Reload the page and try again." };
  const kind = imp.kind;
  // A stage the brand no longer has falls back to where new people start.
  const stages = await getStages(ctx.brandId);
  const start = firstStage(stages, kind);
  const prepared = rows.map((r) => ({ ...r, stage: isStageFor(stages, kind, r.stage) ? r.stage : start }));
  const tags = Array.isArray(imp.tags) ? (imp.tags as unknown[]).filter((t): t is string => typeof t === "string") : [];
  const { data, error } = await ctx.admin.rpc("crm_import_chunk", { p_brand: ctx.brandId, p_kind: kind, p_by: ctx.user.id, p_rows: prepared, p_import: input.importId, p_tags: tags });
  if (error) {
    console.error("[crm] import chunk failed:", error.code, error.message);
    return { ok: false, error: sqlMissing(error.code) ? MISSING_SQL : "Could not save these rows. Nothing from this batch was kept; try again." };
  }
  const row = Array.isArray(data) ? data[0] : data;
  const created = Number(row?.created ?? 0);
  const skipped = Number(row?.skipped ?? 0);
  if (created > 0) {
    await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.import", target: input.importId, meta: { kind, created, skipped } });
    refresh(ctx.slug);
  }
  return { ok: true, created, skipped };
}

/** Takes an import back: removes the people it added whom nobody has touched since. Managers only. */
export async function undoPeopleImport(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await editContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  if (!canManageTeam(ctx.actor)) return { error: "Only a manager can undo an import." };
  const id = str(fd, "importId");
  if (!UUID.test(id)) return { error: "That import no longer exists." };
  const { data, error } = await ctx.admin.rpc("crm_undo_import", { p_brand: ctx.brandId, p_import: id });
  if (error) {
    console.error("[crm] undo import failed:", error.code, error.message);
    return { error: error.code === "42501" ? "That import was already undone or no longer exists." : "Could not undo the import. Try again." };
  }
  const row = Array.isArray(data) ? data[0] : data;
  const removed = Number(row?.removed ?? 0);
  const kept = Number(row?.kept ?? 0);
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.import.undo", target: id, meta: { removed, kept } });
  refresh(ctx.slug);
  return { message: `Removed ${removed} ${removed === 1 ? "person" : "people"}.${kept > 0 ? ` ${kept} ${kept === 1 ? "was" : "were"} kept because someone has already worked on them.` : ""}` };
}

const BULK_PAGE = 2000;

/**
 * One change applied to many people: the ones ticked on the page (`ids`), or everyone who matches the list's search and filters
 * (`all`). Stage moves are written to the funnel log, but stage automations are not run (a move of 500 people would create 500 tasks).
 */
export async function bulkPeople(input: BulkInput): Promise<BulkResult> {
  const c = await editContext(input?.brandId);
  if (!c.ok) return { ok: false, error: c.error };
  const { ctx } = c;
  if (!isKind(input.kind)) return { ok: false, error: "Pick lead or client." };
  const kind = input.kind;
  if (!BULK_OPS.includes(input.op)) return { ok: false, error: "That change is not available." };
  const op = input.op;
  if (op === "delete" && !canManageTeam(ctx.actor)) return { ok: false, error: "Only a manager can delete people." };
  if (!allow(`crm-bulk:${ctx.user.id}`, 60)) return { ok: false, error: "That is a lot of changes in an hour. Try again a bit later." };

  // What the change is.
  let arg = "";
  let tags: string[] = [];
  if (op === "stage") {
    if (!isStageFor(await getStages(ctx.brandId), kind, input.arg)) return { ok: false, error: "Pick a stage from the list." };
    arg = input.arg;
  } else if (op === "follow") {
    if (input.arg === "clear") arg = "";
    else {
      const days = Number(input.arg);
      if (!Number.isInteger(days) || days < 1 || days > 60) return { ok: false, error: "Pick a follow-up between 1 and 60 days." };
      arg = followUpIn(todayIn(hubTz()), days);
    }
  } else if (op === "tag_add" || op === "tag_remove") {
    tags = parseTags(typeof input.tags === "string" ? input.tags : "");
    if (tags.length === 0) return { ok: false, error: "Type a tag first." };
  }

  // Who it applies to.
  let ids: string[];
  if (input.all) {
    const f = readFilter(input.all);
    if (!f.ok) return { ok: false, error: f.error };
    ids = await findIds(ctx.brandId, kind, f.value, todayIn(hubTz()));
  } else {
    ids = Array.isArray(input.ids) ? input.ids : [];
    if (ids.length > 500 || ids.some((i) => typeof i !== "string" || !UUID.test(i))) return { ok: false, error: "Select up to 500 people, or choose everyone who matches." };
  }
  if (ids.length === 0) return { ok: true, changed: 0 };

  let changed = 0;
  for (let i = 0; i < ids.length; i += BULK_PAGE) {
    const { data, error } = await ctx.admin.rpc("crm_bulk", { p_brand: ctx.brandId, p_kind: kind, p_ids: ids.slice(i, i + BULK_PAGE), p_op: op, p_arg: arg, p_tags: tags, p_by: ctx.user.id });
    if (error) {
      console.error("[crm] bulk failed:", error.code, error.message);
      refresh(ctx.slug);
      return { ok: false, error: `${sqlMissing(error.code) ? "This needs a database update that has not been run yet." : "Could not finish the change."}${changed > 0 ? ` ${changed} people were changed before this.` : ""}` };
    }
    changed += Number(data) || 0;
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.bulk", meta: { kind, op, selected: ids.length, changed } });
  refresh(ctx.slug);
  return { ok: true, changed };
}

/** The list's search and filters as the browser sent them, made safe. */
function readFilter(raw: unknown): { ok: true; value: PeopleFilter } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "The selection could not be read. Reload the page and try again." };
  const o = raw as Record<string, unknown>;
  const stage = typeof o.stage === "string" ? o.stage : "";
  if (stage && stage !== "open" && !/^[a-z0-9][a-z0-9_-]{0,39}$/.test(stage)) return { ok: false, error: "The selection could not be read. Reload the page and try again." };
  const importId = typeof o.importId === "string" && UUID.test(o.importId) ? o.importId : null;
  return { ok: true, value: { ...NO_FILTER, q: searchTerm(o.q), stage, due: o.due === true, tag: typeof o.tag === "string" ? (parseTags(o.tag)[0] ?? "") : "", importId } };
}
