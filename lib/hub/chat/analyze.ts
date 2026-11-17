import "server-only";
import { createHash } from "node:crypto";
import { aiModel, askClaude } from "../ai";
import { getBrandKey } from "../secrets";
import { audit } from "../session";
import type { Ctx } from "../tasks/context";
import { hubTz, todayIn } from "../tasks/dates";
import { computeMetrics, digest, parseFindings, PROMPT_VERSION, systemPrompt, userPrompt, type Convo, type Kind } from "./model";

// One conversation in, one saved result out: the numbers by code, the meaning by the model. Shared by the upload route and the
// Connect route so both behave the same. The chat text is used for this request only and is never stored.

export type Analysis = { ok: true; id: string; cached: boolean } | { ok: false; error: string; status: number };
const fail = (error: string, status: number): Analysis => ({ ok: false, error, status });

export async function analyzeConversation(
  ctx: Ctx,
  input: { auditId: string; title: string; kind: Kind; oursNames: readonly string[]; convo: Convo; source: "upload" | "connect"; aiTimeoutMs?: number },
): Promise<Analysis> {
  const { auditId, title, kind, convo, source } = input;
  const oursNames = new Set(input.oursNames);
  const ours = new Set(convo.people.flatMap((n, i) => (oursNames.has(n) ? [i] : [])));
  if (kind !== "internal" && ours.size === 0) return fail("Pick who is on your side of this conversation.", 400);

  const { data: owned } = await ctx.admin.from("chat_audits").select("id").eq("brand_id", ctx.brandId).eq("id", auditId).maybeSingle();
  if (!owned) return fail("That audit no longer exists.", 404);
  const key = await getBrandKey(ctx.brandId, "claude", true);
  if (!key) return fail("Add an Anthropic key in Settings → Integrations to use AI.", 400);

  const today = todayIn(hubTz());
  const metrics = computeMetrics(convo, ours, kind, today);
  if (!metrics) return fail("A conversation needs at least two messages.", 400);
  const d = digest(convo, ours, kind);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ v: PROMPT_VERSION, model: aiModel(), kind, platform: convo.platform, ours: [...oursNames].sort(), text: d.text, omitted: d.omitted }))
    .digest("hex");

  let findings = null as ReturnType<typeof parseFindings>;
  let cached = false;
  let tokens = { in: 0, out: 0 };
  const hit = await ctx.admin.from("chat_audit_items").select("findings").eq("brand_id", ctx.brandId).eq("fingerprint", fingerprint).order("created_at", { ascending: false }).limit(1);
  if (hit.error) return fail("Chat audit needs its database step first (20261117310000_chat_audit.sql). Ask the person who runs the database updates.", 500);
  if (hit.data?.[0]) {
    findings = parseFindings(JSON.stringify(hit.data[0].findings ?? {}), today); // a follow-up date that has passed since is dropped
    cached = findings !== null;
  }
  if (!findings) {
    try {
      const reply = await askClaude(key, systemPrompt(kind, today, convo.platform), userPrompt(title, d), 2200, input.aiTimeoutMs ?? 55_000);
      tokens = reply.tokens;
      findings = parseFindings(reply.text, today);
    } catch (e) {
      console.error("[chat] AI failed:", e instanceof Error ? e.message : e);
      return fail("The AI request failed. Check the Anthropic key in Settings and try again.", 502);
    }
    if (!findings) return fail("The AI answer could not be read. Try this conversation again.", 502);
  }

  const { data, error } = await ctx.admin
    .from("chat_audit_items")
    .insert({ audit_id: auditId, brand_id: ctx.brandId, title, platform: convo.platform, channel: convo.channel ?? "", kind, ours: [...oursNames], fingerprint, metrics, findings })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[chat] save failed:", error?.message);
    return fail("Could not save the result. Try again.", 500);
  }
  // Counts and cost only: never the text.
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "chat.audit.item", target: data.id as string, meta: { source, platform: convo.platform, kind, messages: convo.msgs.length, chars: d.text.length, cached, model: aiModel(), tokens } });
  return { ok: true, id: data.id as string, cached };
}
