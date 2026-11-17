import { createHash } from "node:crypto";
import { askClaude, aiModel } from "@/lib/hub/ai";
import { computeMetrics, digest, isKind, isPlatform, LIMITS, parseFindings, PROMPT_VERSION, systemPrompt, userPrompt, type Convo } from "@/lib/hub/chat/model";
import { atLeast } from "@/lib/hub/permissions";
import { allow } from "@/lib/hub/ratelimit";
import { getBrandKey } from "@/lib/hub/secrets";
import { audit } from "@/lib/hub/session";
import { taskContext } from "@/lib/hub/tasks/context";
import { hubTz, todayIn } from "@/lib/hub/tasks/dates";

// Reads one conversation: works out the numbers from the messages, asks Claude what it means, and keeps the numbers and the
// findings. The chat text is used for this request only and is never stored. A route handler, not a server action, because a
// chat can be bigger than an action's body limit. The browser has already read the file and cut it to the period the person chose.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const MIN_T = 946_684_800_000 / 60_000; // 2000-01-01
const MAX_T = 4_102_444_800_000 / 60_000; // 2100-01-01

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > LIMITS.body) return json({ ok: false, error: "That conversation is too big. Choose a shorter period." }, 413);
  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > LIMITS.body) return json({ ok: false, error: "That conversation is too big. Choose a shorter period." }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "That upload could not be read. Try again." }, 400);
  }
  if (!isObj(body)) return json({ ok: false, error: "That upload could not be read. Try again." }, 400);

  const c = await taskContext(body.brandId, "inbox");
  if (!c.ok) return json({ ok: false, error: c.error }, 403);
  const { ctx } = c;
  if (ctx.slug !== slug) return json({ ok: false, error: "Unknown brand." }, 404);
  if (!atLeast(ctx.level, "edit")) return json({ ok: false, error: "You can see the Inbox here but not change it." }, 403);
  if (!allow(`chat-run:${ctx.user.id}`, 60)) return json({ ok: false, error: "That is a lot of conversations in an hour. Try again later." }, 429);

  // ---- the conversation, checked piece by piece: nothing from the browser is trusted
  const auditId = body.auditId;
  const { platform, kind } = body;
  if (typeof auditId !== "string" || !UUID.test(auditId) || !isPlatform(platform) || !isKind(kind)) return json({ ok: false, error: "That conversation is not valid." }, 400);
  const people = Array.isArray(body.people) ? body.people.filter((p): p is string => typeof p === "string").map((p) => p.slice(0, 60)).slice(0, LIMITS.people) : [];
  const rawMsgs = Array.isArray(body.m) ? body.m : [];
  if (!people.length || rawMsgs.length < 2 || rawMsgs.length > LIMITS.messages) return json({ ok: false, error: "A conversation needs at least two messages." }, 400);
  const msgs: Convo["msgs"] = [];
  for (const r of rawMsgs) {
    if (!Array.isArray(r) || typeof r[0] !== "number" || typeof r[1] !== "number" || typeof r[2] !== "string") continue;
    const [t, p, x] = r as [number, number, string];
    if (!Number.isFinite(t) || t < MIN_T || t > MAX_T || !Number.isInteger(p) || p < 0 || p >= people.length || !x.trim()) continue;
    msgs.push({ t: Math.round(t), p, x: x.slice(0, LIMITS.text) });
  }
  if (msgs.length < 2) return json({ ok: false, error: "A conversation needs at least two messages." }, 400);
  const title = (typeof body.title === "string" ? body.title : "").replace(/\s+/g, " ").trim().slice(0, LIMITS.name) || "Conversation";
  const channel = (typeof body.channel === "string" ? body.channel : "").replace(/\s+/g, " ").trim().slice(0, 60);
  const oursNames = new Set(Array.isArray(body.ours) ? body.ours.filter((o): o is string => typeof o === "string").map((o) => o.slice(0, 60)) : []);
  const ours = new Set(people.flatMap((n, i) => (oursNames.has(n) ? [i] : [])));
  if (kind !== "internal" && ours.size === 0) return json({ ok: false, error: "Pick who is on your side of this conversation." }, 400);
  const convo: Convo = { name: title, platform, channel, people, msgs };

  const { data: owned } = await ctx.admin.from("chat_audits").select("id").eq("brand_id", ctx.brandId).eq("id", auditId).maybeSingle();
  if (!owned) return json({ ok: false, error: "That audit no longer exists." }, 404);
  const key = await getBrandKey(ctx.brandId, "claude", true);
  if (!key) return json({ ok: false, error: "Add an Anthropic key in Settings → Integrations to use AI." }, 400);

  // ---- numbers by code, meaning by the model
  const today = todayIn(hubTz());
  const metrics = computeMetrics(convo, ours, kind, today);
  if (!metrics) return json({ ok: false, error: "A conversation needs at least two messages." }, 400);
  const d = digest(convo, ours, kind);
  const fingerprint = createHash("sha256").update(JSON.stringify({ v: PROMPT_VERSION, model: aiModel(), kind, platform, ours: [...oursNames].sort(), text: d.text, omitted: d.omitted })).digest("hex");

  let findings = null as ReturnType<typeof parseFindings>;
  let cached = false;
  let tokens = { in: 0, out: 0 };
  const hit = await ctx.admin.from("chat_audit_items").select("findings").eq("brand_id", ctx.brandId).eq("fingerprint", fingerprint).order("created_at", { ascending: false }).limit(1);
  if (hit.error) return json({ ok: false, error: "Chat audit needs its database step first (20261117310000_chat_audit.sql). Ask the person who runs the database updates." }, 500);
  if (hit.data?.[0]) {
    findings = parseFindings(JSON.stringify(hit.data[0].findings ?? {}), today); // a follow-up date that has passed since is dropped
    cached = findings !== null;
  }
  if (!findings) {
    try {
      const reply = await askClaude(key, systemPrompt(kind, today, platform), userPrompt(title, d), 2200, 55_000);
      tokens = reply.tokens;
      findings = parseFindings(reply.text, today);
    } catch (e) {
      console.error("[chat] AI failed:", e instanceof Error ? e.message : e);
      return json({ ok: false, error: "The AI request failed. Check the Anthropic key in Settings and try again." }, 502);
    }
    if (!findings) return json({ ok: false, error: "The AI answer could not be read. Try this conversation again." }, 502);
  }

  const { data, error } = await ctx.admin
    .from("chat_audit_items")
    .insert({ audit_id: auditId, brand_id: ctx.brandId, title, platform, channel, kind, ours: [...oursNames], fingerprint, metrics, findings })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[chat] save failed:", error?.message);
    return json({ ok: false, error: "Could not save the result. Try again." }, 500);
  }
  // Counts and cost only: never the text.
  await audit({ actor: ctx.user, brandId: ctx.brandId, action: "chat.audit.item", target: data.id as string, meta: { platform, kind, messages: msgs.length, chars: d.text.length, cached, model: aiModel(), tokens } });
  return json({ ok: true, id: data.id, cached });
}
