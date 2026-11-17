"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "./actions";
import { parseRequest, REQUEST_LIMITS } from "./import/model";
import { allow } from "./ratelimit";
import { canManageTeam } from "./rules";
import { audit } from "./session";
import { str, taskContext } from "./tasks/context";

/** A brand asks to be able to import from something that has no importer yet. Owner or founder only, like the rest of Import. */
export async function requestImport(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await taskContext(str(fd, "brandId"), "brand");
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  if (!canManageTeam(ctx.actor)) return { error: "Only the owner or founder can ask for an import." };
  const parsed = parseRequest((k) => str(fd, k));
  if (!parsed.ok) return { error: parsed.error };
  if (!allow(`import-request:${ctx.user.id}`, REQUEST_LIMITS.perHour)) return { error: "That is a lot of requests in an hour. Try again later." };
  const { error } = await ctx.admin.from("import_requests").insert({ brand_id: ctx.brandId, requested_by: ctx.user.id, ...parsed.value });
  if (error) {
    console.error("[import] request failed:", error.message);
    return { error: /relation|does not exist|schema cache/i.test(error.message) ? "Requests need their database step first (20261117300000_import_hub.sql). Ask the person who runs the database updates." : "Could not save the request. Try again." };
  }
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "import.request", target: parsed.value.source.slice(0, 80) });
  revalidatePath(`/hub/b/${ctx.slug}/settings/import`);
  return { message: "Request sent. It shows below, and the agency can see it." };
}
