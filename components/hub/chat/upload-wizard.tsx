"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Upload } from "lucide-react";
import { Alert, Bar, Btn, Chip } from "@/components/brand/primitives";
import { labelCls } from "@/components/brand/styles";
import { compactField } from "@/components/hub/tasks/parts";
import { createAudit } from "@/lib/hub/chat-actions";
import { dayOf, isKind, KIND_LABEL, KINDS, LIMITS, lastDays, PLATFORM_LABEL, type Convo, type Kind } from "@/lib/hub/chat/model";
import { readInputs } from "@/lib/hub/chat/read";
import { cn } from "@/lib/utils";

type Row = { id: number; convo: Convo; title: string; kind: Kind; days: number; ours: string[]; include: boolean; state: "idle" | "running" | "done" | "failed"; note: string };
const PERIODS: { days: number; label: string }[] = [
  { days: 0, label: "Everything" },
  { days: 30, label: "Last 30 days" },
  { days: 60, label: "Last 60 days" },
  { days: 90, label: "Last 90 days" },
  { days: 180, label: "Last 6 months" },
];

const storeKey = (brandId: string) => `chat-audit-ours:${brandId}`;
function remembered(brandId: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(brandId)) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return []; // storage can be blocked; the person just ticks their names again
  }
}
function remember(brandId: string, names: string[]) {
  try {
    localStorage.setItem(storeKey(brandId), JSON.stringify([...new Set([...remembered(brandId), ...names])].slice(0, 100)));
  } catch {
    /* nothing to do */
  }
}

/** Chat files in, a finished audit out. Everything is read in the browser first; only the conversations you keep are sent, one by one. */
export function UploadWizard({ brandId, slug, hasKey }: { brandId: string; slug: string; hasKey: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(() => `Chat audit ${new Date().toISOString().slice(0, 10)}`);
  const [rows, setRows] = useState<Row[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const patch = (id: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    setReading(true);
    const { convos, skipped: sk } = await readInputs([...files]);
    const mine = remembered(brandId);
    setRows(convos.map((c, i) => ({ id: i, convo: c, title: c.name, kind: "client", days: 0, ours: c.people.filter((p) => mine.includes(p)), include: true, state: "idle", note: "" })));
    setSkipped(sk);
    setReading(false);
    if (!convos.length) setError("No conversations found in those files.");
  }

  const view = (r: Row): Convo => (r.days ? lastDays(r.convo, r.days) : r.convo);
  const ready = (r: Row) => r.include && (r.kind === "internal" || r.ours.length > 0);
  const chosen = rows.filter((r) => r.include);
  const missing = chosen.filter((r) => !ready(r)).length;

  async function run() {
    setError("");
    setRunning(true);
    const made = await createAudit(brandId, name);
    if (!made.ok) {
      setError(made.error);
      setRunning(false);
      return;
    }
    let ok = 0;
    for (const r of rows.filter(ready)) {
      patch(r.id, { state: "running", note: "" });
      const c = view(r);
      const body = JSON.stringify({ brandId, auditId: made.id, title: r.title, platform: c.platform, channel: c.channel ?? "", kind: r.kind, ours: r.ours, people: c.people, m: c.msgs.map((m) => [m.t, m.p, m.x]) });
      if (body.length > LIMITS.body) {
        patch(r.id, { state: "failed", note: "Too big. Choose a shorter period." });
        continue;
      }
      try {
        const res = await fetch(`/hub/b/${slug}/inbox/audit/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
        const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; cached?: boolean } | null;
        if (j?.ok) {
          ok++;
          patch(r.id, { state: "done", note: j.cached ? "Same chat as before: reused, no AI cost." : "" });
        } else patch(r.id, { state: "failed", note: j?.error ?? "Something went wrong. Try again." });
      } catch {
        patch(r.id, { state: "failed", note: "Could not reach the server. Try again." });
      }
    }
    remember(brandId, rows.filter(ready).flatMap((r) => r.ours));
    setRunning(false);
    if (ok > 0) router.push(`/hub/b/${slug}/inbox/audit/${made.id}`);
    else setError("None of the conversations could be audited. See the notes below.");
  }

  const done = rows.filter((r) => r.state === "done" || r.state === "failed").length;
  return (
    <div className="space-y-8">
      {!hasKey && <Alert tone="warn">Add an Anthropic key in Settings → Integrations first. The audit uses Claude Sonnet 5.5 to read the conversations.</Alert>}
      {error && (
        <Alert tone="bad" role="alert">
          {error}
        </Alert>
      )}

      <section className="space-y-4">
        <div>
          <label htmlFor="ca-name" className={labelCls}>
            Name of this audit
          </label>
          <input id="ca-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={cn(compactField, "w-full")} disabled={running} />
        </div>
        <div>
          <p className={labelCls}>Chat files</p>
          <input ref={input} type="file" multiple accept=".txt,.json,.csv,.zip" className="sr-only" id="ca-files" onChange={(e) => pick(e.target.files)} disabled={running} />
          <Btn onClick={() => input.current?.click()} disabled={running || reading}>
            {reading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            Choose files
          </Btn>
          <ul className="mt-3 space-y-1 text-small text-ink-500">
            <li>WhatsApp: open the chat, More, Export chat, Without media. Choose the .txt (or the .zip from iPhone).</li>
            <li>Telegram: Telegram Desktop, chat menu, Export chat history, format JSON. Choose result.json.</li>
            <li>Instagram or Facebook: Meta&apos;s Download your information, format JSON. Choose the .zip or the message_1.json files. Comments: a .csv with date, author and text columns.</li>
          </ul>
        </div>
        <p className="text-small text-ink-500">Files are read here in your browser. Only the conversations you keep below are sent to Claude (Anthropic) to be read. The hub keeps the numbers and what the AI found, not the chat text.</p>
      </section>

      {skipped.length > 0 && (
        <Alert tone="warn">
          <ul className="list-disc space-y-1 pl-5">
            {skipped.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Alert>
      )}

      {rows.length > 0 && (
        <section aria-labelledby="ca-review" className="space-y-4">
          <h2 id="ca-review" className="font-title text-h3 text-ink-800">
            {rows.length} {rows.length === 1 ? "conversation" : "conversations"} found
          </h2>
          <ul className="space-y-4">
            {rows.map((r) => {
              const c = view(r);
              const span = c.msgs.length ? `${dayOf(Math.min(...c.msgs.map((m) => m.t)))} to ${dayOf(Math.max(...c.msgs.map((m) => m.t)))}` : "";
              return (
                <li key={r.id} className={cn("space-y-4 rounded-2xl border border-ink-100 bg-paper-0 p-4", !r.include && "opacity-60")}>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex min-h-11 items-center gap-2 text-small font-semibold text-ink-800">
                      <input type="checkbox" checked={r.include} onChange={(e) => patch(r.id, { include: e.target.checked })} disabled={running} className="size-5" />
                      Audit this
                    </label>
                    <Chip>{PLATFORM_LABEL[c.platform]}{c.channel ? `, ${c.channel}` : ""}</Chip>
                    <span className="text-small text-ink-500">
                      {c.msgs.length.toLocaleString("en-US")} messages, {c.people.length} {c.people.length === 1 ? "person" : "people"}
                      {span ? `, ${span}` : ""}
                    </span>
                    {r.state === "running" && <Loader2 className="size-4 animate-spin text-ink-500" aria-label="Reading" />}
                    {r.state === "done" && <Check className="size-4 text-success" aria-label="Done" />}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-1">
                      <label htmlFor={`ca-t-${r.id}`} className={labelCls}>
                        Name
                      </label>
                      <input id={`ca-t-${r.id}`} value={r.title} onChange={(e) => patch(r.id, { title: e.target.value })} maxLength={LIMITS.name} className={cn(compactField, "w-full")} disabled={running} />
                    </div>
                    <div>
                      <label htmlFor={`ca-k-${r.id}`} className={labelCls}>
                        Who is it with?
                      </label>
                      <select id={`ca-k-${r.id}`} value={r.kind} onChange={(e) => isKind(e.target.value) && patch(r.id, { kind: e.target.value })} className={cn(compactField, "w-full")} disabled={running}>
                        {KINDS.map((k) => (
                          <option key={k} value={k}>
                            {KIND_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`ca-p-${r.id}`} className={labelCls}>
                        Period
                      </label>
                      <select id={`ca-p-${r.id}`} value={r.days} onChange={(e) => patch(r.id, { days: Number(e.target.value) })} className={cn(compactField, "w-full")} disabled={running}>
                        {PERIODS.map((p) => (
                          <option key={p.days} value={p.days}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {r.kind !== "internal" && (
                    <fieldset>
                      <legend className={labelCls}>{r.kind === "system" ? "Which of these is the system (bot)?" : "Who is on your side (your team)?"}</legend>
                      <div className="flex flex-wrap gap-x-5 gap-y-1">
                        {c.people.map((p) => (
                          <label key={p} className="flex min-h-11 items-center gap-2 text-small text-ink-700">
                            <input
                              type="checkbox"
                              className="size-5"
                              checked={r.ours.includes(p)}
                              disabled={running}
                              onChange={(e) => patch(r.id, { ours: e.target.checked ? [...r.ours, p] : r.ours.filter((x) => x !== p) })}
                            />
                            {p}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                  {r.note && (
                    <p className={cn("text-small", r.state === "failed" ? "text-danger" : "text-ink-500")} role={r.state === "failed" ? "alert" : "status"}>
                      {r.note}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="space-y-3">
            {missing > 0 && <p className="text-small text-ink-500">{missing} {missing === 1 ? "conversation needs" : "conversations need"} someone ticked on your side before it can run.</p>}
            {running && <Bar value={done} max={Math.max(1, rows.filter(ready).length)} label="Conversations read" />}
            <Btn variant="primary" size="lg" onClick={run} disabled={running || !hasKey || chosen.length === 0 || missing > 0 || !name.trim()}>
              {running && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {running ? "Reading the conversations…" : `Run the audit on ${chosen.length}`}
            </Btn>
            <p className="text-caption text-ink-500">Each conversation takes about 10 to 30 seconds. Keep this page open.</p>
          </div>
        </section>
      )}
    </div>
  );
}
