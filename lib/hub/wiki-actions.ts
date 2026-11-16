"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "./actions";
import { atLeast } from "./permissions";
import { allow } from "./ratelimit";
import { audit } from "./session";
import { UUID, str, taskContext, type Ctx } from "./tasks/context";
import { descendants, pageSlug, parsePage, uniqueSlug, type Node } from "./wiki/model";

const refresh = (slug: string) => revalidatePath(`/hub/b/${slug}`, "layout");

/** Who is asking and whether their Wiki access lets them change things. */
async function editContext(fd: FormData): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const c = await taskContext(str(fd, "brandId"), "wiki");
  if (!c.ok) return c;
  if (!atLeast(c.ctx.level, "edit")) return { ok: false, error: "You can read the Wiki here but not change it." };
  return c;
}

/** The pages of this brand as tree nodes, so a new parent can be checked: it must be in this brand and not under the page itself. */
async function nodes(ctx: Ctx): Promise<Node[]> {
  const { data } = await ctx.admin.from("wiki_pages").select("id, title, slug, parent_id").eq("brand_id", ctx.brandId).limit(2000);
  return (data ?? []) as Node[];
}

/** Creates a page (no id) or saves changes to one (id). Either way the person lands on the page afterwards. */
export async function savePage(_prev: FormState, fd: FormData): Promise<FormState> {
  const c = await editContext(fd);
  if (!c.ok) return { error: c.error };
  const { ctx } = c;
  const parsed = parsePage((k) => str(fd, k));
  if (!parsed.ok) return { error: parsed.error };
  if (!allow(`wiki-save:${ctx.user.id}`, 200)) return { error: "That is a lot of saves in an hour. Try again a bit later." };
  const v = parsed.value;
  const all = await nodes(ctx);
  const id = str(fd, "id");
  if (id && !UUID.test(id)) return { error: "That page no longer exists." };

  if (v.parent_id) {
    if (!all.some((n) => n.id === v.parent_id)) return { error: "Pick a parent page from the list." };
    if (id && (v.parent_id === id || descendants(all, id).has(v.parent_id))) return { error: "A page cannot go under itself or under one of its own subpages." };
  }

  if (id) {
    const { data, error } = await ctx.admin.from("wiki_pages").update({ ...v, updated_by: ctx.user.id }).eq("brand_id", ctx.brandId).eq("id", id).select("slug").maybeSingle();
    if (error) {
      console.error("[wiki] update failed:", error.message);
      return { error: "Could not save. Try again." };
    }
    if (!data) return { error: "That page no longer exists." };
    await audit({ actor: ctx.user, brandId: ctx.brandId, action: "wiki.update", target: id });
    refresh(ctx.slug);
    redirect(`/hub/b/${ctx.slug}/wiki/${data.slug}`);
  }

  const base = pageSlug(v.title);
  let slug = uniqueSlug(base, new Set(all.map((n) => n.slug)));
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await ctx.admin.from("wiki_pages").insert({ ...v, slug, brand_id: ctx.brandId, created_by: ctx.user.id, updated_by: ctx.user.id }).select("id, slug").single();
    if (!error && data) {
      await audit({ actor: ctx.user, brandId: ctx.brandId, action: "wiki.create", target: data.id as string, meta: { type: v.type } });
      refresh(ctx.slug);
      redirect(`/hub/b/${ctx.slug}/wiki/${data.slug}`);
    }
    if (error?.code !== "23505") {
      console.error("[wiki] insert failed:", error?.message);
      return { error: "Could not save. Try again." };
    }
    slug = `${base.slice(0, 70)}-${Math.random().toString(36).slice(2, 6)}`; // two people picked the same title at the same moment
  }
  return { error: "Could not save. Try again." };
}

/** Removes a page. Its subpages stay and move up to the top level; its earlier versions go with it. */
export async function deletePage(fd: FormData): Promise<void> {
  const c = await editContext(fd);
  if (!c.ok) return;
  const { ctx } = c;
  const id = str(fd, "id");
  if (!UUID.test(id)) return;
  const { error } = await ctx.admin.from("wiki_pages").delete().eq("brand_id", ctx.brandId).eq("id", id);
  if (!error) await audit({ actor: ctx.user, brandId: ctx.brandId, action: "wiki.delete", target: id });
  refresh(ctx.slug);
  redirect(`/hub/b/${ctx.slug}/wiki`);
}

/** Puts an earlier version of the text back. The text it replaces is kept as a version too, so a restore can itself be undone. */
export async function restoreVersion(fd: FormData): Promise<void> {
  const c = await editContext(fd);
  if (!c.ok) return;
  const { ctx } = c;
  const pageId = str(fd, "pageId");
  const versionId = str(fd, "versionId");
  if (!UUID.test(pageId) || !UUID.test(versionId)) return;
  const { data: ver } = await ctx.admin.from("wiki_versions").select("title, summary, body").eq("brand_id", ctx.brandId).eq("page_id", pageId).eq("id", versionId).maybeSingle();
  if (!ver) return;
  const { data: page } = await ctx.admin.from("wiki_pages").update({ title: ver.title, summary: ver.summary, body: ver.body, updated_by: ctx.user.id }).eq("brand_id", ctx.brandId).eq("id", pageId).select("slug").maybeSingle();
  if (!page) return;
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "wiki.restore", target: pageId });
  refresh(ctx.slug);
  redirect(`/hub/b/${ctx.slug}/wiki/${page.slug}`);
}
