"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { accessFor } from "./access";
import { getStages } from "./crm/data";
import { firstStage, parsePerson } from "./crm/model";
import { atLeast, type Fn } from "./permissions";
import { allow } from "./ratelimit";
import { audit } from "./session";
import { UUID, str, taskContext, type Ctx } from "./tasks/context";
import { getWorkflow, listMembers } from "./tasks/data";
import { followUpFor, taskDraft, type ItemRow } from "./chat/apply";
import { parseFindings, PLATFORM_LABEL, type AuditItem } from "./chat/model";
import { hubTz, todayIn } from "./tasks/dates";
import { startStatus } from "./tasks/rules";

// Everything a person can do from a finding. Nothing here runs by itself: each action is a button, works once per finding
// (chat_audit_links is the guard), changes only the thing it names, and never moves a CRM stage, so no funnel automation fires.

export type Done = { ok: true; message: string } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const NOT_READY = "Chat audit needs its database step first (20261117310000_chat_audit.sql). Ask the person who runs the database updates.";
const refresh = (slug: string) => revalidatePath(`/hub/b/${slug}/inbox/audit`, "layout");

/** The brand, the person, and the finding they act on. `fn` is the menu the action writes into; Inbox needs edit as well, because the audit is Inbox's. */
async function actContext(brandId: unknown, itemId: unknown, fn: Fn): Promise<{ ok: true; ctx: Ctx; item: AuditItem & ItemRow } | { ok: false; error: string }> {
  const c = await taskContext(brandId, fn);
  if (!c.ok) return c;
  const { ctx } = c;
  const access = await accessFor(ctx.brandId, ctx.actor);
  if (!atLeast(access.inbox, "edit") || !atLeast(access[fn], "edit")) return fail(`You need edit access to Inbox and ${fn === "crm" ? "the CRM" : fn} for this.`);
  if (typeof itemId !== "string" || !UUID.test(itemId)) return fail("That conversation no longer exists.");
  if (!allow(`chat-apply:${ctx.user.id}`, 200)) return fail("That is a lot of actions in an hour. Try again later.");
  const { data, error } = await ctx.admin.from("chat_audit_items").select("id, audit_id, title, platform, channel, kind, metrics, findings, person_id").eq("brand_id", ctx.brandId).eq("id", itemId).maybeSingle();
  if (error) return fail(NOT_READY);
  if (!data) return fail("That conversation no longer exists.");
  const findings = parseFindings(JSON.stringify(data.findings ?? {}), "0000-01-01");
  if (!findings) return fail("That conversation has no findings.");
  const { data: a } = await ctx.admin.from("chat_audits").select("name").eq("id", data.audit_id as string).maybeSingle();
  return { ok: true, ctx, item: { ...(data as unknown as AuditItem), channel: String(data.channel ?? ""), findings, auditName: String(a?.name ?? "Chat audit") } };
}

// ---------------------------------------------------------------------------------------------- the audit itself
export async function createAudit(brandId: string, name: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const c = await taskContext(brandId, "inbox");
  if (!c.ok) return c;
  const { ctx } = c;
  if (!atLeast(ctx.level, "edit")) return fail("You can see the Inbox here but not change it.");
  const n = (typeof name === "string" ? name : "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!n) return fail("Give the audit a name.");
  if (!allow(`chat-audit-new:${ctx.user.id}`, 40)) return fail("That is a lot of audits in an hour. Try again later.");
  const { data, error } = await ctx.admin.from("chat_audits").insert({ brand_id: ctx.brandId, name: n, created_by: ctx.user.id }).select("id").single();
  if (error || !data) {
    console.error("[chat] create failed:", error?.message);
    return fail(/relation|does not exist|schema cache/i.test(error?.message ?? "") ? NOT_READY : "Could not start the audit. Try again.");
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "chat.audit.create", target: data.id as string });
  refresh(ctx.slug);
  return { ok: true, id: data.id as string };
}

export async function deleteAudit(fd: FormData): Promise<void> {
  const c = await taskContext(str(fd, "brandId"), "inbox");
  if (!c.ok || !atLeast(c.ctx.level, "edit")) return;
  const id = str(fd, "id");
  if (!UUID.test(id)) return;
  const { error } = await c.ctx.admin.from("chat_audits").delete().eq("brand_id", c.ctx.brandId).eq("id", id);
  if (!error) await audit({ actor: c.ctx.user, brandId: c.ctx.brandId, action: "chat.audit.delete", target: id });
  refresh(c.ctx.slug);
}

// ---------------------------------------------------------------------------------------------- suggestions
/** Open items that are on us become tasks, through the brand's normal approval flow. `slots` are positions in open_items. */
export async function makeTasks(brandId: string, itemId: string, slots: number[]): Promise<Done> {
  const c = await actContext(brandId, itemId, "tasks");
  if (!c.ok) return c;
  const { ctx, item } = c;
  const want = [...new Set(slots)].filter((s) => Number.isInteger(s) && s >= 0 && s < item.findings.open_items.length && item.findings.open_items[s].owner === "us");
  if (!want.length) return fail("There is nothing on us to turn into a task.");
  const { data: have } = await ctx.admin.from("chat_audit_links").select("slot").eq("item_id", item.id).eq("kind", "task");
  const taken = new Set((have ?? []).map((h) => h.slot as string));
  const todo = want.filter((s) => !taken.has(`open:${s}`));
  if (!todo.length) return { ok: true, message: "Those are already tasks." };
  const [workflow, members] = await Promise.all([getWorkflow(ctx.brandId), listMembers(ctx.brandId)]);
  const start = startStatus(workflow, ctx.actor, { ai: true });
  if (!start) return fail("This brand's workflow has no status to start in. Check Settings.");
  const rows = todo.map((s) => ({ slot: `open:${s}`, id: randomUUID(), ...taskDraft(item, item.findings.open_items[s], members, item.auditName) }));
  const { error } = await ctx.admin.from("tasks").insert(
    rows.map((r) => ({ id: r.id, brand_id: ctx.brandId, title: r.title, description: r.description, priority: r.priority, due_date: r.due_date, assignee_id: r.assignee_id, status: start.status, source: "ai", created_by: ctx.user.id, ...(start.stage === "proposed" ? {} : { approved_by: ctx.user.id, approved_at: new Date().toISOString() }) })),
  );
  if (error) {
    console.error("[chat] tasks failed:", error.message);
    return fail("Could not create the tasks. Try again.");
  }
  const links = await ctx.admin.from("chat_audit_links").insert(rows.map((r) => ({ item_id: item.id, brand_id: ctx.brandId, kind: "task", slot: r.slot, task_id: r.id })));
  if (links.error) {
    await ctx.admin.from("tasks").delete().eq("brand_id", ctx.brandId).in("id", rows.map((r) => r.id)); // undo, so a second press never makes copies
    return links.error.code === "23505" ? { ok: true, message: "Those are already tasks." } : fail("Could not record the tasks. Nothing was kept. Try again.");
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "chat.audit.tasks", target: item.id, meta: { count: rows.length } });
  refresh(ctx.slug);
  revalidatePath(`/hub/b/${ctx.slug}`, "layout");
  return { ok: true, message: `${rows.length} ${rows.length === 1 ? "task" : "tasks"} created.${start.stage === "proposed" ? " They wait for approval in Tasks." : ""}` };
}

/** Links a conversation to a CRM lead or client (or unlinks it with null). */
export async function linkPerson(brandId: string, itemId: string, personId: string | null): Promise<Done> {
  const c = await actContext(brandId, itemId, "crm");
  if (!c.ok) return c;
  const { ctx, item } = c;
  if (personId !== null) {
    if (!UUID.test(personId)) return fail("That person no longer exists.");
    const { data } = await ctx.admin.from("crm_people").select("id").eq("brand_id", ctx.brandId).eq("id", personId).maybeSingle();
    if (!data) return fail("That person no longer exists.");
  }
  const { error } = await ctx.admin.from("chat_audit_items").update({ person_id: personId }).eq("brand_id", ctx.brandId).eq("id", item.id);
  if (error) return fail("Could not save the link. Try again.");
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "chat.audit.link", target: item.id });
  refresh(ctx.slug);
  return { ok: true, message: personId ? "Linked." : "Unlinked." };
}

/** Puts the audit on the linked person: the follow-up date (only earlier, or when empty) and a note with the summary. The stage never changes. */
export async function syncCrm(brandId: string, itemId: string): Promise<Done> {
  const c = await actContext(brandId, itemId, "crm");
  if (!c.ok) return c;
  const { ctx, item } = c;
  if (!item.person_id) return fail("Link this conversation to a lead or client first.");
  const { data: person } = await ctx.admin.from("crm_people").select("id, next_follow_up").eq("brand_id", ctx.brandId).eq("id", item.person_id).maybeSingle();
  if (!person) return fail("That person no longer exists. Link another one.");
  const claim = await ctx.admin.from("chat_audit_links").insert({ item_id: item.id, brand_id: ctx.brandId, kind: "crm", slot: "sync" });
  if (claim.error) return claim.error.code === "23505" ? { ok: true, message: "Already added to the CRM." } : fail("Could not record it. Try again.");
  const today = todayIn(hubTz());
  const next = followUpFor(item.findings, (person.next_follow_up as string | null) ?? null, today);
  const note = `Chat audit "${item.auditName}" (${PLATFORM_LABEL[item.platform]}${item.channel ? `, ${item.channel}` : ""}, ${item.metrics.from} to ${item.metrics.to}): ${item.findings.summary}${item.findings.next_step ? ` Next: ${item.findings.next_step}` : ""}`.slice(0, 2000);
  const [n, u] = await Promise.all([
    ctx.admin.from("crm_notes").insert({ brand_id: ctx.brandId, person_id: item.person_id, body: note, author_id: ctx.user.id, author_label: ctx.user.email }),
    ctx.admin.from("crm_people").update({ updated_at: new Date().toISOString(), ...(next ? { next_follow_up: next } : {}) }).eq("brand_id", ctx.brandId).eq("id", item.person_id),
  ]);
  if (n.error || u.error) {
    console.error("[chat] crm sync failed:", n.error?.message ?? u.error?.message);
    await ctx.admin.from("chat_audit_links").delete().eq("item_id", item.id).eq("kind", "crm").eq("slot", "sync");
    return fail("Could not update the CRM. Try again.");
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "chat.audit.crm", target: item.id, meta: { followUp: next } });
  refresh(ctx.slug);
  revalidatePath(`/hub/b/${ctx.slug}`, "layout");
  return { ok: true, message: next ? "Note added, follow-up set." : "Note added." };
}

/** A new CRM lead from a conversation that shows buying intent and has no person yet. No funnel automation runs. */
export async function makeLead(brandId: string, itemId: string): Promise<Done> {
  const c = await actContext(brandId, itemId, "crm");
  if (!c.ok) return c;
  const { ctx, item } = c;
  if (item.person_id) return fail("This conversation is already linked to someone.");
  const source = item.channel || PLATFORM_LABEL[item.platform];
  const parsed = parsePerson((k) => ({ name: item.title, company: "", email: "", phone: "", source, value: "", next_follow_up: item.findings.follow_up_date ?? "", summary: `${item.findings.summary}\n\nFrom a chat audit ("${item.auditName}").`.slice(0, 2000) } as Record<string, string>)[k] ?? "");
  if (!parsed.ok) return fail(parsed.error);
  const claim = await ctx.admin.from("chat_audit_links").insert({ item_id: item.id, brand_id: ctx.brandId, kind: "lead", slot: "lead" });
  if (claim.error) return claim.error.code === "23505" ? { ok: true, message: "Already added as a lead." } : fail("Could not record it. Try again.");
  const stage = firstStage(await getStages(ctx.brandId), "lead");
  const { data, error } = await ctx.admin.from("crm_people").insert({ brand_id: ctx.brandId, kind: "lead", stage, created_by: ctx.user.id, ...parsed.value }).select("id").single();
  if (error || !data) {
    console.error("[chat] lead failed:", error?.message);
    await ctx.admin.from("chat_audit_links").delete().eq("item_id", item.id).eq("kind", "lead");
    return fail("Could not add the lead. Try again.");
  }
  await ctx.admin.from("chat_audit_items").update({ person_id: data.id }).eq("brand_id", ctx.brandId).eq("id", item.id);
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "chat.audit.lead", target: data.id as string });
  refresh(ctx.slug);
  revalidatePath(`/hub/b/${ctx.slug}`, "layout");
  return { ok: true, message: "Added to the CRM as a lead." };
}

/** Post ideas from the questions the other side raised, as Content ideas (status "idea", marked as AI). */
export async function makeContent(brandId: string, itemId: string): Promise<Done> {
  const c = await actContext(brandId, itemId, "content");
  if (!c.ok) return c;
  const { ctx, item } = c;
  const { data: have } = await ctx.admin.from("chat_audit_links").select("slot").eq("item_id", item.id).eq("kind", "content");
  const taken = new Set((have ?? []).map((h) => h.slot as string));
  const rows = item.findings.content_ideas.flatMap((t, i) => (taken.has(`idea:${i}`) ? [] : [{ slot: `idea:${i}`, id: randomUUID(), title: t.slice(0, 200) }]));
  if (!rows.length) return { ok: true, message: item.findings.content_ideas.length ? "Those are already in Content." : "There are no content ideas here." };
  const channel = /instagram/i.test(item.channel) ? "instagram" : /facebook/i.test(item.channel) ? "facebook" : null;
  const { error } = await ctx.admin.from("content_items").insert(rows.map((r) => ({ id: r.id, brand_id: ctx.brandId, title: r.title, body: "", kind: "post", channel, status: "idea", source: "ai", created_by: ctx.user.id })));
  if (error) {
    console.error("[chat] content failed:", error.message);
    return fail("Could not add the ideas. Try again.");
  }
  const links = await ctx.admin.from("chat_audit_links").insert(rows.map((r) => ({ item_id: item.id, brand_id: ctx.brandId, kind: "content", slot: r.slot, content_id: r.id })));
  if (links.error) {
    await ctx.admin.from("content_items").delete().eq("brand_id", ctx.brandId).in("id", rows.map((r) => r.id));
    return links.error.code === "23505" ? { ok: true, message: "Those are already in Content." } : fail("Could not record the ideas. Nothing was kept. Try again.");
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "chat.audit.content", target: item.id, meta: { count: rows.length } });
  refresh(ctx.slug);
  return { ok: true, message: `${rows.length} ${rows.length === 1 ? "idea" : "ideas"} added to Content.` };
}
