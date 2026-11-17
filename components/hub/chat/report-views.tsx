import Link from "next/link";
import { Card, Chip, EmptyState, type Tone } from "@/components/brand/primitives";
import { fmtDay } from "@/lib/hub/tasks/dates";
import {
  fmtMinutes,
  ghostingReport,
  HEALTH_LABEL,
  healthReport,
  MEETING_LABEL,
  PLATFORM_LABEL,
  STATUS_LABEL,
  STATUSES,
  trackerReport,
  type AuditItem,
  type Health,
  type Status,
} from "@/lib/hub/chat/model";

export const STATUS_TONE: Record<Status, Tone> = { active: "info", confirmed: "ok", rescheduled: "info", ghosting: "bad", cancelled: "warn", resolved: "ok", stalled: "warn" };
const HEALTH_TONE: Record<Health, Tone> = { active: "ok", stuck_us: "bad", stuck_them: "warn", quiet: "neutral", closed: "neutral" };
const where = (i: Pick<AuditItem, "platform"> & { channel?: string }) => (i.channel ? i.channel : PLATFORM_LABEL[i.platform]);

function Figure({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-paper-0 p-4">
      <p className="font-title text-h3 text-ink-800">{value}</p>
      <p className="text-small text-ink-500">{label}</p>
    </div>
  );
}

const Empty = ({ title, hint }: { title: string; hint: string }) => <EmptyState title={title} hint={hint} />;

/** Open items and meetings across the conversations. */
export function TrackerView({ items, today, base }: { items: AuditItem[]; today: string; base: string }) {
  const t = trackerReport(items, today);
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure value={t.rows.length} label="Open items" />
        <Figure value={t.onUs} label="On us" />
        <Figure value={t.onThem} label="On them" />
        <Figure value={t.late} label="Late" />
      </div>
      <section aria-labelledby="tr-items" className="space-y-3">
        <h2 id="tr-items" className="font-title text-h3 text-ink-800">
          Follow-ups
        </h2>
        {t.rows.length === 0 ? (
          <Empty title="Nothing open" hint="No unfinished promises or requests were found in these conversations." />
        ) : (
          <ul className="space-y-2">
            {t.rows.map((r, i) => (
              <li key={`${r.itemId}-${i}`}>
                <Card small>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-800">{r.what}</p>
                      <p className="text-small text-ink-500">
                        {r.title}
                        {r.pic ? `, ${r.pic}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Chip tone={r.owner === "us" ? "brand" : "neutral"}>{r.owner === "us" ? "On us" : "On them"}</Chip>
                      {r.due && <Chip tone={r.late ? "bad" : "neutral"}>{r.late ? `Late, ${fmtDay(r.due)}` : fmtDay(r.due)}</Chip>}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="tr-meet" className="space-y-3">
        <h2 id="tr-meet" className="font-title text-h3 text-ink-800">
          Meetings
        </h2>
        {t.meetings.length === 0 ? (
          <Empty title="No meetings mentioned" hint="Meetings and calls found in the chats show here." />
        ) : (
          <>
            <p className="text-small text-ink-500">{Object.entries(t.byState).filter(([, n]) => n > 0).map(([s, n]) => `${n} ${MEETING_LABEL[s as keyof typeof MEETING_LABEL].toLowerCase()}`).join(", ")}</p>
            <ul className="space-y-2">
              {t.meetings.map((m, i) => (
                <li key={`${m.itemId}-${i}`}>
                  <Card small>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink-800">{m.what}</p>
                        <p className="text-small text-ink-500">
                          {m.title}
                          {m.when ? `, ${fmtDay(m.when)}` : ""}
                        </p>
                      </div>
                      <Chip tone={m.state === "confirmed" || m.state === "done" ? "ok" : m.state === "cancelled" ? "warn" : "info"}>{MEETING_LABEL[m.state]}</Chip>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <p className="text-small text-ink-500">
        Turn what is on us into tasks in <Link href={`${base}?view=suggestions`} className="font-semibold text-ink-700 underline">Suggestions</Link>.
      </p>
    </div>
  );
}

/** Which conversations are stuck, on whom, and which went quiet. */
export function HealthView({ items }: { items: AuditItem[] }) {
  const g = healthReport(items);
  const order: Health[] = ["stuck_us", "stuck_them", "quiet", "active", "closed"];
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {order.map((h) => (
          <Figure key={h} value={g[h].length} label={HEALTH_LABEL[h]} />
        ))}
      </div>
      {order.map((h) =>
        g[h].length ? (
          <section key={h} aria-labelledby={`h-${h}`} className="space-y-3">
            <h2 id={`h-${h}`} className="font-title text-h3 text-ink-800">
              {HEALTH_LABEL[h]}
            </h2>
            <ul className="space-y-2">
              {g[h].map((i) => (
                <li key={i.id}>
                  <Card small>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink-800">{i.title}</p>
                        <p className="text-small text-ink-600">{i.findings.next_step || i.findings.summary}</p>
                        <p className="mt-1 text-caption text-ink-500">
                          {where(i)}, last message {i.metrics.silentDays === 0 ? "today" : `${i.metrics.silentDays} ${i.metrics.silentDays === 1 ? "day" : "days"} ago`} from {i.metrics.lastSide === "ours" ? "us" : "them"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Chip tone={HEALTH_TONE[h]}>{HEALTH_LABEL[h]}</Chip>
                        {i.findings.risk !== "low" && <Chip tone={i.findings.risk === "high" ? "bad" : "warn"}>{i.findings.risk === "high" ? "High risk" : "Medium risk"}</Chip>}
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}

/** Where the conversations ended up, and how fast each side answers. */
export function GhostingView({ items }: { items: AuditItem[] }) {
  const r = ghostingReport(items);
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure value={r.total} label="Conversations" />
        <Figure value={`${r.resolvedRate}%`} label="Confirmed or resolved" />
        <Figure value={`${r.dropOffRate}%`} label="Ghosting or cancelled" />
        <Figure value={r.counts.ghosting} label="Ghosting now" />
      </div>
      <section aria-labelledby="gh-status" className="space-y-3">
        <h2 id="gh-status" className="font-title text-h3 text-ink-800">
          Where they ended up
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STATUSES.map((s) => (
            <li key={s} className="flex items-center justify-between gap-2 rounded-xl border border-ink-100 bg-paper-0 px-3 py-2">
              <Chip tone={STATUS_TONE[s]}>{STATUS_LABEL[s]}</Chip>
              <span className="font-mono text-small text-ink-800">{r.counts[s]}</span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="gh-speed" className="space-y-3">
        <h2 id="gh-speed" className="font-title text-h3 text-ink-800">
          How fast each side answers
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Figure value={r.ourMedian === null ? "No data" : fmtMinutes(r.ourMedian)} label="Us answering them (typical)" />
          <Figure value={r.theirMedian === null ? "No data" : fmtMinutes(r.theirMedian)} label="Them answering us (typical)" />
        </div>
        <p className="text-small text-ink-500">Measured from the first unanswered message. A wait over 14 days counts as a new conversation, not an answer.</p>
      </section>
      <section aria-labelledby="gh-list" className="space-y-3">
        <h2 id="gh-list" className="font-title text-h3 text-ink-800">
          Ghosting now
        </h2>
        {r.ghosting.length === 0 ? (
          <Empty title="Nobody is ghosting" hint="No conversation was marked as one side going silent." />
        ) : (
          <ul className="space-y-2">
            {r.ghosting.map((i) => (
              <li key={i.id}>
                <Card small>
                  <p className="font-semibold text-ink-800">{i.title}</p>
                  <p className="text-small text-ink-600">{i.findings.summary}</p>
                  <p className="mt-1 text-caption text-ink-500">Silent for {i.metrics.silentDays} {i.metrics.silentDays === 1 ? "day" : "days"}</p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** One conversation: what the AI found and the numbers behind it. */
export function Overview({ item, children }: { item: AuditItem & { channel?: string }; children?: React.ReactNode }) {
  const f = item.findings;
  const m = item.metrics;
  return (
    <Card>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-ink-800">{item.title}</h3>
            <p className="text-caption text-ink-500">
              {where(item)}, {m.messages.toLocaleString("en-US")} messages, {m.from} to {m.to}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip tone={STATUS_TONE[f.status]}>{STATUS_LABEL[f.status]}</Chip>
            {f.risk !== "low" && <Chip tone={f.risk === "high" ? "bad" : "warn"}>{f.risk === "high" ? "High risk" : "Medium risk"}</Chip>}
            {f.buying_intent !== "none" && <Chip tone="brand">{f.buying_intent === "strong" ? "Wants to buy" : "Possible buyer"}</Chip>}
          </div>
        </div>
        {f.summary && <p className="text-small text-ink-700">{f.summary}</p>}
        {f.next_step && (
          <p className="text-small text-ink-700">
            <span className="font-semibold">Next: </span>
            {f.next_step}
          </p>
        )}
        <p className="text-caption text-ink-500">
          Us {m.ours.toLocaleString("en-US")}, them {m.theirs.toLocaleString("en-US")}. Last message {m.silentDays === 0 ? "today" : `${m.silentDays} days ago`}.
          {m.response.ours ? ` We answer in about ${fmtMinutes(m.response.ours.median)}.` : ""}
          {m.response.theirs ? ` They answer in about ${fmtMinutes(m.response.theirs.median)}.` : ""}
        </p>
        {children}
      </div>
    </Card>
  );
}
