"use server";

import { headers } from "next/headers";
import type { FormState } from "./actions";
import { getStages } from "./crm/data";
import { getFormByToken, recentEntries } from "./crm/form-data";
import { STAMP_MAX_MS, STAMP_MIN_MS, connectionKey, stampAge } from "./crm/form-guard";
import { runRules } from "./crm/flow";
import { DEFAULT_THANKS, TOKEN, newLeadNote, parseAnswer, repeatNote } from "./crm/forms";
import { sealNote, trySeal } from "./crm/seal";
import { firstStage } from "./crm/model";
import { unsubscribeKey } from "./email/secret";
import { allow } from "./ratelimit";
import { audit } from "./session";
import { str, type Ctx } from "./tasks/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const HOUR = 3_600_000;
const BUSY = "This form is getting a lot of answers right now. Try again in a little while.";

/**
 * A visitor sends a lead form. There is no sign-in, so nothing here trusts the browser: the form is found by its token, the answer is
 * checked against that form's own settings, and scripts are slowed by a hidden field, a signed timestamp, and limits per connection
 * and per form (counted in the database, so they hold across servers).
 */
export async function submitLead(_prev: FormState, fd: FormData): Promise<FormState> {
  const token = str(fd, "token");
  if (!TOKEN.test(token)) return { error: "This form is not available." };
  const found = await getFormByToken(token);
  if (!found || !found.form.enabled) return { error: "This form is not taking answers right now." };
  const { form } = found;
  const thanks = form.thanks || DEFAULT_THANKS;

  // A person never sees the hidden field. Filled in means a script: say thank you and keep nothing.
  if (str(fd, "website").trim() !== "") return { message: thanks };

  const key = unsubscribeKey();
  if (key) {
    const age = stampAge(form.id, str(fd, "t"), key);
    if (age === null || age > STAMP_MAX_MS) return { error: "This page was open for too long. Reload it and send again." };
    if (age < STAMP_MIN_MS) return { error: "That was quick. Check your answers and send again." };
  }

  const parsed = parseAnswer(form, (k) => str(fd, k));
  if (!parsed.ok) return { error: parsed.error };
  const a = parsed.value;

  const ip = connectionKey((await headers()).get("x-forwarded-for"), form.id, key);
  if (ip && !allow(`lead-ip:${ip}`, 12)) return { error: "Too many answers from this connection. Try again later." };
  const [fromHere, onForm] = await Promise.all([ip ? recentEntries(form.id, HOUR, ip) : Promise.resolve(0), recentEntries(form.id, HOUR)]);
  if (fromHere >= 6) return { error: "Too many answers from this connection. Try again later." };
  if (onForm >= 150) return { error: BUSY };

  // The notes go in wrapped, like every other note about a person. A visitor is never told about the server's keys.
  const notes = trySeal(() => ({ fresh: sealNote(form.brand_id, newLeadNote(form, a)), again: sealNote(form.brand_id, repeatNote(form, a)) }));
  if (!notes.ok) {
    console.error("[crm] form answer not saved:", notes.error);
    return { error: "Could not send your answer. Try again in a moment." };
  }
  const admin = createSupabaseAdminClient();
  const stage = firstStage(await getStages(form.brand_id), "lead");
  const { data, error } = await admin.rpc("crm_capture", {
    p_brand: form.brand_id,
    p_form: form.id,
    p_name: a.name,
    p_company: a.company,
    p_email: a.email,
    p_phone: a.phone,
    p_source: form.source || form.name.slice(0, 60),
    p_stage: stage,
    p_tags: form.tags,
    p_note_new: notes.value.fresh,
    p_note_again: notes.value.again,
    p_ip: ip,
  });
  if (error) {
    console.error("[crm] form answer failed:", error.code, error.message);
    return { error: "Could not send your answer. Try again in a moment." };
  }
  const row = (Array.isArray(data) ? data[0] : data) as { res_id?: string; res_created?: boolean } | null;
  if (!row?.res_id) return { error: "Could not send your answer. Try again in a moment." };

  // A new lead gets what the brand set for its first stage (a follow-up date, a task), as if the form's owner had added them.
  if (row.res_created && form.created_by) {
    const { data: brand } = await admin.from("brands").select("slug").eq("id", form.brand_id).maybeSingle();
    if (brand?.slug) {
      const owner = { id: form.created_by, email: "", isOwner: false };
      const ctx: Ctx = { user: owner, brandId: form.brand_id, slug: String(brand.slug), actor: "founder", level: "edit", admin, who: { actor: "founder", level: "edit", userId: owner.id } };
      await runRules(ctx, { id: row.res_id, kind: "lead", name: a.name, company: a.company }, stage);
      await audit({ actor: owner, brandId: form.brand_id, action: "crm.form.lead", target: row.res_id, meta: { form: form.name } });
    }
  }
  return { message: thanks };
}
