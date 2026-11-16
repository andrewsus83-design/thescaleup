import { notFound, redirect } from "next/navigation";
import { requireFunction } from "@/lib/hub/access";
import { getReceivedAttachment } from "@/lib/hub/mail/resend";
import { UUID } from "@/lib/hub/tasks/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Opens one attachment of a received message. Resend hands out a short-lived download link, so the browser is sent there
// after this checks that the person may read this brand's mail and that the file belongs to a message of this brand.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; messageId: string; attachmentId: string }> }) {
  const { slug, messageId, attachmentId } = await params;
  const { brand } = await requireFunction(slug, "mail");
  if (!UUID.test(messageId) || !/^[\w-]{1,100}$/.test(attachmentId)) notFound();
  const { data: m } = await createSupabaseAdminClient().from("mail_messages").select("resend_id, direction, attachments").eq("brand_id", brand.id).eq("id", messageId).maybeSingle();
  const listed = Array.isArray(m?.attachments) && (m.attachments as { id?: string }[]).some((a) => a.id === attachmentId);
  if (!m || m.direction !== "in" || !m.resend_id || !listed) notFound();
  const got = await getReceivedAttachment(m.resend_id as string, attachmentId);
  if (!got.ok || !got.data.download_url) return new Response("The file could not be fetched. Try again.", { status: 502 });
  redirect(got.data.download_url);
}
