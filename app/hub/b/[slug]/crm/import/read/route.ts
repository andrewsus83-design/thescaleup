import { atLeast } from "@/lib/hub/permissions";
import { readTable } from "@/lib/hub/products/file";
import { allow } from "@/lib/hub/ratelimit";
import { taskContext } from "@/lib/hub/tasks/context";

// Reads an uploaded Excel or CSV file and sends its rows back as text, for the import steps that follow in the browser.
// Nothing is saved here. A route handler rather than a server action, because a file can be bigger than an action's body limit.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return json({ ok: false, error: "That upload could not be read. Try again." }, 400);
  }
  const c = await taskContext(fd.get("brandId"), "crm");
  if (!c.ok) return json({ ok: false, error: c.error }, 403);
  const { ctx } = c;
  if (ctx.slug !== slug) return json({ ok: false, error: "Unknown brand." }, 404);
  if (!atLeast(ctx.level, "edit")) return json({ ok: false, error: "You can see the CRM here but not change it." }, 403);
  if (!allow(`crm-read:${ctx.user.id}`, 60)) return json({ ok: false, error: "That is a lot of uploads in an hour. Try again a bit later." }, 429);
  const file = fd.get("file");
  if (!(file instanceof File)) return json({ ok: false, error: "Choose a file first." }, 400);
  const t = await readTable(file);
  return t.ok ? json(t) : json(t, 422);
}
