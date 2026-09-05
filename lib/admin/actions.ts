"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MemberStatus } from "@/lib/admin/config";

const VALID_STATUS: MemberStatus[] = [
  "pending",
  "processing",
  "done",
  "prospect",
  "joined",
  "rejected",
];

/* --------------------------------- members -------------------------------- */

export async function setMemberStatus(memberId: string, status: string) {
  await requireAdmin();
  if (!VALID_STATUS.includes(status as MemberStatus)) return;
  const db = createSupabaseAdminClient();
  const patch: Record<string, unknown> = { status };
  if (status === "joined") patch.joined_at = new Date().toISOString();
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
export async function processMember(memberId: string) {
  await requireAdmin();
  const db = createSupabaseAdminClient();

  const { data: member } = await db
    .from("leads")
    .select("*")
    .eq("id", memberId)
    .single();
  if (!member) return;

  await db
    .from("leads")
    .update({ status: "processing" })
    .eq("id", memberId);

  const scaffold = buildReportScaffold(member);
  await db.from("reports").insert({
    member_id: memberId,
    title: scaffold.title,
    summary: scaffold.summary,
    content: scaffold.content,
    status: "draft",
  });

  await db
    .from("leads")
    .update({ status: "done", processed_at: new Date().toISOString() })
    .eq("id", memberId);

  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${memberId}`);
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
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

export async function sendReport(reportId: string) {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: report } = await db
    .from("reports")
    .update({ status: "sent", sent_at: now })
    .eq("id", reportId)
    .select("member_id")
    .single();
  // TODO: wire real email delivery (Resend) here.
  if (report?.member_id) {
    await db
      .from("leads")
      .update({ status: "prospect", report_sent_at: now })
      .eq("id", report.member_id);
  }
  revalidatePath("/admin/reports");
  revalidatePath("/admin/members");
  revalidatePath("/admin");
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
