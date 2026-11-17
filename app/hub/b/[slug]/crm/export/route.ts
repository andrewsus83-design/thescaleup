import { requireFunction } from "@/lib/hub/access";
import { NO_FILTER, findAll, getStages, type PeopleFilter } from "@/lib/hub/crm/data";
import { toCsv } from "@/lib/hub/crm/export";
import { isKind, parseTags } from "@/lib/hub/crm/model";
import { searchTerm } from "@/lib/hub/mail/model";
import { allow } from "@/lib/hub/ratelimit";
import { canManageTeam } from "@/lib/hub/rules";
import { audit } from "@/lib/hub/session";
import { UUID } from "@/lib/hub/tasks/context";
import { hubTz, todayIn } from "@/lib/hub/tasks/dates";

// Downloads the leads or clients that match the list's search and filters as a CSV file. Managers only: a file takes everyone's
// contact details out of the hub at once, so it is limited, counted and written to the audit trail.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const deny = (status: number, error: string) => Response.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, brand, actor } = await requireFunction(slug, "crm");
  if (!canManageTeam(actor)) return deny(403, "Only a manager can export the CRM.");
  if (!allow(`crm-export:${user.id}`, 20)) return deny(429, "That is a lot of exports in an hour. Try again a bit later.");

  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind");
  if (!isKind(kind)) return deny(400, "Pick leads or clients.");
  const stage = sp.get("stage") ?? "";
  const importId = sp.get("import") ?? "";
  const filter: PeopleFilter = {
    ...NO_FILTER,
    q: searchTerm(sp.get("q")),
    stage: stage === "open" || /^[a-z0-9][a-z0-9_-]{0,39}$/.test(stage) ? stage : "",
    due: sp.get("due") === "1",
    tag: parseTags(sp.get("tag") ?? "")[0] ?? "",
    importId: UUID.test(importId) ? importId : null,
  };

  const today = todayIn(hubTz());
  let people;
  try {
    people = await findAll(brand.id, kind, filter, today);
  } catch (e) {
    console.error("[crm] export failed:", e instanceof Error ? e.message : e);
    return deny(500, "Could not read the list. Try again.");
  }
  const csv = toCsv(people, await getStages(brand.id));
  await audit({ actor: user, brandId: brand.id, action: "crm.export", meta: { kind, rows: people.length, filtered: Boolean(filter.q || filter.stage || filter.due || filter.tag || filter.importId) } });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind === "lead" ? "leads" : "clients"}-${brand.slug}-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
