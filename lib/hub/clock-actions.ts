"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "./actions";
import { str, taskContext } from "./tasks/context";
import { atLeast } from "./permissions";

// Clocking in and out is a personal action, so it needs only "view" on Team: it writes the person's own hours and nothing else.

export async function clockIn(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await taskContext(str(fd, "brandId"), "team");
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  if (!atLeast(ctx.level, "view")) return { error: "You do not have access to Team." };
  const { error } = await ctx.admin.from("time_entries").insert({ brand_id: ctx.brandId, user_id: ctx.user.id });
  if (error) {
    // the one-open-entry index makes a double click or a second device harmless
    if (error.code === "23505") return { error: "You are already clocked in." };
    console.error("[hub] clockIn failed:", error.message);
    return { error: "Could not clock in. Try again." };
  }
  revalidatePath(`/hub/b/${ctx.slug}`, "layout");
  return { message: "Clocked in." };
}

export async function clockOut(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await taskContext(str(fd, "brandId"), "team");
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  if (!atLeast(ctx.level, "view")) return { error: "You do not have access to Team." };
  const { data, error } = await ctx.admin
    .from("time_entries")
    .update({ clock_out: new Date().toISOString() })
    .eq("brand_id", ctx.brandId)
    .eq("user_id", ctx.user.id)
    .is("clock_out", null)
    .select("id");
  if (error) {
    console.error("[hub] clockOut failed:", error.message);
    return { error: "Could not clock out. Try again." };
  }
  if (!data?.length) return { error: "You are not clocked in." };
  revalidatePath(`/hub/b/${ctx.slug}`, "layout");
  return { message: "Clocked out." };
}
