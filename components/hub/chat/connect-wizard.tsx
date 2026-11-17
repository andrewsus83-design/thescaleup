"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Alert, Bar, Btn, Chip } from "@/components/brand/primitives";
import { labelCls } from "@/components/brand/styles";
import { compactField } from "@/components/hub/tasks/parts";
import { createAudit } from "@/lib/hub/chat-actions";
import { CONNECT, type AccountRow, type Source } from "@/lib/hub/chat/connect";
import { addDays } from "@/lib/hub/tasks/dates";
import { cn } from "@/lib/utils";

type Check = { from: string; to: string; accounts: AccountRow[]; sources: Source[]; failed: { account: string; platform: string; why: string }[]; more: boolean; commentsNote: string };
type Reply = { ok?: boolean; error?: string; skipped?: boolean; cached?: boolean } & Partial<Check>;

const long = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const PRESETS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
];

/**
 * Connect: read the conversations straight from the brand's Zernio inbox. Step one only looks (no AI, no cost) and shows which dates
 * each account has data for. Nothing is read by the AI until the person confirms the dates and how many conversations.
 */
export function ConnectWizard({ brandId, slug, hasKey, hasZernio, today }: { brandId: string; slug: string; hasKey: boolean; hasZernio: boolean; today: string }) {
  const router = useRouter();
  const stop = useRef(false);
  const [name, setName] = useState(() => `Chat audit ${today}`);
  const [from, setFrom] = useState(() => addDays(today, -29));
  const [to, setTo] = useState(today);
  const [comments, setComments] = useState(true);
  const [check, setCheck] = useState<Check | null>(null);
  const [pick, setPick] = useState<number>(CONNECT.defaultPick);
  const [checking, setChecking] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ audited: 0, skipped: 0, failed: 0, tried: 0 });
  const [notes, setNotes] = useState<string[]>([]);

  const call = async (payload: Record<string, unknown>): Promise<{ status: number; body: Reply | null }> => {
    try {
      const res = await fetch(`/hub/b/${slug}/inbox/audit/connect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brandId, ...payload }) });
      return { status: res.status, body: (await res.json().catch(() => null)) as Reply | null };
    } catch {
      return { status: 0, body: null };
    }
  };

  async function runCheck() {
    setError("");
    setCheck(null);
    setChecking(true);
    const r = await call({ step: "check", from, to, comments });
    setChecking(false);
    if (!r.body?.ok) {
      setError(r.body?.error ?? "Could not reach the server. Try again.");
      return;
    }
    const b = r.body as Check;
    setCheck(b);
    setPick(Math.min(CONNECT.defaultPick, Math.max(1, b.sources.length)));
  }

  async function run() {
    if (!check) return;
    setError("");
    setNotes([]);
    stop.current = false;
    setRunning(true);
    const made = await createAudit(brandId, name);
    if (!made.ok) {
      setError(made.error);
      setRunning(false);
      return;
    }
    const tally = { audited: 0, skipped: 0, failed: 0, tried: 0 };
    const seen: string[] = [];
    let streak = 0;
    const attempts = Math.min(check.sources.length, pick * 3 + 10);
    for (let i = 0; i < attempts && tally.audited < pick && !stop.current; i++) {
      const source = check.sources[i];
      tally.tried++;
      const r = await call({ step: "read", auditId: made.id, from: check.from, to: check.to, source });
      if (r.body?.ok) {
        tally.audited++;
        streak = 0;
      } else if (r.body?.skipped) tally.skipped++;
      else {
        tally.failed++;
        streak++;
        const why = r.body?.error ?? "Could not reach the server.";
        if (!seen.includes(why) && seen.length < 5) seen.push(why);
        // The same kind of failure again and again means something is wrong with the setup, not with one conversation.
        if (streak >= 3) break;
      }
      setProgress({ ...tally });
      setNotes([...seen]);
    }
    setRunning(false);
    if (tally.audited > 0) router.push(`/hub/b/${slug}/inbox/audit/${made.id}`);
    else setError(streak >= 3 ? "Stopped after three failures in a row. See the notes below." : "Nothing could be audited in these dates. See the notes below.");
  }

  const total = check?.sources.length ?? 0;
  const options = [...new Set([10, 30, 60, CONNECT.maxPick].filter((v) => v < total).concat(total > 0 && total <= CONNECT.maxPick ? [total] : []))].sort((a, b) => a - b);
  const withData = check?.accounts.filter((a) => a.candidates > 0).length ?? 0;
  const dirty = check !== null && (check.from !== from || check.to !== to);

  return (
    <div className="space-y-8">
      {!hasKey && <Alert tone="warn">Add an Anthropic key in Settings → Integrations first. The audit uses Claude Sonnet 5.5 to read the conversations.</Alert>}
      {!hasZernio && (
        <Alert tone="warn">
          This brand has no Zernio key yet. Add it in{" "}
          <Link href={`/hub/b/${slug}/settings/social`} className="font-semibold underline">
            Settings, Social media connections
          </Link>
          , and make sure the Inbox add-on is on in your Zernio account.
        </Alert>
      )}
      {error && (
        <Alert tone="bad" role="alert">
          {error}
        </Alert>
      )}

      <section className="space-y-4" aria-labelledby="cw-dates">
        <h2 id="cw-dates" className="font-title text-h3 text-ink-800">
          1. Choose the dates
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="cw-name" className={labelCls}>
              Name of this audit
            </label>
            <input id="cw-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={cn(compactField, "w-full")} disabled={running} />
          </div>
          <div>
            <label htmlFor="cw-from" className={labelCls}>
              From
            </label>
            <input id="cw-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={cn(compactField, "w-full")} disabled={running} />
          </div>
          <div>
            <label htmlFor="cw-to" className={labelCls}>
              To
            </label>
            <input id="cw-to" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className={cn(compactField, "w-full")} disabled={running} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <Btn key={p.days} size="sm" onClick={() => { setFrom(addDays(today, -(p.days - 1))); setTo(today); }} disabled={running}>
              {p.label}
            </Btn>
          ))}
        </div>
        <label className="flex min-h-11 items-center gap-2 text-small text-ink-700">
          <input type="checkbox" className="size-5" checked={comments} onChange={(e) => setComments(e.target.checked)} disabled={running} />
          Also read comments on your posts
        </label>
        <div className="space-y-2">
          <Btn variant="primary" onClick={runCheck} disabled={checking || running || !hasZernio || !from || !to}>
            {checking ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
            {checking ? "Checking what is available…" : "Check what is available"}
          </Btn>
          <p className="text-small text-ink-500">This only looks. The AI is not used and nothing is read until you confirm below. Reading does not mark messages as read, and nothing is sent.</p>
        </div>
      </section>

      {check && (
        <section className="space-y-4" aria-labelledby="cw-found">
          <h2 id="cw-found" className="font-title text-h3 text-ink-800">
            2. What is available
          </h2>
          {dirty && <Alert tone="info">You changed the dates. Check again to see what is available for them.</Alert>}
          {check.failed.length > 0 && (
            <Alert tone="warn">
              <ul className="list-disc space-y-1 pl-5">
                {check.failed.map((f, i) => (
                  <li key={i}>
                    {f.account} ({f.platform || "account"}): {f.why}
                  </li>
                ))}
              </ul>
            </Alert>
          )}
          {check.commentsNote && <Alert tone="warn">Comments: {check.commentsNote}</Alert>}
          {check.accounts.length === 0 ? (
            <Alert tone="warn">Zernio holds no conversations{comments ? " or commented posts" : ""} for this brand. Connect an account in Zernio first, or use Upload.</Alert>
          ) : (
            <ul className="space-y-3">
              {check.accounts.map((a) => {
                const unit = a.kind === "dm" ? (a.total === 1 ? "conversation" : "conversations") : a.total === 1 ? "post with comments" : "posts with comments";
                return (
                  <li key={a.key} className="space-y-1 rounded-2xl border border-ink-100 bg-paper-0 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink-800">{a.account}</p>
                      <Chip>
                        {a.platform}, {a.kind === "dm" ? "messages" : "comments"}
                      </Chip>
                      <Chip tone={a.candidates > 0 ? "ok" : "warn"}>{a.candidates > 0 ? "Has data in these dates" : "Nothing in these dates"}</Chip>
                    </div>
                    <p className="text-small text-ink-700">
                      {a.total.toLocaleString("en-US")} {unit} in Zernio. Activity found from {a.oldest ? long(a.oldest) : "?"} to {a.newest ? long(a.newest) : "?"}.
                    </p>
                    <p className="text-small text-ink-500">
                      {a.inside.toLocaleString("en-US")} active between {long(check.from)} and {long(check.to)}
                      {a.candidates > a.inside ? `, and ${(a.candidates - a.inside).toLocaleString("en-US")} more active later whose messages inside your dates are kept` : ""}.
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <ul className="list-disc space-y-1 pl-5 text-small text-ink-500">
            <li>Dates are the last activity Zernio holds, not the first message ever sent. Each conversation is cut to your dates when it is read.</li>
            <li>Instagram and Facebook keep the latest 500 messages of each conversation. Zernio does not say how far back WhatsApp goes: use the dates above.</li>
            {check.more && <li>This brand has more conversations than were listed. The newest were checked first.</li>}
          </ul>

          {total === 0 ? (
            <Alert tone="info">
              Nothing to audit between {long(check.from)} and {long(check.to)}.{check.accounts.length > 0 ? " Choose other dates, or use Upload for older chats." : ""}
            </Alert>
          ) : (
            <div className="space-y-4 rounded-2xl border border-ink-100 bg-paper-50 p-4">
              <h3 className="font-semibold text-ink-800">3. Confirm</h3>
              <div className="max-w-xs">
                <label htmlFor="cw-pick" className={labelCls}>
                  The AI reads up to
                </label>
                <select id="cw-pick" value={pick} onChange={(e) => setPick(Number(e.target.value))} className={cn(compactField, "w-full")} disabled={running}>
                  {options.map((v) => (
                    <option key={v} value={v}>
                      {v === total ? `All ${v}` : `${v} conversations`}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-small text-ink-700">
                {withData} {withData === 1 ? "account has" : "accounts have"} data. The newest {Math.min(pick, total)} of {total} {total === 1 ? "item" : "items"} with activity between {long(check.from)} and {long(check.to)} will be read by Claude (Anthropic). Each takes about 10 to 30
                seconds. The hub keeps the numbers and what the AI found, not the chat text. Conversations with fewer than two messages in your dates are skipped and do not count.
              </p>
              {running && (
                <div className="space-y-2">
                  <Bar value={progress.audited} max={Math.max(1, Math.min(pick, total))} label="Conversations read" />
                  <p className="text-small text-ink-500" role="status">
                    {progress.audited} audited, {progress.skipped} skipped, {progress.failed} failed.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Btn variant="primary" size="lg" onClick={run} disabled={running || dirty || !hasKey || !name.trim()}>
                  {running && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  {running ? "Reading the conversations…" : `Yes, audit up to ${Math.min(pick, total)} from ${long(check.from)} to ${long(check.to)}`}
                </Btn>
                {running && (
                  <Btn onClick={() => (stop.current = true)}>
                    Stop after this one
                  </Btn>
                )}
              </div>
              {notes.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-small text-danger" role="alert">
                  {notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
