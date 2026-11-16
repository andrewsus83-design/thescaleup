import { notFound, redirect } from "next/navigation";
import { requireFunction } from "@/lib/hub/access";
import { dispositionFor } from "@/lib/hub/mail/files";
import { getReceivedAttachment } from "@/lib/hub/mail/resend";
import { signedUrl } from "@/lib/hub/storage/r2";
import { UUID } from "@/lib/hub/tasks/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Opens one attachment of a message. After checking that the person may read this brand's mail and that the file belongs to a
// message of this brand, the browser is sent to a short-lived link: Resend's for a received file, storage's for one we sent.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; messageId: string; attachmentId: string }> }) {
  const { slug, messageId, attachmentId } = await params;
  const { brand } = await requireFunction(slug, "mail");
  if (!UUID.test(messageId) || !/^[\w-]{1,100}$/.test(attachmentId)) notFound();
  const db = createSupabaseAdminClient();
  const { data: m } = await db.from("mail_messages").select("resend_id, direction, attachments").eq("brand_id", brand.id).eq("id", messageId).maybeSingle();
  const listed = Array.isArray(m?.attachments) && (m.attachments as { id?: string }[]).some((a) => a.id === attachmentId);
  if (!m || !listed) notFound();

  if (m.direction === "out") {
    if (!UUID.test(attachmentId)) notFound();
    const { data: file } = await db.from("mail_attachments").select("filename, content_type, storage_key").eq("brand_id", brand.id).eq("message_id", messageId).eq("id", attachmentId).maybeSingle();
    if (!file) notFound();
    const url = signedUrl("GET", file.storage_key as string, 120, { "response-content-disposition": dispositionFor(file.filename as string, file.content_type as string) });
    if (!url) return new Response("File storage is not set up on the server.", { status: 503 });
    redirect(url);
  }

  if (m.direction !== "in" || !m.resend_id) notFound();
  const got = await getReceivedAttachment(m.resend_id as string, attachmentId);
  if (!got.ok || !got.data.download_url) return new Response("The file could not be fetched. Try again.", { status: 502 });
  redirect(got.data.download_url);
}
