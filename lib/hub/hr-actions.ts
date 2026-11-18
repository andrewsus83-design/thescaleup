"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "./actions";
import { seal, SEAL_KEY_MISSING, SealKeyMissing } from "./field-crypto";
import { getPerson, getSettings, listLeave, personForUser } from "./hr/data";
import { checkLeave, isClock, isLeaveKind, isWorkdays, LIMITS, overlapsLeave, parsePersonInput } from "./hr/model";
import { atLeast } from "./permissions";
import { audit } from "./session";
import { str, taskContext, UUID, type Ctx } from "./tasks/context";

// Every change on the people side of Team. Team "Can edit" manages people records, leave and the attendance settings.
// A person with Team "Can view" can always ask for their own leave.

type Hr = { ctx: Ctx; manages: boolean };

async function hrContext(brandId: unknown): Promise<{ ok: true; hr: Hr } | { ok: false; error: string }> {
  const c = await taskContext(brandId, "team");
  if (!c.ok) return c;
  if (!atLeast(c.ctx.level, "view")) return { ok: false, error: "You do not have access to Team." };
  return { ok: true, hr: { ctx: c.ctx, manages: atLeast(c.ctx.level, "edit") } };
}

const NOT_MANAGER = "Only someone who manages the team can change this.";
const fresh = (ctx: Ctx) => revalidatePath(`/hub/b/${ctx.slug}/team`, "layout");
const fail = (what: string, message: string): FormState => {
  console.error(`[hr] ${what} failed:`, message);
  return { error: "Could not save that. Try again." };
};
/** Seals text, or says plainly that the server cannot keep it safe yet. Nothing is ever saved unsealed. */
function sealed(brandId: string, field: Parameters<typeof seal>[1], plain: string): { ok: true; value: string } | { ok: false; error: string } {
  try {
    return { ok: true, value: seal(brandId, field, plain) };
  } catch (e) {
    if (e instanceof SealKeyMissing) return { ok: false, error: SEAL_KEY_MISSING };
    throw e;
  }
}

// ---------------------------------------------------------------------------------------------- people
export async function savePerson(_prev: FormState, fd: FormData): Promise<FormState> {
  const h = await hrContext(str(fd, "brandId"));
  if (!h.ok) return { error: h.error };
  const { ctx, manages } = h.hr;
  if (!manages) return { error: NOT_MANAGER };
  const parsed = parsePersonInput({ name: str(fd, "name"), title: str(fd, "title"), employment: str(fd, "employment"), startDate: str(fd, "startDate"), endDate: str(fd, "endDate"), leaveDays: str(fd, "leaveDays"), emergency: str(fd, "emergency") });
  if (!parsed.ok) return { error: parsed.error };
  const p = parsed.value;

  // A link to a sign-in is only ever to someone who is a member of this brand.
  const linkTo = str(fd, "userId");
  let userId: string | null = null;
  if (linkTo) {
    if (!UUID.test(linkTo)) return { error: "That sign-in is not valid." };
    const { data: member } = await ctx.admin.from("brand_members").select("user_id").eq("brand_id", ctx.brandId).eq("user_id", linkTo).maybeSingle();
    if (!member) return { error: "That sign-in is not a member of this brand." };
    userId = linkTo;
  }
  const priv = sealed(ctx.brandId, "hr_people.private", p.emergency);
  if (!priv.ok) return { error: priv.error };

  const row = { full_name: p.name, job_title: p.title, employment: p.employment, start_date: p.startDate, end_date: p.endDate, leave_days: p.leaveDays, user_id: userId, private_sealed: priv.value, updated_at: new Date().toISOString(), updated_by: ctx.user.id };
  const personId = str(fd, "personId");
  if (personId && !UUID.test(personId)) return { error: "Unknown person." };
  const res = personId
    ? await ctx.admin.from("hr_people").update(row).eq("brand_id", ctx.brandId).eq("id", personId).select("id")
    : await ctx.admin.from("hr_people").insert({ ...row, brand_id: ctx.brandId }).select("id");
  if (res.error) {
    if (res.error.code === "23505") return { error: "That sign-in is already linked to another person's record." };
    return fail("savePerson", res.error.message);
  }
  if (!res.data?.length) return { error: "Unknown person." };
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: personId ? "hr.person.update" : "hr.person.add", target: res.data[0].id as string });
  fresh(ctx);
  return { message: personId ? "Saved." : `${p.name} was added.` };
}

export async function setPersonStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  const h = await hrContext(str(fd, "brandId"));
  if (!h.ok) return { error: h.error };
  const { ctx, manages } = h.hr;
  if (!manages) return { error: NOT_MANAGER };
  const personId = str(fd, "personId");
  const status = str(fd, "status");
  if (!UUID.test(personId) || (status !== "active" && status !== "left")) return { error: "Unknown person." };
  const { data, error } = await ctx.admin.from("hr_people").update({ status, updated_at: new Date().toISOString(), updated_by: ctx.user.id }).eq("brand_id", ctx.brandId).eq("id", personId).select("id");
  if (error) return fail("setPersonStatus", error.message);
  if (!data?.length) return { error: "Unknown person." };
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "hr.person.status", target: personId, meta: { status } });
  fresh(ctx);
  return { message: status === "left" ? "Marked as left. Their record is kept." : "Marked as active." };
}

export async function saveWorkSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const h = await hrContext(str(fd, "brandId"));
  if (!h.ok) return { error: h.error };
  const { ctx, manages } = h.hr;
  if (!manages) return { error: NOT_MANAGER };
  const workStart = str(fd, "workStart");
  const late = Number(str(fd, "lateAfterMin"));
  const workdays = Number(str(fd, "workdays"));
  const leaveDays = Number(str(fd, "leaveDays"));
  if (!isClock(workStart)) return { error: "The start time must look like 09:00." };
  if (!Number.isInteger(late) || late < 0 || late > 240) return { error: "The grace time must be 0 to 240 minutes." };
  if (!isWorkdays(workdays)) return { error: "Choose the working days." };
  if (!Number.isInteger(leaveDays) || leaveDays < 0 || leaveDays > 365) return { error: "Leave days a year must be 0 to 365." };
  const { error } = await ctx.admin.from("hr_settings").upsert({ brand_id: ctx.brandId, work_start: workStart, late_after_min: late, workdays, leave_days: leaveDays, updated_at: new Date().toISOString(), updated_by: ctx.user.id }, { onConflict: "brand_id" });
  if (error) return fail("saveWorkSettings", error.message);
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "hr.settings.work" });
  fresh(ctx);
  return { message: "Saved." };
}

// ---------------------------------------------------------------------------------------------- leave
export async function requestLeave(_prev: FormState, fd: FormData): Promise<FormState> {
  const h = await hrContext(str(fd, "brandId"));
  if (!h.ok) return { error: h.error };
  const { ctx, manages } = h.hr;
  const kind = str(fd, "kind");
  if (!isLeaveKind(kind)) return { error: "Choose the kind of leave." };

  // Without a person named, the request is for whoever is signed in. Naming someone else is for whoever manages the team.
  const forId = str(fd, "personId");
  const mine = await personForUser(ctx.brandId, ctx.user.id);
  let person = mine;
  if (forId && forId !== mine?.id) {
    if (!manages) return { error: "You can only ask for your own leave." };
    person = UUID.test(forId) ? await getPerson(ctx.brandId, forId) : null;
  }
  if (!person) return { error: forId ? "Unknown person." : "You have no people record in this brand yet. Ask whoever manages the team to add you." };
  if (person.status !== "active") return { error: `${person.name} is marked as left.` };

  const settings = await getSettings(ctx.brandId);
  const range = checkLeave(str(fd, "start"), str(fd, "end"), settings.workdays);
  if (!range.ok) return { error: range.error };
  const { start, end, days } = range.value;
  const existing = await listLeave(ctx.brandId, start, person.id);
  if (overlapsLeave(existing, person.id, start, end)) return { error: "Those dates overlap leave that is already asked for or approved." };

  const note = sealed(ctx.brandId, "hr_leave.note", str(fd, "note").trim().slice(0, LIMITS.reason));
  if (!note.ok) return { error: note.error };
  const { data, error } = await ctx.admin.from("hr_leave").insert({ brand_id: ctx.brandId, person_id: person.id, kind, start_date: start, end_date: end, days, note_sealed: note.value, requested_by: ctx.user.id }).select("id");
  if (error) return fail("requestLeave", error.message);
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "hr.leave.request", target: data?.[0]?.id as string | undefined, meta: { kind, days } });
  fresh(ctx);
  return { message: `Asked for ${days} working day${days === 1 ? "" : "s"}. It waits for approval.` };
}

export async function decideLeave(_prev: FormState, fd: FormData): Promise<FormState> {
  const h = await hrContext(str(fd, "brandId"));
  if (!h.ok) return { error: h.error };
  const { ctx, manages } = h.hr;
  if (!manages) return { error: NOT_MANAGER };
  const leaveId = str(fd, "leaveId");
  const decision = str(fd, "decision");
  if (!UUID.test(leaveId) || (decision !== "approved" && decision !== "rejected")) return { error: "Unknown request." };
  const { data: row } = await ctx.admin.from("hr_leave").select("id, person_id, status").eq("brand_id", ctx.brandId).eq("id", leaveId).maybeSingle();
  if (!row) return { error: "Unknown request." };
  if (row.status !== "pending") return { error: "That request was already decided." };
  // Nobody signs off their own time off, except the founder and the agency, who have no one above them in the brand.
  const mine = await personForUser(ctx.brandId, ctx.user.id);
  if (mine?.id === row.person_id && ctx.actor !== "owner" && ctx.actor !== "founder") return { error: "Someone else has to decide your own request." };
  const { data, error } = await ctx.admin.from("hr_leave").update({ status: decision, decided_by: ctx.user.id, decided_at: new Date().toISOString() }).eq("brand_id", ctx.brandId).eq("id", leaveId).eq("status", "pending").select("id");
  if (error) return fail("decideLeave", error.message);
  if (!data?.length) return { error: "That request was already decided." };
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "hr.leave.decide", target: leaveId, meta: { decision } });
  fresh(ctx);
  return { message: decision === "approved" ? "Approved." : "Rejected." };
}

export async function cancelLeave(_prev: FormState, fd: FormData): Promise<FormState> {
  const h = await hrContext(str(fd, "brandId"));
  if (!h.ok) return { error: h.error };
  const { ctx, manages } = h.hr;
  const leaveId = str(fd, "leaveId");
  if (!UUID.test(leaveId)) return { error: "Unknown request." };
  const { data: row } = await ctx.admin.from("hr_leave").select("id, person_id, status").eq("brand_id", ctx.brandId).eq("id", leaveId).maybeSingle();
  if (!row) return { error: "Unknown request." };
  const mine = await personForUser(ctx.brandId, ctx.user.id);
  const own = mine?.id === row.person_id;
  // A person takes back their own request while it waits. Whoever manages the team can also cancel leave that was approved.
  const allowed = manages ? row.status === "pending" || row.status === "approved" : own && row.status === "pending";
  if (!allowed) return { error: own ? "That request was already decided. Ask whoever manages the team to cancel it." : NOT_MANAGER };
  const { error } = await ctx.admin.from("hr_leave").update({ status: "cancelled", decided_by: ctx.user.id, decided_at: new Date().toISOString() }).eq("brand_id", ctx.brandId).eq("id", leaveId).in("status", ["pending", "approved"]);
  if (error) return fail("cancelLeave", error.message);
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "hr.leave.cancel", target: leaveId });
  fresh(ctx);
  return { message: "Cancelled." };
}
