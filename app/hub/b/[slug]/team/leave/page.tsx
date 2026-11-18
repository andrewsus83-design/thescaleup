import type { Metadata } from "next";
import { CalendarOff } from "lucide-react";
import { Alert, Chip, EmptyState, PageHeader, type Tone } from "@/components/brand/primitives";
import { BackLink } from "@/components/hub/back-link";
import { LeaveButtons, LeaveForm } from "@/components/hub/hr/forms";
import { InkFigure, InkPanel, InkStats, Panel, panelRowsCls, Split, SplitMain, SplitSide } from "@/components/hub/panels";
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
      <li className="py-4">
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
  
  const workdays = settings.workdays === 5 ? "Monday to Friday" : settings.workdays === 6 ? "Monday to Saturday" : "every day";

  return (
    <div>
      <BackLink href={`/hub/b/${slug}/team`}>Team</BackLink>
      <PageHeader title="Leave" description={manages ? "Ask for time off, and decide the team's requests." : "Ask for time off and see what was decided."} />

      <Split>
        {/* The balance and the form are what a person comes for, so on a phone they come first. */}
        <SplitSide first>
          {balance && (
            <InkPanel label={`Your annual leave in ${year}`}>
              <InkFigure label={balance.left === 1 ? "day left" : "days left"} value={balance.left} warn={balance.left < 0} />
              <InkStats
                items={[
                  { label: "Taken or approved", value: balance.used },
                  { label: "Waiting", value: balance.pending },
                ]}
              />
              <p className="mt-4 text-caption font-normal text-ink-300">Out of {balance.allowance} days a year. Sick, unpaid and other leave do not use these days.</p>
            </InkPanel>
          )}
          {mine || (manages && active.length > 0) ? (
            <Panel id="lv-ask" title="Ask for leave" hint={`Working days are counted ${workdays}. The hub does not know public holidays, so they count as working days.`}>
              <LeaveForm brandId={brand.id} people={manages ? active : null} ownId={mine?.status === "active" ? mine.id : null} today={today} />
            </Panel>
          ) : (
            <Alert tone="info">{manages ? "Add people under Team, People first. Leave is asked for a person's record." : "You have no people record in this brand yet. Ask whoever manages the team to add you, then you can ask for leave here."}</Alert>
          )}
        </SplitSide>

        <SplitMain>
          {waiting.length > 0 && (
            <Panel id="lv-wait" title="Waiting for a decision" hint={`${waiting.length} request${waiting.length === 1 ? "" : "s"}`}>
              <ul className={panelRowsCls}>
                {waiting.map((l) => (
                  <Item key={l.id} l={l} showName />
                ))}
              </ul>
            </Panel>
          )}

          {mine && (
            <Panel id="lv-mine" title="Your requests">
              {own.length === 0 ? (
                <EmptyState icon={<CalendarOff className="size-6" aria-hidden />} title="No leave asked for yet" hint="Your requests and what was decided show up here." />
              ) : (
                <ul className={panelRowsCls}>
                  {own.map((l) => (
                    <Item key={l.id} l={l} showName={false} />
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {others.length > 0 && (
            <Panel id="lv-team" title="The team's leave">
              <ul className={panelRowsCls}>
                {others.map((l) => (
                  <Item key={l.id} l={l} showName />
                ))}
              </ul>
            </Panel>
          )}

          {waiting.length === 0 && !mine && others.length === 0 && manages && <EmptyState icon={<CalendarOff className="size-6" aria-hidden />} title="No leave yet" hint="Requests from the team show up here for you to decide." />}
        </SplitMain>
      </Split>
    </div>
  );
}
