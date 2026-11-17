import "server-only";
import type { Ctx } from "../tasks/context";
import type { Kind } from "./model";

/** Writes down that someone entered a stage. A failure is logged and never blocks the move itself. */
export async function logStage(ctx: Pick<Ctx, "admin" | "brandId" | "user">, m: { personId: string; kind: Kind; from: string | null; to: string; converted?: boolean }): Promise<void> {
  const { error } = await ctx.admin.from("crm_stage_log").insert({
    brand_id: ctx.brandId,
    person_id: m.personId,
    kind: m.kind,
    from_stage: m.from,
    to_stage: m.to,
    converted: m.converted === true,
    changed_by: ctx.user.id,
  });
  if (error) console.error("[crm] stage log failed:", error.message);
}
