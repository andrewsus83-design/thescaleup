import Link from "next/link";
import { Chip, type Tone } from "@/components/brand/primitives";
import { segItem, segWrap } from "@/components/brand/styles";
import { labelOf, stageDef, stagesOf, type FollowState, type Kind, type StageDef } from "@/lib/hub/crm/model";

export const crmBase = (slug: string) => `/hub/b/${slug}/crm`;
export const listPath = (slug: string, kind: Kind) => (kind === "lead" ? crmBase(slug) : `${crmBase(slug)}/clients`);

export type Section = "leads" | "clients" | "board" | "funnel" | "setup" | "automations";

const SECTIONS: { id: Section; label: string; path: string; manager?: boolean }[] = [
  { id: "leads", label: "Leads", path: "" },
  { id: "clients", label: "Clients", path: "/clients" },
  { id: "board", label: "Board", path: "/board" },
  { id: "funnel", label: "Funnel", path: "/funnel" },
  { id: "setup", label: "Setup", path: "/setup", manager: true },
  { id: "automations", label: "Automations", path: "/automations", manager: true },
];

/** The CRM's sections. Setup (stages and automations) is for managers. On a narrow phone the row scrolls sideways. */
export function CrmNav({ slug, active, manager }: { slug: string; active: Section; manager: boolean }) {
  return (
    <div className="-mx-6 mb-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
      <nav aria-label="CRM sections" className={segWrap}>
        {SECTIONS.filter((s) => manager || !s.manager).map((s) => (
          <Link key={s.id} href={`${crmBase(slug)}${s.path}`} aria-current={active === s.id ? "page" : undefined} className={`${segItem(active === s.id)} shrink-0`}>
            {s.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** The chip's colour follows the stage's place in the brand's own list: closed stages are quiet, the first is blue, the last open lead stage amber. */
export function stageTone(stages: readonly StageDef[], key: string): Tone {
  const d = stageDef(stages, key);
  if (!d || !d.open) return "neutral";
  if (d.kind === "client") return "ok";
  const open = stagesOf(stages, "lead").filter((s) => s.open);
  const i = open.findIndex((s) => s.key === key);
  return i === 0 ? "info" : i === open.length - 1 && open.length > 2 ? "warn" : "brand";
}

export function StageChip({ stages, stage }: { stages: readonly StageDef[]; stage: string }) {
  return <Chip tone={stageTone(stages, stage)}>{labelOf(stages, stage)}</Chip>;
}

const FOLLOW_TONE: Record<FollowState, Tone> = { late: "bad", today: "warn", soon: "neutral", later: "neutral" };

/** "12 Nov" for a calendar day. The day is read as written, so no time zone can move it. */
export function shortDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}`;
}

export function FollowChip({ state, date }: { state: FollowState | null; date: string | null }) {
  if (!state || !date) return null;
  const text = state === "late" ? `Follow up was ${shortDay(date)}` : state === "today" ? "Follow up today" : `Follow up ${shortDay(date)}`;
  return <Chip tone={FOLLOW_TONE[state]}>{text}</Chip>;
}

/** "17 Nov, 14:05" in the hub's time zone. */
export function stamp(iso: string, tz: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(d);
}
