import Link from "next/link";
import { Chip, type Tone } from "@/components/brand/primitives";
import { segItem, segWrap } from "@/components/brand/styles";
import { STAGE_LABEL, type FollowState, type Kind, type Stage } from "@/lib/hub/crm/model";

export const crmBase = (slug: string) => `/hub/b/${slug}/crm`;
export const listPath = (slug: string, kind: Kind) => (kind === "lead" ? crmBase(slug) : `${crmBase(slug)}/clients`);

/** Leads and Clients: two lists of the same kind of record. */
export function CrmNav({ slug, active }: { slug: string; active: Kind }) {
  return (
    <nav aria-label="CRM sections" className={`${segWrap} mb-6`}>
      <Link href={listPath(slug, "lead")} aria-current={active === "lead" ? "page" : undefined} className={segItem(active === "lead")}>
        Leads
      </Link>
      <Link href={listPath(slug, "client")} aria-current={active === "client" ? "page" : undefined} className={segItem(active === "client")}>
        Clients
      </Link>
    </nav>
  );
}

const STAGE_TONE: Record<Stage, Tone> = { new: "info", contacted: "info", qualified: "brand", proposal: "warn", lost: "neutral", active: "ok", paused: "warn", churned: "neutral" };

export function StageChip({ stage }: { stage: Stage }) {
  return <Chip tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Chip>;
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
