import { analyzeConversation } from "@/lib/hub/chat/analyze";
import { checkRange, explainFailure, pickSources, summarize, type Source } from "@/lib/hub/chat/connect";
import { loadSources, readSource } from "@/lib/hub/chat/zernio";
import { atLeast } from "@/lib/hub/permissions";
import { allow } from "@/lib/hub/ratelimit";
import { taskContext, UUID } from "@/lib/hub/tasks/context";
import { hubTz, todayIn } from "@/lib/hub/tasks/dates";

// Connect: audit conversations straight from the brand's Zernio inbox instead of an upload. Two steps, and the person decides in
// between. "check" only lists what Zernio holds and which dates each account covers: no AI, no cost. "read" reads one conversation
// or post for the dates the person confirmed and runs the same analysis as an upload. Chat text is never stored.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const short = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

function readSourceBody(v: unknown): Source | null {
  if (!isObj(v) || (v.kind !== "dm" && v.kind !== "comments")) return null;
  const id = short(v.id, 300);
  const accountId = short(v.accountId, 200);
  const platform = short(v.platform, 30);
  if (!id || !accountId || !platform) return null;
  return { kind: v.kind, id, accountId, platform, account: short(v.account, 80), title: short(v.title, 120) || "Conversation", at: short(v.at, 40) };
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t0 = Date.now();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "That request could not be read. Try again." }, 400);
  }
  if (!isObj(body)) return json({ ok: false, error: "That request could not be read. Try again." }, 400);

  const c = await taskContext(body.brandId, "inbox");
  if (!c.ok) return json({ ok: false, error: c.error }, 403);
  const { ctx } = c;
  if (ctx.slug !== slug) return json({ ok: false, error: "Unknown brand." }, 404);
  if (!atLeast(ctx.level, "edit")) return json({ ok: false, error: "You can see the Inbox here but not change it." }, 403);

  const tz = hubTz();
  const range = checkRange(body.from, body.to, todayIn(tz));
  if (!range.ok) return json({ ok: false, error: range.error }, 400);
  const { from, to } = range;

  if (body.step === "check") {
    if (!allow(`chat-check:${ctx.user.id}`, 30)) return json({ ok: false, error: "That is a lot of checks in an hour. Try again later." }, 429);
    const got = await loadSources(ctx.brandId, from, body.comments === true, tz);
    if (!got.ok) return json({ ok: false, error: got.problem.message, kind: got.problem.kind }, got.problem.kind === "no-key" ? 400 : 502);
    const { sources, failed, more, commentsNote } = got.loaded;
    const picked = pickSources(sources, from, to, tz).slice(0, 400);
    return json({
      ok: true,
      from,
      to,
      accounts: summarize(sources, from, to, tz),
      sources: picked,
      failed: failed.map((f) => ({ account: f.account || "Account", platform: f.platform, why: explainFailure(f) })),
      more,
      commentsNote,
    });
  }

  if (body.step === "read") {
    if (!allow(`chat-connect:${ctx.user.id}`, 120)) return json({ ok: false, error: "That is a lot of conversations in an hour. Try again later." }, 429);
    const auditId = body.auditId;
    const src = readSourceBody(body.source);
    if (typeof auditId !== "string" || !UUID.test(auditId) || !src) return json({ ok: false, error: "That conversation is not valid." }, 400);
    const read = await readSource(ctx.brandId, src, from, to, tz);
    if (!read.ok) return json({ ok: false, error: read.problem.message }, 502);
    if (!read.built) return json({ ok: false, skipped: true, error: "Fewer than two messages inside these dates." });
    const done = await analyzeConversation(ctx, {
      auditId,
      title: src.title,
      kind: "client",
      oursNames: read.built.ours,
      convo: read.built.convo,
      source: "connect",
      aiTimeoutMs: Math.max(15_000, 55_000 - (Date.now() - t0)),
    });
    return done.ok ? json({ ok: true, id: done.id, cached: done.cached }) : json({ ok: false, error: done.error }, done.status);
  }
  return json({ ok: false, error: "That request is not valid." }, 400);
}
