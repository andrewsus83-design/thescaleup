import { Card, Chip } from "@/components/brand/primitives";
import type { MailDomain } from "@/lib/hub/mail/data";
import { CopyButton, DomainActions } from "./forms";

const STATUS: Record<string, { tone: "ok" | "warn" | "bad" | "neutral"; label: string }> = {
  verified: { tone: "ok", label: "Verified" },
  pending: { tone: "warn", label: "Waiting for DNS" },
  not_started: { tone: "warn", label: "Waiting for DNS" },
  failed: { tone: "bad", label: "DNS check failed" },
  temporary_failure: { tone: "warn", label: "Check again later" },
};

function Records({ records, title }: { records: MailDomain["records"]; title: string }) {
  if (!records.length) return null;
  return (
    <div>
      <h4 className="text-small font-semibold text-ink-800">{title}</h4>
      <ul className="mt-2 space-y-3">
        {records.map((r, i) => (
          <li key={`${r.record}-${r.type}-${r.name}-${i}`} className="rounded-field bg-paper-100 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="neutral">{r.record}</Chip>
              <span className="font-mono text-micro text-ink-500">{r.type}</span>
              {r.priority !== undefined && <span className="font-mono text-micro text-ink-500">priority {r.priority}</span>}
              {r.status === "verified" && <Chip tone="ok">Found</Chip>}
            </div>
            <dl className="mt-3 space-y-2 text-small">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <dt className="text-caption text-ink-500">Name</dt>
                  <dd className="break-all font-mono text-ink-800">{r.name}</dd>
                </div>
                <CopyButton value={r.name} label={`${r.record} name`} />
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <dt className="text-caption text-ink-500">Value</dt>
                  <dd className="break-all font-mono text-ink-800">{r.value}</dd>
                </div>
                <CopyButton value={r.value} label={`${r.record} value`} />
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One domain: its state, the DNS records still to add, and the buttons. A verified domain can still have a record to add (the receiving one). */
export function DomainCard({ brandId, domain: d }: { brandId: string; domain: MailDomain }) {
  const s = STATUS[d.status] ?? STATUS.pending;
  // A record with no status of its own follows the domain: nothing left to add once the domain is verified.
  const isDone = (r: MailDomain["records"][number]) => (r.status ? r.status === "verified" : d.status === "verified");
  const todo = d.records.filter((r) => !isDone(r));
  const done = d.records.filter(isDone);
  const receivingLive = d.receiving && todo.length === 0;
  return (
    <Card small className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="break-all font-mono text-body font-semibold text-ink-800">{d.name}</p>
        <div className="flex flex-wrap gap-2">
          <Chip tone={s.tone}>{s.label}</Chip>
          {d.receiving && <Chip tone={receivingLive ? "ok" : "warn"}>{receivingLive ? "Receives mail" : "Receiving: waiting for DNS"}</Chip>}
          {d.linked && <Chip tone="neutral">Already in Resend</Chip>}
        </div>
      </div>
      <Records records={todo} title="Add these at your domain provider" />
      {done.length > 0 && (
        <details>
          <summary className="hit-44 inline-flex min-h-11 cursor-pointer items-center text-small font-semibold text-ink-500 hover:text-ink-800">Show records already found</summary>
          <div className="mt-2">
            <Records records={done} title="Found at your domain provider" />
          </div>
        </details>
      )}
      <DomainActions brandId={brandId} domainId={d.id} verified={todo.length === 0} linked={d.linked} />
    </Card>
  );
}
