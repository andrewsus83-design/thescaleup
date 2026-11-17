import { getCampaign } from "@/lib/hub/email/data";
import { EMAIL_LIMITS, firstName, merge, renderEmail, type Vars } from "@/lib/hub/email/model";
import { deliver } from "@/lib/hub/email/deliver";
import { signUnsubscribe } from "@/lib/hub/email/token";
import { publicOrigin, unsubscribeKey } from "@/lib/hub/email/secret";
import { listAddresses, listDomains, sendable } from "@/lib/hub/mail/data";
import { fromHeader } from "@/lib/hub/mail/model";
import { sendBatch } from "@/lib/hub/mail/resend";
import { atLeast } from "@/lib/hub/permissions";
import { allow } from "@/lib/hub/ratelimit";
import { audit } from "@/lib/hub/session";
import { taskContext, UUID } from "@/lib/hub/tasks/context";

// Sends the next batch of a campaign that has been started. The page calls this again and again until nothing is queued, so a campaign
// of a thousand people is twenty small requests that each finish in a few seconds, and a closed tab only pauses it: the queue is in
// the database and the same page picks it up. A batch is sent with a fixed key, so Resend ignores it if it is sent twice.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const body = (await req.json().catch(() => null)) as { brandId?: unknown } | null;
  const c = await taskContext(body?.brandId, "mail");
  if (!c.ok) return json({ ok: false, error: c.error }, 403);
  const { ctx } = c;
  if (ctx.slug !== slug || !UUID.test(id)) return json({ ok: false, error: "Unknown campaign." }, 404);
  if (!atLeast(ctx.level, "edit")) return json({ ok: false, error: "You can read mail here but not change it." }, 403);
  if (!allow(`email-batch:${id}`, 400)) return json({ ok: false, error: "Slow down a little. Try again in a minute." }, 429);
  const key = unsubscribeKey();
  if (!key) return json({ ok: false, error: "Campaigns need the workspace encryption key (SECRETS_KEY_1) to sign unsubscribe links." }, 503);

  const camp = await getCampaign(ctx.brandId, id);
  if (!camp) return json({ ok: false, error: "Unknown campaign." }, 404);
  if (camp.status === "draft") return json({ ok: false, error: "This campaign has not been started." }, 409);

  const tally = async () => {
    const count = async (status: string) => (await ctx.admin.from("email_sends").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", status)).count ?? 0;
    const [queued, sent, bounced, complained, failed] = await Promise.all([count("queued"), count("sent"), count("bounced"), count("complained"), count("failed")]);
    return { queued, sent: sent + bounced + complained, failed };
  };
  const finish = async () => {
    const t = await tally();
    const done = t.queued === 0;
    await ctx.admin.from("email_campaigns").update({ sent: t.sent, failed: t.failed, ...(done ? { status: "sent", sent_at: new Date().toISOString() } : {}) }).eq("id", id);
    return { ...t, done };
  };
  if (camp.status === "sent") return json({ ok: true, ...(await finish()), total: camp.total });

  const domains = await listDomains(ctx.brandId);
  const from = sendable(await listAddresses(ctx.brandId, domains), domains).find((a) => a.id === camp.address_id);
  if (!from) return json({ ok: false, error: "The address this campaign sends from is no longer available or its domain is not verified. Fix it in Settings, Mailbox." }, 409);
  const { data: brand } = await ctx.admin.from("brands").select("name").eq("id", ctx.brandId).maybeSingle();

  const { data: batch } = await ctx.admin.from("email_sends").select("id, email, vars").eq("campaign_id", id).eq("status", "queued").order("id").limit(EMAIL_LIMITS.batch);
  if (!batch?.length) return json({ ok: true, ...(await finish()), total: camp.total });

  const origin = publicOrigin();
  const emails = batch.map((s) => {
    const v = (s.vars ?? {}) as { name?: string; company?: string };
    const vars: Vars = { first_name: firstName(v.name ?? ""), name: v.name, company: v.company, brand: String(brand?.name ?? "") };
    const token = encodeURIComponent(signUnsubscribe(key, ctx.brandId, String(s.email)));
    const out = renderEmail(camp.doc, vars, `${origin}/unsubscribe/${token}`);
    return {
      from: fromHeader(from.display_name, from.email),
      to: [String(s.email)],
      subject: merge(camp.doc.subject, vars).replace(/[\r\n]+/g, " ").trim().slice(0, EMAIL_LIMITS.subject) || "(no subject)",
      text: out.text,
      html: out.html,
      headers: { "List-Unsubscribe": `<${origin}/api/unsubscribe/${token}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    };
  });
  const out = await deliver(sendBatch, id, emails, batch.map((s) => String(s.id)));
  // Busy or down: nothing changes, and the page tries again. A batch Resend already took is not sent twice, because every attempt uses the same key.
  if (out === "retry") return json({ ok: false, retry: true, error: "Resend is busy. Trying again in a moment." }, 503);
  const at = new Date().toISOString();
  await Promise.all(
    batch.map((s, i) =>
      out[i].id
        ? ctx.admin.from("email_sends").update({ status: "sent", resend_id: out[i].id, sent_at: at }).eq("id", s.id)
        : ctx.admin.from("email_sends").update({ status: "failed", error: (out[i].error ?? "Resend did not confirm this email.").slice(0, 300) }).eq("id", s.id),
    ),
  );
  const t = await finish();
  if (t.done) await audit({ actor: ctx.user, brandId: ctx.brandId, action: "email.campaign.done", target: id, meta: { sent: t.sent, failed: t.failed } });
  return json({ ok: true, ...t, total: camp.total });
}
