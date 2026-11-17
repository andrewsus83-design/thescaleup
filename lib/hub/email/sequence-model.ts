// Pure rules for email sequences: what a sequence is made of, when each person's next email is due, and when somebody has to leave
// instead of getting it. No I/O, so it is tested on its own; the same code runs in the browser (the summary line) and on the server.

import { addDays } from "../tasks/dates";
import { docProblems, parseDoc, type Doc } from "./model";

export const SEQ_LIMITS = { steps: 10, delay: 365, name: 120, stopStages: 12, enroll: 1000, batch: 50 } as const;

/** One email of a sequence. `delay_days` is the wait after the previous email; for the first email it is the wait after the person joins. */
export type Step = { delay_days: number; doc: Doc };

export const SEQ_STATUS = ["draft", "active", "paused"] as const;
export type SeqStatus = (typeof SEQ_STATUS)[number];

export const STOP_REASONS = ["completed", "unsubscribed", "bounced", "complained", "replied", "removed", "email_changed", "stage", "failed", "manual"] as const;
export type StopReason = (typeof STOP_REASONS)[number];
export const STOP_LABEL: Record<StopReason, string> = {
  completed: "Got every email",
  unsubscribed: "Unsubscribed",
  bounced: "Address bounced",
  complained: "Marked it as spam",
  replied: "Wrote back",
  removed: "Removed from the CRM",
  email_changed: "Email address changed",
  stage: "Reached a stop stage",
  failed: "An email could not be sent",
  manual: "Stopped by your team",
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Whole days, clamped. The first email may go out the day the person joins (0); the others wait at least a day, so two emails never arrive together. */
export function clampDelay(v: unknown, first: boolean): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  const whole = Number.isFinite(n) ? Math.trunc(n) : first ? 0 : 1;
  return Math.min(SEQ_LIMITS.delay, Math.max(first ? 0 : 1, whole));
}

/** Whatever came from the browser or the database, as a clean list of steps. Never throws. */
export function parseSteps(raw: unknown): Step[] {
  const out: Step[] = [];
  for (const s of Array.isArray(raw) ? raw : []) {
    if (!isObj(s) || out.length >= SEQ_LIMITS.steps) continue;
    out.push({ delay_days: clampDelay(s.delay_days, out.length === 0), doc: parseDoc(s.doc) });
  }
  return out;
}

export function parseStopStages(raw: unknown): string[] {
  const list = (Array.isArray(raw) ? raw : []).filter((s): s is string => typeof s === "string" && /^[a-z0-9_-]{1,40}$/i.test(s));
  return [...new Set(list)].slice(0, SEQ_LIMITS.stopStages);
}

export const cleanName = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, SEQ_LIMITS.name) : "");

/** The day, counted from joining, each email goes out: waits of 0, 2 and 5 days make day 0, day 2, day 7. */
export function dayOffsets(steps: readonly Step[]): number[] {
  let at = 0;
  return steps.map((s) => (at += s.delay_days));
}

/** "Day 0, day 2 and day 7", or "No emails yet". */
export function scheduleText(steps: readonly Step[]): string {
  const days = dayOffsets(steps).map((d) => `day ${d}`);
  if (days.length === 0) return "No emails yet";
  return days.length === 1 ? days[0][0].toUpperCase() + days[0].slice(1) : `${days.slice(0, -1).join(", ").replace(/^d/, "D")} and ${days[days.length - 1]}`;
}

/** What is wrong with a sequence, in words, before it can start. Saving a draft does not need these fixed. */
export function sequenceProblems(steps: readonly Step[]): string[] {
  if (steps.length === 0) return ["Add at least one email."];
  const out: string[] = [];
  steps.forEach((s, i) => {
    for (const p of docProblems(s.doc)) out.push(`Email ${i + 1}: ${p}`);
  });
  return out;
}

/** What happens to a person once email number `sentCount` has gone out today: the date of the next one, or finished. */
export function afterSend(today: string, steps: readonly Step[], sentCount: number): { status: "active"; next_on: string } | { status: "done"; next_on: null } {
  const next = steps[sentCount];
  return next ? { status: "active", next_on: addDays(today, next.delay_days) } : { status: "done", next_on: null };
}

// ---------------------------------------------------------------------------------------------- who must leave instead
export type Enrollee = { email: string; sent_count: number; enrolled_at: string };
export type PersonNow = { email: string; stage: string } | null;
export type Verdict = { act: "send" } | { act: "stop"; reason: StopReason };
export type SuppressionReason = "unsubscribed" | "bounced" | "complained" | "manual";

/**
 * Said just before an email goes out, so it uses what is true now and not what was true when the person joined.
 * Nobody gets an email after they unsubscribed, bounced, wrote back, left the CRM, changed address or reached a stage that ends the sequence.
 * `repliedAt` is the latest time each address wrote to the brand; only a message after the person joined counts.
 */
export function decide(
  e: Enrollee,
  ctx: { stepCount: number; suppressed: ReadonlyMap<string, SuppressionReason>; repliedAt: ReadonlyMap<string, string>; person: PersonNow; stopStages: readonly string[] },
): Verdict {
  if (e.sent_count >= ctx.stepCount) return { act: "stop", reason: "completed" };
  const why = ctx.suppressed.get(e.email);
  if (why) return { act: "stop", reason: why === "manual" ? "unsubscribed" : why };
  const reply = ctx.repliedAt.get(e.email);
  if (reply && Date.parse(reply) > Date.parse(e.enrolled_at)) return { act: "stop", reason: "replied" };
  if (!ctx.person) return { act: "stop", reason: "removed" };
  if (ctx.person.email.trim().toLowerCase() !== e.email) return { act: "stop", reason: "email_changed" };
  if (ctx.stopStages.includes(ctx.person.stage)) return { act: "stop", reason: "stage" };
  return { act: "send" };
}

// ---------------------------------------------------------------------------------------------- starting points
export type SeqStarter = { id: string; name: string; hint: string; steps: Step[] };
const FOOTER = "{{brand}}\nYour address here";
const step = (delay_days: number, subject: string, preheader: string, blocks: Doc["blocks"]): Step => ({ delay_days, doc: { subject, preheader, accent: "#0f766e", footer: FOOTER, blocks } });

/** Designs to start from. Everything in them is a sentence to replace, not a promise. */
export const SEQ_STARTERS: SeqStarter[] = [
  { id: "blank", name: "Blank", hint: "One empty email", steps: [step(0, "", "", [])] },
  {
    id: "welcome",
    name: "Welcome",
    hint: "Three emails over a week",
    steps: [
      step(0, "Welcome to {{brand}}", "Here is what to expect", [
        { type: "heading", text: "Hi {{first_name|there}}, welcome." },
        { type: "text", text: "Thank you for joining. In one or two sentences, say who you are and what they will get from you." },
        { type: "button", label: "Start here", url: "" },
      ]),
      step(2, "The one thing to know about {{brand}}", "Short and useful", [
        { type: "heading", text: "Our best tip" },
        { type: "text", text: "Share one useful idea or story, in three or four sentences, that shows how you help." },
      ]),
      step(5, "Can we help, {{first_name|friend}}?", "Reply to this email", [
        { type: "text", text: "Ask whether they have a question and make it easy to answer: just reply to this email." },
        { type: "button", label: "See how it works", url: "" },
      ]),
    ],
  },
  {
    id: "followup",
    name: "Follow up an enquiry",
    hint: "Three nudges that stop when they reply",
    steps: [
      step(0, "Thanks for getting in touch", "We have your message", [
        { type: "heading", text: "Hi {{first_name|there}}," },
        { type: "text", text: "Thank you for asking. Say what happens next and when they will hear from you." },
      ]),
      step(3, "Did you get a chance to look?", "A quick follow-up", [
        { type: "text", text: "A short, friendly reminder. Offer one clear next step." },
        { type: "button", label: "Book a time", url: "" },
      ]),
      step(7, "Should we close this for now?", "No pressure", [
        { type: "text", text: "Say you will not keep writing. Invite them to reply if the timing was wrong, and say when you would be glad to hear from them." },
      ]),
    ],
  },
];
