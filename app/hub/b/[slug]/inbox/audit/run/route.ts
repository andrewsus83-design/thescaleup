import { analyzeConversation } from "@/lib/hub/chat/analyze";
import { isKind, isPlatform, LIMITS, type Convo } from "@/lib/hub/chat/model";
import { atLeast } from "@/lib/hub/permissions";
import { allow } from "@/lib/hub/ratelimit";
import { taskContext } from "@/lib/hub/tasks/context";

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
  const convo: Convo = { name: title, platform, channel, people, msgs };

  const done = await analyzeConversation(ctx, { auditId, title, kind, oursNames: [...oursNames], convo, source: "upload" });
  return done.ok ? json({ ok: true, id: done.id, cached: done.cached }) : json({ ok: false, error: done.error }, done.status);
}
