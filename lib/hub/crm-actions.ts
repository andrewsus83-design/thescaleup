"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "./actions";
import { getStages, countInStage } from "./crm/data";
import { logStage } from "./crm/flow";
import { firstStage, followUpIn, isKind, isStageFor, parseNote, parsePerson, parseStagesInput } from "./crm/model";
import { atLeast } from "./permissions";
import { allow } from "./ratelimit";
import { canManageTeam } from "./rules";
import { audit } from "./session";
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
  const { data: row } = await ctx.admin.from("crm_people").select("kind, stage").eq("brand_id", ctx.brandId).eq("id", id).maybeSingle();
  const stage = str(fd, "stage");
  if (!row || !isKind(row.kind) || row.stage === stage || !isStageFor(await getStages(ctx.brandId), row.kind, stage)) return;
  const { error } = await ctx.admin.from("crm_people").update({ stage }).eq("brand_id", ctx.brandId).eq("id", id);
  if (!error) {
    await logStage(ctx, { personId: id, kind: row.kind, from: row.stage, to: stage });
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
  const { data: before } = await ctx.admin.from("crm_people").select("stage").eq("brand_id", ctx.brandId).eq("id", id).eq("kind", "lead").maybeSingle();
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
  const { error } = await ctx.admin.from("crm_workflows").upsert({ brand_id: ctx.brandId, stages: parsed.stages, updated_by: ctx.user.id, updated_at: new Date().toISOString() }, { onConflict: "brand_id" });
  if (error) {
    console.error("[crm] stages failed:", error.message);
    return { error: "Could not save the stages. Try again." };
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.stages", meta: { count: parsed.stages.length } });
  refresh(ctx.slug);
  return { message: "Stages saved." };
}
