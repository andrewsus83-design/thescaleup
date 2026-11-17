"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Alert, Btn, Card } from "@/components/brand/primitives";
import { labelCls, pillCls } from "@/components/brand/styles";
import { listPath } from "@/components/hub/crm/parts";
import { compactField } from "@/components/hub/tasks/parts";
import { importPeopleChunk, startPeopleImport } from "@/lib/hub/crm-actions";
import { CHUNK, FIELDS, MAX_ROWS, detectHeader, guessMapping, mappingError, toPeople, type Mapping } from "@/lib/hub/crm/import";
import { labelOf, stagesOf, type Kind, type StageDef } from "@/lib/hub/crm/model";
import { fmtNum, fmtPrice } from "@/lib/hub/products/model";

type Loaded = { name: string; rows: string[][]; sheet: string | null; cut: boolean };
type Done = { kind: Kind; rows: number; created: number; skipped: number };

const letter = (i: number) => {
  let s = "";
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s;
  return s;
};
const plural = (n: number, one: string, many: string) => `${fmtNum(n)} ${n === 1 ? one : many}`;

export function ImportWizard({ brandId, slug, initialKind, stages }: { brandId: string; slug: string; initialKind: Kind; stages: StageDef[] }) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [defaultSource, setDefaultSource] = useState("CSV import");
  const [tagText, setTagText] = useState("");
  const [file, setFile] = useState<Loaded | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const headers = useMemo(() => (file ? (file.rows[headerRow] ?? []) : []), [file, headerRow]);
  const width = useMemo(() => (file ? Math.max(...file.rows.slice(0, 50).map((r) => r.length), 0) : 0), [file]);
  const mapErr = mapping ? mappingError(mapping) : null;
  const parsed = useMemo(
    () => (file && mapping && !mappingError(mapping) ? toPeople(file.rows.slice(headerRow + 1), mapping, { kind, stages, defaultSource }) : null),
    [file, mapping, headerRow, kind, stages, defaultSource],
  );
  const busy = reading || progress !== null;
  const noun = kind === "lead" ? "lead" : "client";
  const nouns = kind === "lead" ? "leads" : "clients";
  const start = stagesOf(stages, kind).find((s) => s.open) ?? stagesOf(stages, kind)[0];

  async function pick(f: File | undefined) {
    if (!f) return;
    setError("");
    setDone(null);
    setFile(null);
    setMapping(null);
    setReading(true);
    try {
      const fd = new FormData();
      fd.set("brandId", brandId);
      fd.set("file", f);
      const res = await fetch(`/hub/b/${slug}/crm/import/read`, { method: "POST", body: fd });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; rows?: string[][]; sheet?: string | null; cut?: boolean } | null;
      if (!res.ok || !body?.ok || !Array.isArray(body.rows)) {
        setError(body?.error ?? (res.status === 413 ? "That file is too big. Save it as CSV or split it." : "Could not read that file. Try again."));
        return;
      }
      const h = detectHeader(body.rows);
      setHeaderRow(h);
      setMapping(guessMapping(body.rows[h] ?? []));
      setFile({ name: f.name, rows: body.rows, sheet: body.sheet ?? null, cut: Boolean(body.cut) });
    } catch {
      setError("Could not upload that file. Check the connection and try again.");
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  }

  function changeHeader(n: number) {
    if (!file) return;
    const h = Math.min(Math.max(0, n - 1), Math.min(file.rows.length - 1, 29));
    setHeaderRow(h);
    setMapping(guessMapping(file.rows[h] ?? []));
  }

  async function run() {
    if (!parsed || parsed.rows.length === 0) return;
    setError("");
    setDone(null);
    const rows = parsed.rows;
    let created = 0;
    let skipped = 0;
    setProgress({ done: 0, total: rows.length });
    let started: Awaited<ReturnType<typeof startPeopleImport>>;
    try {
      started = await startPeopleImport({ brandId, kind, fileName: file?.name ?? "", tags: tagText });
    } catch {
      started = { ok: false, error: "The connection dropped." };
    }
    if (!started.ok) {
      setError(started.error);
      setProgress(null);
      return;
    }
    for (let i = 0; i < rows.length; i += CHUNK) {
      const part = rows.slice(i, i + CHUNK);
      let r: Awaited<ReturnType<typeof importPeopleChunk>>;
      try {
        r = await importPeopleChunk({ brandId, importId: started.importId, rows: part });
      } catch {
        r = { ok: false, error: "The connection dropped." };
      }
      if (!r.ok) {
        setError(`${r.error} ${i > 0 ? `${fmtNum(created)} ${created === 1 ? "person was" : "people were"} added before this. ` : ""}Importing the same file again is safe: people who were added are left alone. You can also undo this import from the list below.`);
        setProgress(null);
        return;
      }
      created += r.created;
      skipped += r.skipped;
      setProgress({ done: Math.min(rows.length, i + part.length), total: rows.length });
    }
    setProgress(null);
    setDone({ kind, rows: rows.length, created, skipped });
    setFile(null);
    setMapping(null);
  }

  const optionLabel = (i: number) => `${letter(i)}: ${headers[i] || "(no heading)"}`;
  const fixNotes: string[] = [];
  if (parsed) {
    const f = parsed.fixes;
    if (f.namedByFallback > 0) fixNotes.push(`${plural(f.namedByFallback, "row has", "rows have")} no name, so the company or email is used as the name.`);
    if (f.email > 0) fixNotes.push(`${plural(f.email, "email", "emails")} could not be read and ${f.email === 1 ? "is" : "are"} left empty.`);
    if (f.phone > 0) fixNotes.push(`${plural(f.phone, "phone number", "phone numbers")} could not be read and ${f.phone === 1 ? "is" : "are"} left empty.`);
    if (f.value > 0) fixNotes.push(`${plural(f.value, "value", "values")} could not be read as a number and ${f.value === 1 ? "is" : "are"} left empty.`);
    if (f.followUp > 0) fixNotes.push(`${plural(f.followUp, "follow-up date", "follow-up dates")} could not be read and ${f.followUp === 1 ? "is" : "are"} left empty.`);
    if (f.stage > 0 && start) fixNotes.push(`${plural(f.stage, "stage name does", "stage names do")} not match your stages, so those people start in “${start.label}”.`);
  }

  return (
    <div className="space-y-6">
      {done && (
        <Alert tone="ok" role="status" title={done.created > 0 ? `Added ${plural(done.created, done.kind === "lead" ? "lead" : "client", done.kind === "lead" ? "leads" : "clients")}.` : "Nobody new to add."}>
          {done.skipped > 0 ? `${plural(done.skipped, "person was", "people were")} already in your CRM and left alone. ` : ""}
          Stage automations did not run for imported people.{" "}
          <Link href={listPath(slug, done.kind)} className="font-semibold underline underline-offset-4">
            See the {done.kind === "lead" ? "leads" : "clients"}
          </Link>
        </Alert>
      )}
      {error && (
        <Alert tone="bad" role="alert">
          {error}
        </Alert>
      )}

      <Card small>
        <h2 className="mb-1 text-body font-semibold text-ink-800">Step 1. Who are they?</h2>
        <p className="mb-3 text-small text-ink-500">Everyone in the file is added as the same kind, in the first stage of that kind unless the file has a stage column.</p>
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Kind">
          {(["lead", "client"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} disabled={busy} onClick={() => setKind(k)} className={pillCls(kind === k)}>
              {k === "lead" ? "Leads" : "Clients"}
            </button>
          ))}
        </div>
        <label htmlFor="imp-source" className={labelCls}>
          Source for people whose row has none
        </label>
        <input id="imp-source" value={defaultSource} onChange={(e) => setDefaultSource(e.target.value)} maxLength={60} disabled={busy} className={`${compactField} h-14 w-full rounded-field sm:max-w-sm`} />
        <label htmlFor="imp-tags" className={`${labelCls} mt-4`}>
          Tags for everyone in this file (optional)
        </label>
        <input id="imp-tags" value={tagText} onChange={(e) => setTagText(e.target.value)} maxLength={200} placeholder="e.g. webinar nov, jakarta" disabled={busy} className={`${compactField} h-14 w-full rounded-field sm:max-w-sm`} />
        <p className="mt-1 text-caption text-ink-500">Separate tags with commas. Tags let you find this group later and email only them.</p>
      </Card>

      <Card small>
        <h2 className="mb-1 text-body font-semibold text-ink-800">Step 2. Upload the file</h2>
        <p className="mb-3 text-small text-ink-500">
          An Excel (.xlsx) or CSV file from Google Contacts, a form, a CRM or your own sheet. Any layout works; you match the columns next. Up to 4 MB and {fmtNum(MAX_ROWS)} rows.
        </p>
        <input ref={input} id="imp-file" type="file" accept=".xlsx,.csv,.tsv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => pick(e.target.files?.[0])} disabled={busy} className="sr-only" />
        <label htmlFor="imp-file" className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border-control border-ink-200 px-6 text-button font-semibold text-ink-800 hover:bg-paper-100 focus-within:shadow-focus ${busy ? "pointer-events-none opacity-50" : ""}`}>
          {reading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileSpreadsheet className="size-4" aria-hidden />}
          {reading ? "Reading the file…" : file ? "Choose another file" : "Choose a file"}
        </label>
        {file && (
          <p className="mt-3 text-small text-ink-500">
            {file.name}
            {file.sheet ? `, sheet “${file.sheet}”` : ""}: {fmtNum(file.rows.length)} rows read.
          </p>
        )}
        {file?.cut && <p className="mt-2 text-small text-ink-800">Only the first {fmtNum(MAX_ROWS)} rows are used. Split the file to import the rest.</p>}
      </Card>

      {file && mapping && (
        <Card small>
          <h2 className="mb-1 text-body font-semibold text-ink-800">Step 3. Match the columns</h2>
          <p className="mb-4 text-small text-ink-500">We guessed from the headings. Check them, and change any that are wrong. Leave a field on “None” if the file does not have it.</p>
          <div className="mb-4 max-w-xs">
            <label htmlFor="imp-head" className={labelCls}>
              The headings are on row
            </label>
            <input id="imp-head" type="number" min={1} max={Math.min(file.rows.length, 30)} value={headerRow + 1} onChange={(e) => changeHeader(Number(e.target.value) || 1)} disabled={busy} className={`${compactField} h-14 w-28 rounded-field`} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label htmlFor={`imp-${f.key}`} className={labelCls}>
                  {f.label}
                </label>
                <select id={`imp-${f.key}`} value={mapping[f.key]} onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })} disabled={busy} className={`${compactField} h-14 w-full rounded-field`}>
                  <option value={-1}>None</option>
                  {Array.from({ length: width }, (_, i) => (
                    <option key={i} value={i}>
                      {optionLabel(i)}
                    </option>
                  ))}
                </select>
                {f.hint && <p className="mt-1 text-caption text-ink-500">{f.hint}</p>}
              </div>
            ))}
          </div>

          {mapErr && (
            <Alert tone="warn" className="mt-4">
              {mapErr}
            </Alert>
          )}
          {parsed && (
            <>
              <div className="mt-5 overflow-x-auto rounded-field border border-hairline">
                <table className="w-full min-w-[34rem] text-left text-caption">
                  <thead className="bg-paper-100 text-ink-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Name</th>
                      <th className="px-3 py-2 font-semibold">Company</th>
                      <th className="px-3 py-2 font-semibold">Email</th>
                      <th className="px-3 py-2 font-semibold">Phone</th>
                      <th className="px-3 py-2 text-right font-semibold">Value</th>
                      <th className="px-3 py-2 font-semibold">Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {parsed.rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td className="max-w-[12rem] truncate px-3 py-2 font-semibold">{r.name}</td>
                        <td className="max-w-[10rem] truncate px-3 py-2">{r.company || "—"}</td>
                        <td className="max-w-[12rem] truncate px-3 py-2">{r.email || "—"}</td>
                        <td className="px-3 py-2 font-mono">{r.phone || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmtPrice(r.value)}</td>
                        <td className="px-3 py-2">{labelOf(stages, r.stage)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-small text-ink-500">
                {plural(parsed.rows.length, noun, nouns)} ready.
                {parsed.repeated > 0 ? ` ${plural(parsed.repeated, "person is", "people are")} listed twice in the file; the first one is used.` : ""}
                {parsed.skipped > 0 ? ` ${plural(parsed.skipped, "row has", "rows have")} no name, company or email and ${parsed.skipped === 1 ? "is" : "are"} left out.` : ""}
              </p>
              {fixNotes.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-small text-ink-500">
                  {fixNotes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
              {parsed.rows.length === 0 && <Alert tone="warn" className="mt-3">No usable rows. Check the heading row and the name column.</Alert>}
            </>
          )}
        </Card>
      )}

      {file && parsed && parsed.rows.length > 0 && (
        <Card small>
          <h2 className="mb-1 text-body font-semibold text-ink-800">Step 4. Import</h2>
          <p className="mb-4 text-small text-ink-500">
            Adds {plural(parsed.rows.length, noun, nouns)}. Anyone already in your CRM, found by email, phone number, or name and company, is skipped and nothing about them changes. Stage automations do not run for imported people.
          </p>
          {progress && (
            <div className="mb-4" role="status" aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-paper-200" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} aria-label="Import progress">
                <div className="h-full bg-brand-500 transition-[width] duration-150" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
              </div>
              <p className="mt-2 text-small text-ink-500">
                Saving {fmtNum(progress.done)} of {fmtNum(progress.total)}. Keep this page open.
              </p>
            </div>
          )}
          <Btn type="button" variant="primary" size="lg" onClick={run} disabled={busy}>
            {progress && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Add {plural(parsed.rows.length, noun, nouns)}
          </Btn>
        </Card>
      )}
    </div>
  );
}
