"use server";

import { revalidatePath } from "next/cache";
import { sealNote, sealSummary, trySeal } from "./crm/seal";
import { atLeast } from "./permissions";
import { allow } from "./ratelimit";
import { canManageTeam } from "./rules";
import { audit } from "./session";
import { UUID, taskContext } from "./tasks/context";

// Wraps the notes and "about" text that were saved before encryption was on. A manager runs it in batches from the CRM's Protection
// page; each batch is small, so it works for a list of any size and can be stopped and started again.

const BATCH = 200;
const START = "00000000-0000-0000-0000-000000000000";

export type ProtectResult = { ok: true; people: number; notes: number; afterPeople: string; afterNotes: string; done: boolean } | { ok: false; error: string };

export async function protectBatch(input: { brandId: string; afterPeople: string; afterNotes: string }): Promise<ProtectResult> {
  const c = await taskContext(input?.brandId, "crm");
  if (!c.ok) return { ok: false, error: c.error };
  const { ctx } = c;
  if (!canManageTeam(ctx.actor) || !atLeast(ctx.level, "edit")) return { ok: false, error: "Only a manager can protect the CRM text." };
  const afterPeople = typeof input.afterPeople === "string" && UUID.test(input.afterPeople) ? input.afterPeople : START;
  const afterNotes = typeof input.afterNotes === "string" && UUID.test(input.afterNotes) ? input.afterNotes : START;
  // A person who runs the whole backlog makes a few hundred calls; this stops a stuck loop, not a person.
  if (!allow(`crm-protect:${ctx.user.id}`, 2000)) return { ok: false, error: "That is a lot of batches in an hour. Try again a bit later." };

  const [people, notes] = await Promise.all([
    ctx.admin.from("crm_people").select("id, summary").eq("brand_id", ctx.brandId).neq("summary", "").not("summary", "like", "enc:v1:%").gt("id", afterPeople).order("id", { ascending: true }).limit(BATCH),
    ctx.admin.from("crm_notes").select("id, body").eq("brand_id", ctx.brandId).not("body", "like", "enc:v1:%").gt("id", afterNotes).order("id", { ascending: true }).limit(BATCH),
  ]);
  if (people.error || notes.error) {
    console.error("[crm] protect read failed:", people.error?.message ?? notes.error?.message);
    return { ok: false, error: "Could not read the CRM text. Try again." };
  }
  const pRows = (people.data ?? []) as { id: string; summary: string }[];
  const nRows = (notes.data ?? []) as { id: string; body: string }[];
  if (pRows.length === 0 && nRows.length === 0) return { ok: true, people: 0, notes: 0, afterPeople, afterNotes, done: true };

  const wrapped = trySeal(() => ({
    people: pRows.map((r) => ({ id: r.id, old: r.summary, new: sealSummary(ctx.brandId, r.summary) })),
    notes: nRows.map((r) => ({ id: r.id, old: r.body, new: sealNote(ctx.brandId, r.body) })),
  }));
  if (!wrapped.ok) return { ok: false, error: wrapped.error };

  const { data, error } = await ctx.admin.rpc("crm_seal_chunk", { p_brand: ctx.brandId, p_people: wrapped.value.people, p_notes: wrapped.value.notes });
  if (error) {
    console.error("[crm] protect failed:", error.code, error.message);
    const missing = error.code === "PGRST202" || error.code === "42883";
    return { ok: false, error: missing ? "This needs a database update that has not been run yet." : "Could not protect this batch. Try again." };
  }
  const row = Array.isArray(data) ? data[0] : data;
  const done = { people: Number(row?.people ?? 0), notes: Number(row?.notes ?? 0) };
  const last = <T extends { id: string }>(rows: T[], fallback: string) => (rows.length ? rows[rows.length - 1].id : fallback);
  if (done.people + done.notes > 0) {
    await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.protect", meta: done });
    revalidatePath(`/hub/b/${ctx.slug}`, "layout");
  }
  return { ok: true, ...done, afterPeople: last(pRows, afterPeople), afterNotes: last(nRows, afterNotes), done: false };
}
