"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runAudit } from "@/lib/engine/audit";
import type { MemberStatus } from "@/lib/admin/config";
import { PLAN_ITEM_STATUSES } from "@/lib/admin/plan-status";
import { BUILDER_SLUGS, builderDef } from "@/lib/builders";

const PLAN_STATUSES = PLAN_ITEM_STATUSES.map((s) => s.value) as string[];

const VALID_STATUS: MemberStatus[] = [
  "pending",
  "processing",
  "done",
  "rejected",
];

/* --------------------------------- members -------------------------------- */

export async function setMemberStatus(memberId: string, status: string) {
  await requireAdmin();
  if (!VALID_STATUS.includes(status as MemberStatus)) return;
  const db = createSupabaseAdminClient();
  const patch: Record<string, unknown> = { status };
  await db.from("leads").update(patch).eq("id", memberId);
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${memberId}`);
  revalidatePath("/admin");
}

export async function saveMemberNote(memberId: string, note: string) {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  await db.from("leads").update({ admin_notes: note }).eq("id", memberId);
  revalidatePath(`/admin/members/${memberId}`);
}

/**
 * "Process Now" — mark processing, build an initial report scaffold from the
 * member's inputs, then mark done. The real multi-agent $2 engine plugs in at
 * buildReportScaffold() (replace the deterministic template with its output).
 */
export async function processMember(
  memberId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const db = createSupabaseAdminClient();

  const { data: member } = await db
    .from("leads")
    .select("*")
    .eq("id", memberId)
    .single();
  if (!member) return { ok: false, error: "Member tidak ditemukan." };

  await db.from("leads").update({ status: "processing" }).eq("id", memberId);
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${memberId}`);

  // Run the real audit engine (falls back to a scaffold if no LLM key).
  const result = await runAudit(member);

  let title: string;
  let summary: string | null;
  let content: Record<string, unknown>;
  if (result.ok && result.content) {
    title = result.title ?? `Audit ScaleUp — ${member.business ?? member.name}`;
    summary = result.summary ?? null;
    content = result.content;
  } else {
    const s = buildReportScaffold(member);
    (s.content as Record<string, unknown>).engine_error = result.error ?? "unknown";
    title = s.title;
    summary = s.summary;
    content = s.content;
  }

  const { error: insErr } = await db.from("reports").insert({
    member_id: memberId,
    title,
    summary,
    content,
    status: "draft",
  });

  if (insErr) {
    await db.from("leads").update({ status: "pending" }).eq("id", memberId);
    revalidatePath("/admin/members");
    return {
      ok: false,
      error: `Gagal simpan report: ${insErr.message}. Jalankan migrasi admin SQL (tabel 'reports' belum ada).`,
    };
  }

  await db.from("leads").update({ status: "done" }).eq("id", memberId);
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${memberId}`);
  revalidatePath("/admin/reports");
  revalidatePath("/admin");

  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "NO_LLM_KEY"
          ? "Report scaffold dibuat. Tambahkan API key LLM (Claude/OpenAI/Gemini) di Setting agar analisis AI berjalan."
          : `Report scaffold dibuat (engine: ${result.error}).`,
    };
  }
  return { ok: true };
}

function buildReportScaffold(m: Record<string, unknown>) {
  const business = (m.business as string) || (m.name as string) || "Bisnis";
  const goal = (m.goal as string) || "—";
  const bottleneck = (m.bottleneck as string) || "—";
  return {
    title: `Audit ScaleUp — ${business}`,
    summary: `Report awal untuk ${business}. Goal: ${goal}. Bottleneck utama: ${bottleneck}. Skor & rekomendasi final dilengkapi oleh engine multi-agent.`,
    content: {
      generated: "scaffold",
      context: {
        business,
        website: m.website ?? null,
        category: m.category ?? null,
        goal,
        budget: m.budget ?? null,
        bottleneck,
        instagram: m.instagram ?? null,
        tiktok: m.tiktok ?? null,
        competitors: [m.competitor1 ?? null, m.competitor2 ?? null].filter(
          Boolean,
        ),
      },
      scores: {
        overall: null,
        cro: null,
        geo: null,
        social: null,
        tech: null,
      },
      note: "Scaffold otomatis dari input klien. Jalankan engine multi-agent (CMO/CBO/CTO/Creative + Red Team) untuk mengisi skor, kebocoran, dan roadmap final.",
      roadmap: {
        phase_1: ["Audit on-page & CTA", "Pasang WA funnel + tracking"],
        phase_2: ["GEO / AI Search citation", "Kalender konten 30 hari"],
        phase_3: ["Custom automation / dashboard bila diperlukan"],
      },
    },
  };
}

/* --------------------------------- reports -------------------------------- */

/** Set a report's status. When "paid", grant the member client-dashboard access. */
export async function setReportStatus(reportId: string, status: string) {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status === "sent") patch.sent_at = now;
  const { data: report } = await db
    .from("reports")
    .update(patch)
    .eq("id", reportId)
    .select("member_id")
    .single();

  if (status === "paid" && report?.member_id) {
    const { data: m } = await db
      .from("leads")
      .select("access_token")
      .eq("id", report.member_id)
      .single();
    await db
      .from("leads")
      .update({
        paid_at: now,
        access_token:
          (m?.access_token as string) || randomUUID().replace(/-/g, ""),
      })
      .eq("id", report.member_id);
  }
  revalidatePath(`/admin/members/${report?.member_id}`);
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
}

/** Backwards-compat: mark a report as Sent. */
export async function sendReport(reportId: string) {
  await setReportStatus(reportId, "sent");
}

export async function deleteReport(reportId: string) {
  const user = await requireAdmin();
  if (!user.perms.delete) return;
  const db = createSupabaseAdminClient();
  await db.from("reports").delete().eq("id", reportId);
  revalidatePath("/admin/reports");
}

/* ---------------------------------- plans --------------------------------- */

export async function addPlan(formData: FormData) {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  await db.from("plans").insert({
    member_id: (formData.get("member_id") as string) || null,
    title,
    detail: (formData.get("detail") as string) || null,
    phase: (formData.get("phase") as string) || null,
    status: (formData.get("status") as string) || "planned",
    start_date: (formData.get("start_date") as string) || null,
    due_date: (formData.get("due_date") as string) || null,
  });
  revalidatePath("/admin/calendar");
}

export async function updatePlanStatus(planId: string, status: string) {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  await db.from("plans").update({ status }).eq("id", planId);
  revalidatePath("/admin/calendar");
}

export async function deletePlan(planId: string) {
  const user = await requireAdmin();
  if (!user.perms.delete) return;
  const db = createSupabaseAdminClient();
  await db.from("plans").delete().eq("id", planId);
  revalidatePath("/admin/calendar");
}

/* --------------------------------- assets --------------------------------- */

function assetKind(mime: string): string {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  return "document";
}

export async function uploadAsset(formData: FormData) {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const brand = (formData.get("brand") as string) || null;
  const memberId = (formData.get("member_id") as string) || null;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${memberId ?? "general"}/${Date.now()}-${safeName}`;

  const { error } = await db.storage
    .from("assets")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return;

  await db.from("assets").insert({
    member_id: memberId,
    brand,
    name: file.name,
    kind: assetKind(file.type),
    mime_type: file.type,
    size_bytes: file.size,
    storage_path: path,
  });
  revalidatePath("/admin/assets");
}

export async function deleteAsset(assetId: string, storagePath: string) {
  const user = await requireAdmin();
  if (!user.perms.delete) return;
  const db = createSupabaseAdminClient();
  await db.storage.from("assets").remove([storagePath]);
  await db.from("assets").delete().eq("id", assetId);
  revalidatePath("/admin/assets");
}

/* -------------------------------- settings -------------------------------- */

export async function saveSettings(formData: FormData) {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const rows: { key: string; value: string; updated_at: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    // only persist non-empty values so we never blank a saved key by accident
    if (value.trim() === "") continue;
    rows.push({ key, value: value.trim(), updated_at: now });
  }
  if (rows.length) {
    await db.from("app_settings").upsert(rows, { onConflict: "key" });
  }
  revalidatePath("/admin/settings");
}

/* ---------------------------------- users --------------------------------- */

export async function addUser(formData: FormData) {
  const user = await requireAdmin();
  if (!user.perms.create) return;
  const db = createSupabaseAdminClient();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return;
  await db.from("admin_users").upsert(
    {
      email,
      name: (formData.get("name") as string) || null,
      role: (formData.get("role") as string) || "staff",
      can_create: formData.get("can_create") === "on",
      can_read: formData.get("can_read") === "on",
      can_update: formData.get("can_update") === "on",
      can_delete: formData.get("can_delete") === "on",
    },
    { onConflict: "email" },
  );
  revalidatePath("/admin/users");
}

export async function deleteUser(userId: string) {
  const user = await requireAdmin();
  if (!user.perms.delete) return;
  const db = createSupabaseAdminClient();
  await db.from("admin_users").delete().eq("id", userId);
  revalidatePath("/admin/users");
}

/* --------------------------- master plan pipeline -------------------------- */

const genToken = () => randomUUID().replace(/-/g, "");

/** Approval gate before running analytic/research/report. */
export async function approveMember(memberId: string) {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  await db
    .from("leads")
    .update({ approved_at: new Date().toISOString() })
    .eq("id", memberId);
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${memberId}`);
}

async function seedPlanItems(
  db: ReturnType<typeof createSupabaseAdminClient>,
  planId: string,
  memberId: string,
  content: Record<string, unknown>,
  builders: string[],
) {
  const recs = (content?.recommended_builders ?? []) as {
    builder: string;
    priority?: string;
  }[];
  const prioOf = (slug: string) =>
    recs.find((r) => r.builder === slug)?.priority ?? "medium";

  const items: Record<string, unknown>[] = [];
  let sort = 0;

  // Builder deliverables (tagged per builder).
  for (const slug of builders) {
    const def = builderDef(slug);
    if (!def) continue;
    const prio = prioOf(slug);
    for (const f of def.features) {
      items.push({
        title: f,
        builder: slug,
        category: "general",
        priority: prio,
        status: "propose",
        sort: sort++,
      });
    }
  }

  // Strategic roadmap items (general, foundational).
  const roadmap = (content?.roadmap ?? {}) as Record<string, string[]>;
  for (const phase of ["phase_1", "phase_2", "phase_3"]) {
    for (const t of roadmap[phase] ?? [])
      items.push({
        title: t,
        phase,
        category: "general",
        priority: "medium",
        status: "propose",
        sort: sort++,
      });
  }

  if (items.length) {
    await db.from("plan_items").insert(
      items.map((it) => ({
        master_plan_id: planId,
        member_id: memberId,
        ...it,
      })),
    );
  }
  return items.length;
}

/**
 * Report → Master Plan, built from the selected builders (defaults to the
 * engine's recommended_builders). Items are seeded per builder + roadmap.
 */
export async function createMasterPlanFromReport(
  reportId: string,
  builders?: string[],
): Promise<{ ok: boolean; planId?: string; error?: string }> {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  const { data: report } = await db
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .single();
  if (!report) return { ok: false, error: "Report tidak ditemukan." };

  const content = (report.content ?? {}) as Record<string, unknown>;
  const ctx = (content.context ?? {}) as Record<string, unknown>;
  const business = (ctx.business as string) ?? "Bisnis";

  const recSlugs = (
    (content.recommended_builders ?? []) as { builder: string }[]
  ).map((r) => r.builder);
  const selected =
    builders && builders.length
      ? builders.filter((b) => BUILDER_SLUGS.includes(b))
      : recSlugs.length
        ? recSlugs
        : BUILDER_SLUGS.slice(0, 3);

  const { count } = await db
    .from("master_plans")
    .select("id", { count: "exact", head: true })
    .eq("member_id", report.member_id);

  const { data: plan, error } = await db
    .from("master_plans")
    .insert({
      member_id: report.member_id,
      report_id: reportId,
      title: `Master Plan — ${business}`,
      version: (count ?? 0) + 1,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !plan)
    return {
      ok: false,
      error: error?.message ?? "Gagal buat master plan (jalankan migrasi SQL).",
    };

  await seedPlanItems(db, plan.id, report.member_id, content, selected);
  revalidatePath(`/admin/members/${report.member_id}`);
  revalidatePath("/admin/reports");
  return { ok: true, planId: plan.id };
}

export async function updatePlanItemStatus(itemId: string, status: string) {
  await requireAdmin();
  if (!PLAN_STATUSES.includes(status)) return;
  const db = createSupabaseAdminClient();
  const { data } = await db
    .from("plan_items")
    .update({ status })
    .eq("id", itemId)
    .select("member_id")
    .single();
  revalidatePath(`/admin/members/${data?.member_id}`);
  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard");
}

export async function addPlanItem(formData: FormData) {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  const planId = String(formData.get("master_plan_id") ?? "");
  const memberId = String(formData.get("member_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!planId || !title) return;
  await db.from("plan_items").insert({
    master_plan_id: planId,
    member_id: memberId || null,
    title,
    detail: (formData.get("detail") as string) || null,
    category: (formData.get("category") as string) || "general",
    priority: (formData.get("priority") as string) || "medium",
    status: "backlog",
  });
  revalidatePath(`/admin/members/${memberId}`);
}

/* -------------------------------- invoices -------------------------------- */

export async function createInvoice(formData: FormData) {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  const memberId = String(formData.get("member_id") ?? "");
  if (!memberId) return;
  const amount = Number(formData.get("amount") ?? 0) || 0;
  const description = String(formData.get("description") ?? "Paket ScaleUp");
  const d = new Date();
  const number = `INV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${randomUUID().slice(0, 4).toUpperCase()}`;
  await db.from("invoices").insert({
    member_id: memberId,
    master_plan_id: (formData.get("master_plan_id") as string) || null,
    number,
    currency: "IDR",
    amount,
    items: [{ desc: description, qty: 1, price: amount }],
    status: "draft",
    due_date: (formData.get("due_date") as string) || null,
  });
  revalidatePath(`/admin/members/${memberId}`);
}

export async function setInvoiceStatus(invoiceId: string, status: string) {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status === "paid") patch.paid_at = now;
  const { data: inv } = await db
    .from("invoices")
    .update(patch)
    .eq("id", invoiceId)
    .select("member_id")
    .single();

  if (status === "paid" && inv?.member_id) {
    const { data: m } = await db
      .from("leads")
      .select("access_token")
      .eq("id", inv.member_id)
      .single();
    await db
      .from("leads")
      .update({
        paid_at: now,
        access_token: (m?.access_token as string) || genToken(),
      })
      .eq("id", inv.member_id);
  }
  revalidatePath(`/admin/members/${inv?.member_id}`);
  revalidatePath("/admin");
}

/* -------------------------------- reminders ------------------------------- */

export async function addReminder(formData: FormData) {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  const memberId = String(formData.get("member_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!memberId || !title) return;
  await db.from("reminders").insert({
    member_id: memberId,
    title,
    detail: (formData.get("detail") as string) || null,
    due_date: (formData.get("due_date") as string) || null,
    audience: (formData.get("audience") as string) || "client",
  });
  revalidatePath(`/admin/members/${memberId}`);
  revalidatePath("/dashboard/reminders");
}

export async function toggleReminder(id: string, done: boolean) {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  const { data } = await db
    .from("reminders")
    .update({ done })
    .eq("id", id)
    .select("member_id")
    .single();
  revalidatePath(`/admin/members/${data?.member_id}`);
  revalidatePath("/dashboard/reminders");
}

/* --------------------------- update / recycle ----------------------------- */

/** Re-run the engine → new report → new master-plan version; archive the old. */
export async function recyclePlan(
  memberId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  const { data: member } = await db
    .from("leads")
    .select("*")
    .eq("id", memberId)
    .single();
  if (!member) return { ok: false, error: "Member tidak ditemukan." };

  await db
    .from("master_plans")
    .update({ status: "recycled" })
    .eq("member_id", memberId)
    .eq("status", "active");

  const result = await runAudit(member);
  let title: string;
  let summary: string | null;
  let content: Record<string, unknown>;
  if (result.ok && result.content) {
    title = result.title ?? `Audit ScaleUp — ${member.business ?? member.name}`;
    summary = result.summary ?? null;
    content = result.content;
  } else {
    const s = buildReportScaffold(member);
    title = s.title;
    summary = s.summary;
    content = s.content;
  }
  const { data: report, error } = await db
    .from("reports")
    .insert({ member_id: memberId, title, summary, content, status: "draft" })
    .select("id")
    .single();
  if (error || !report)
    return { ok: false, error: error?.message ?? "Gagal buat report baru." };

  const mp = await createMasterPlanFromReport(report.id);
  revalidatePath(`/admin/members/${memberId}`);
  revalidatePath("/dashboard");
  return mp.ok ? { ok: true } : { ok: false, error: mp.error };
}
