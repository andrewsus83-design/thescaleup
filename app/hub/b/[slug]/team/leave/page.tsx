import type { Metadata } from "next";
import { CalendarOff } from "lucide-react";
import { Alert, Card, Chip, EmptyState, PageHeader, type Tone } from "@/components/brand/primitives";
import { BackLink } from "@/components/hub/back-link";
import { LeaveButtons, LeaveForm } from "@/components/hub/hr/forms";
import { requireFunction } from "@/lib/hub/access";
import { getSettings, listLeave, listPeople, personForUser } from "@/lib/hub/hr/data";
import { LEAVE_LABEL, leaveBalance, type Leave, type LeaveStatus } from "@/lib/hub/hr/model";
import { atLeast } from "@/lib/hub/permissions";
import { fmtDay, hubTz, todayIn } from "@/lib/hub/tasks/dates";

export const metadata: Metadata = { title: "Leave" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<LeaveStatus, Tone> = { pending: "warn", approved: "ok", rejected: "bad", cancelled: "neutral" };
const STATUS_WORD: Record<LeaveStatus, string> = { pending: "Waiting", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled" };
const span = (l: Leave) => (l.start === l.end ? `${fmtDay(l.start)} ${l.start.slice(0, 4)}` : `${fmtDay(l.start)} to ${fmtDay(l.end)} ${l.end.slice(0, 4)}`);

export default async function LeavePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, brand, actor, access } = await requireFunction(slug, "team");
  const manages = atLeast(access.team, "edit");
  const today = todayIn(hubTz());
  const year = today.slice(0, 4);
  const since = `${Number(year) - 1}-01-01`;
  const [settings, mine, people] = await Promise.all([getSettings(brand.id), personForUser(brand.id, user.id), manages ? listPeople(brand.id) : Promise.resolve([])]);
  // Someone who manages the team sees everyone's leave. Everyone else sees only their own.
  const leave = manages ? await listLeave(brand.id, since) : mine ? await listLeave(brand.id, since, mine.id) : [];
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const allowanceOf = new Map(people.map((p) => [p.id, p.leaveDays ?? settings.leaveDays]));
  const balance = mine ? leaveBalance(leave, mine.id, year, mine.leaveDays ?? settings.leaveDays) : null;
  const waiting = manages ? leave.filter((l) => l.status === "pending") : [];
  const own = mine ? leave.filter((l) => l.personId === mine.id) : [];
  const others = manages ? leave.filter((l) => l.status !== "pending" && l.personId !== mine?.id).slice(0, 60) : [];
  const topManager = actor === "owner" || actor === "founder";
  const active = people.filter((p) => p.status === "active").map((p) => ({ id: p.id, name: p.name }));

  const Item = ({ l, showName }: { l: Leave; showName: boolean }) => {
    const isOwn = l.personId === mine?.id;
    const left = showName ? leaveBalance(leave, l.personId, l.start.slice(0, 4), allowanceOf.get(l.personId) ?? settings.leaveDays).left : null;
    return (
      <li className="px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-body font-semibold text-ink-800">{showName ? (nameOf.get(l.personId) ?? "Former person") : LEAVE_LABEL[l.kind]}</p>
          <Chip tone={STATUS_TONE[l.status]}>{STATUS_WORD[l.status]}</Chip>
        </div>
        <p className="mt-1 text-small text-ink-600">
          {showName ? `${LEAVE_LABEL[l.kind]}, ` : ""}
          {span(l)}, {l.days} working day{l.days === 1 ? "" : "s"}
        </p>
        {l.note && <p className="mt-1 whitespace-pre-line text-small text-ink-500">{l.note}</p>}
        {showName && l.status === "pending" && l.kind === "annual" && left !== null && (
          <p className="mt-1 text-small text-ink-500">
            {left} annual day{left === 1 ? "" : "s"} left before this request{l.days > left ? ". This asks for more than is left." : "."}
          </p>
        )}
        <LeaveButtons
          brandId={brand.id}
          leaveId={l.id}
          canDecide={manages && l.status === "pending" && (!isOwn || topManager)}
          canCancel={manages ? l.status === "pending" || l.status === "approved" : isOwn && l.status === "pending"}
        />
      </li>
    );
  };
  const listCls = "divide-y divide-ink-100 overflow-hidden rounded-field border-control border-ink-200";

  return (
    <div className="mx-auto w-full max-w-2xl">
      <BackLink href={`/hub/b/${slug}/team`}>Team</BackLink>
      <PageHeader title="Leave" description={manages ? "Ask for time off, and decide the team's requests." : "Ask for time off and see what was decided."} />

      <div className="space-y-10">
        {balance && (
          <section aria-labelledby="lv-bal">
            <h2 id="lv-bal" className="mb-3 font-title text-h3 text-ink-800">
              Your annual leave in {year}
            </h2>
            <Card>
              <dl className="grid grid-cols-3 gap-4 text-center">
                {[
                  ["Days left", balance.left],
                  ["Taken or approved", balance.used],
                  ["Waiting", balance.pending],
                ].map(([label, n]) => (
                  <div key={label}>
                    <dd className="font-title text-h2 text-ink-800">{n}</dd>
                    <dt className="text-small text-ink-500">{label}</dt>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-small text-ink-500">Out of {balance.allowance} days a year. Sick, unpaid and other leave do not use these days.</p>
            </Card>
          </section>
        )}

        {waiting.length > 0 && (
          <section aria-labelledby="lv-wait">
            <h2 id="lv-wait" className="mb-3 font-title text-h3 text-ink-800">
              Waiting for a decision
            </h2>
            <ul className={listCls}>
              {waiting.map((l) => (
                <Item key={l.id} l={l} showName />
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="lv-ask">
          <h2 id="lv-ask" className="mb-3 font-title text-h3 text-ink-800">
            Ask for leave
          </h2>
          {mine || (manages && active.length > 0) ? (
            <Card>
              <LeaveForm brandId={brand.id} people={manages ? active : null} ownId={mine?.status === "active" ? mine.id : null} today={today} />
              <p className="mt-4 text-small text-ink-500">Working days are counted {settings.workdays === 5 ? "Monday to Friday" : settings.workdays === 6 ? "Monday to Saturday" : "every day"}. The hub does not know public holidays, so they count as working days.</p>
            </Card>
          ) : (
            <Alert tone="info">{manages ? "Add people under Team, People first. Leave is asked for a person's record." : "You have no people record in this brand yet. Ask whoever manages the team to add you, then you can ask for leave here."}</Alert>
          )}
        </section>

        {mine && (
          <section aria-labelledby="lv-mine">
            <h2 id="lv-mine" className="mb-3 font-title text-h3 text-ink-800">
              Your requests
            </h2>
            {own.length === 0 ? (
              <EmptyState icon={<CalendarOff className="size-6" aria-hidden />} title="No leave asked for yet" hint="Your requests and what was decided show up here." />
            ) : (
              <ul className={listCls}>
                {own.map((l) => (
                  <Item key={l.id} l={l} showName={false} />
                ))}
              </ul>
            )}
          </section>
        )}

        {others.length > 0 && (
          <section aria-labelledby="lv-team">
            <h2 id="lv-team" className="mb-3 font-title text-h3 text-ink-800">
              The team&apos;s leave
            </h2>
            <ul className={listCls}>
              {others.map((l) => (
                <Item key={l.id} l={l} showName />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
