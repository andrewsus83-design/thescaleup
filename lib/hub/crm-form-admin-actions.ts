"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "./actions";
import { getForm } from "./crm/form-data";
import { FORM_LIMITS, parseFormSettings } from "./crm/forms";
import { atLeast } from "./permissions";
import { allow } from "./ratelimit";
import { canManageTeam } from "./rules";
import { audit } from "./session";
import { UUID, str, taskContext, type Ctx } from "./tasks/context";

const refresh = (slug: string) => revalidatePath(`/hub/b/${slug}`, "layout");
const MISSING_SQL = "Forms need a database update that has not been run yet.";

/** Forms are public pages, so only a manager with CRM edit access makes or changes them. */
async function managerContext(brandId: unknown): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const c = await taskContext(brandId, "crm");
  if (!c.ok) return c;
  if (!atLeast(c.ctx.level, "edit") || !canManageTeam(c.ctx.actor)) return { ok: false, error: "Only a manager can make or change lead forms." };
  return c;
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
/** 12 random letters and digits. Bytes that would favour some characters are skipped. */
function newToken(): string {
  let out = "";
  while (out.length < 12) for (const b of randomBytes(24)) if (b < 252 && out.length < 12) out += ALPHABET[b % 36];
  return out;
}

export async function saveLeadForm(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await managerContext(str(fd, "brandId"));
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const parsed = parseFormSettings((k) => str(fd, k));
  if (!parsed.ok) return { error: parsed.error };
  const id = str(fd, "id");

  if (id) {
    if (!UUID.test(id)) return { error: "That form no longer exists." };
    const { data, error } = await ctx.admin.from("crm_forms").update(parsed.value).eq("brand_id", ctx.brandId).eq("id", id).select("id").maybeSingle();
    if (error) {
      console.error("[crm] form save failed:", error.code, error.message);
      return { error: error.code === "42P01" ? MISSING_SQL : "Could not save. Try again." };
    }
    if (!data) return { error: "That form no longer exists." };
    await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.form.update", target: id });
    refresh(ctx.slug);
    return { message: "Saved." };
  }

  if (!allow(`crm-form-add:${ctx.user.id}`, 30)) return { error: "That is a lot of forms in an hour. Try again a bit later." };
  const { count, error: countError } = await ctx.admin.from("crm_forms").select("id", { count: "exact", head: true }).eq("brand_id", ctx.brandId);
  if (countError) return { error: countError.code === "42P01" ? MISSING_SQL : "Could not add the form. Try again." };
  if ((count ?? 0) >= FORM_LIMITS.perBrand) return { error: `A brand can have up to ${FORM_LIMITS.perBrand} forms. Delete one you no longer use.` };
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await ctx.admin.from("crm_forms").insert({ brand_id: ctx.brandId, token: newToken(), created_by: ctx.user.id, ...parsed.value }).select("id").single();
    if (error?.code === "23505") continue; // the token was taken: draw another
    if (error) {
      console.error("[crm] form add failed:", error.code, error.message);
      return { error: "Could not add the form. Try again." };
    }
    await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.form.create", target: data.id });
    refresh(ctx.slug);
    redirect(`/hub/b/${ctx.slug}/crm/forms/${data.id}`);
  }
  return { error: "Could not add the form. Try again." };
}

/** Pauses or resumes a form without deleting it. A paused form's link shows a short notice. */
export async function setFormEnabled(fd: FormData): Promise<void> {
  const c = await managerContext(str(fd, "brandId"));
  if (!c.ok) return;
  const { ctx } = c;
  const id = str(fd, "id");
  if (!UUID.test(id)) return;
  const enabled = str(fd, "enabled") === "1";
  const { error } = await ctx.admin.from("crm_forms").update({ enabled }).eq("brand_id", ctx.brandId).eq("id", id);
  if (!error) await audit({ actor: ctx.user, brandId: ctx.brandId, action: enabled ? "crm.form.resume" : "crm.form.pause", target: id });
  refresh(ctx.slug);
}

/** Deletes a form and its answer log. The people it brought in stay in the CRM. */
export async function deleteLeadForm(fd: FormData): Promise<void> {
  const c = await managerContext(str(fd, "brandId"));
  if (!c.ok) return;
  const { ctx } = c;
  const id = str(fd, "id");
  if (!UUID.test(id)) return;
  const form = await getForm(ctx.brandId, id);
  if (!form) return;
  const { error } = await ctx.admin.from("crm_forms").delete().eq("brand_id", ctx.brandId).eq("id", id);
  if (!error) await audit({ actor: ctx.user, brandId: ctx.brandId, action: "crm.form.delete", target: id, meta: { name: form.name } });
  refresh(ctx.slug);
  redirect(`/hub/b/${ctx.slug}/crm/forms`);
}
