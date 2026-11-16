"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Alert, Btn, Card } from "@/components/brand/primitives";
import { labelCls } from "@/components/brand/styles";
import { compactField } from "@/components/hub/tasks/parts";
import { finishImport, importChunk } from "@/lib/hub/products-actions";
import { FIELDS, LIMITS, fmtNum, fmtPrice, guessMapping, mappingError, toRows, type Mapping } from "@/lib/hub/products/model";

type Store = { id: string; name: string };
type Loaded = { name: string; rows: string[][]; sheet: string | null; cut: boolean };
type Done = { rows: number; created: number; existing: number; skipped: number; store: string };

const letter = (i: number) => {
  let s = "";
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s;
  return s;
};

/** The first of the opening rows that looks like a header (has both a SKU-like and a stock-like column); otherwise the first row. */
function detectHeader(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const g = guessMapping(rows[i]);
    if (g.sku >= 0 && g.stock >= 0) return i;
  }
  return 0;
}

export function ImportWizard({ brandId, slug, stores, initialStore }: { brandId: string; slug: string; stores: Store[]; initialStore?: string }) {
  const [storeId, setStoreId] = useState(initialStore && stores.some((s) => s.id === initialStore) ? initialStore : stores.length === 1 ? stores[0].id : "");
  const [file, setFile] = useState<Loaded | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Mapping>({ sku: -1, name: -1, stock: -1, price: -1 });
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const headers = useMemo(() => (file ? (file.rows[headerRow] ?? []) : []), [file, headerRow]);
  const width = useMemo(() => (file ? Math.max(...file.rows.slice(0, 50).map((r) => r.length), 0) : 0), [file]);
  const parsed = useMemo(() => (file ? toRows(file.rows.slice(headerRow + 1), mapping) : null), [file, headerRow, mapping]);
  const mapErr = file ? mappingError(mapping) : null;
  const busy = reading || progress !== null;
  const storeName = stores.find((s) => s.id === storeId)?.name ?? "";

  async function pick(f: File | undefined) {
    if (!f) return;
    setError("");
    setDone(null);
    setFile(null);
    setReading(true);
    try {
      const fd = new FormData();
      fd.set("brandId", brandId);
      fd.set("file", f);
      const res = await fetch(`/hub/b/${slug}/products/import/read`, { method: "POST", body: fd });
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
    if (!parsed || !storeId || mapErr || parsed.rows.length === 0) return;
    setError("");
    setDone(null);
    const rows = parsed.rows;
    let created = 0;
    let existing = 0;
    setProgress({ done: 0, total: rows.length });
    for (let i = 0; i < rows.length; i += LIMITS.chunk) {
      const part = rows.slice(i, i + LIMITS.chunk);
      let r: Awaited<ReturnType<typeof importChunk>>;
      try {
        r = await importChunk({ brandId, storeId, rows: part });
      } catch {
        r = { ok: false, error: "The connection dropped." };
      }
      if (!r.ok) {
        setError(`${r.error} ${i > 0 ? `${fmtNum(i)} of ${fmtNum(rows.length)} rows were saved before this. ` : ""}Importing the same file again is safe: it sets the same numbers.`);
        setProgress(null);
        if (i > 0) await finishImport({ brandId, storeId, rows: i, created }).catch(() => null);
        return;
      }
      created += r.created;
      existing += r.existing;
      setProgress({ done: Math.min(rows.length, i + part.length), total: rows.length });
    }
    await finishImport({ brandId, storeId, rows: rows.length, created }).catch(() => null);
    setProgress(null);
    setDone({ rows: rows.length, created, existing, skipped: parsed.skipped, store: storeName });
    setFile(null);
  }

  const optionLabel = (i: number) => `${letter(i)}: ${headers[i] || "(no heading)"}`;

  return (
    <div className="space-y-6">
      {done && (
        <Alert tone="ok" role="status" title={`Imported ${fmtNum(done.rows)} products into ${done.store}.`}>
          {done.created > 0 ? `${fmtNum(done.created)} are new in the catalog` : "None are new"}; {fmtNum(done.existing)} were already there and now have this store&apos;s stock.
          {done.skipped > 0 ? ` ${fmtNum(done.skipped)} rows without a SKU or a stock number were left out.` : ""}{" "}
          <Link href={`/hub/b/${slug}/products`} className="font-semibold underline underline-offset-4">
            See the catalog
          </Link>
        </Alert>
      )}
      {error && (
        <Alert tone="bad" role="alert">
          {error}
        </Alert>
      )}

      <Card small>
        <h2 className="mb-1 text-body font-semibold text-ink-800">Step 1. Which store is this file from?</h2>
        <p className="mb-3 text-small text-ink-500">Each import sets this store&apos;s stock. Other stores are not touched.</p>
        <label htmlFor="imp-store" className="sr-only">
          Store
        </label>
        <select id="imp-store" value={storeId} onChange={(e) => setStoreId(e.target.value)} disabled={busy} className={`${compactField} h-14 w-full rounded-field sm:max-w-sm`}>
          <option value="">Choose a store</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Card>

      <Card small>
        <h2 className="mb-1 text-body font-semibold text-ink-800">Step 2. Upload the stock list</h2>
        <p className="mb-3 text-small text-ink-500">
          An Excel (.xlsx) or CSV file exported from Desty, your POS, Shopify or a marketplace. Any layout works; you match the columns next. Up to 4 MB and {fmtNum(LIMITS.rows)} rows.
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
        {file?.cut && <p className="mt-2 text-small text-ink-800">Only the first {fmtNum(LIMITS.rows)} rows are used. Split the file to import the rest.</p>}
      </Card>

      {file && parsed && (
        <Card small>
          <h2 className="mb-1 text-body font-semibold text-ink-800">Step 3. Match the columns</h2>
          <p className="mb-4 text-small text-ink-500">We guessed from the headings. Check them, and change any that are wrong.</p>
          <div className="mb-4 max-w-xs">
            <label htmlFor="imp-head" className={labelCls}>
              The headings are on row
            </label>
            <input id="imp-head" type="number" min={1} max={Math.min(file.rows.length, 30)} value={headerRow + 1} onChange={(e) => changeHeader(Number(e.target.value) || 1)} disabled={busy} className={`${compactField} h-14 w-28 rounded-field`} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label htmlFor={`imp-${f.key}`} className={labelCls}>
                  {f.label}
                  {f.required ? "" : " (optional)"}
                </label>
                <select id={`imp-${f.key}`} value={mapping[f.key]} onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })} disabled={busy} className={`${compactField} h-14 w-full rounded-field`}>
                  <option value={-1}>{f.required ? "Choose a column" : "None"}</option>
                  {Array.from({ length: width }, (_, i) => (
                    <option key={i} value={i}>
                      {optionLabel(i)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-caption text-ink-500">{f.hint}</p>
              </div>
            ))}
          </div>

          {mapErr ? (
            <Alert tone="warn" className="mt-4">
              {mapErr}
            </Alert>
          ) : (
            <>
              <div className="mt-5 overflow-x-auto rounded-field border border-hairline">
                <table className="w-full min-w-[28rem] text-left text-caption">
                  <thead className="bg-paper-100 text-ink-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">SKU</th>
                      <th className="px-3 py-2 font-semibold">Name</th>
                      <th className="px-3 py-2 text-right font-semibold">Stock</th>
                      <th className="px-3 py-2 text-right font-semibold">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {parsed.rows.slice(0, 5).map((r) => (
                      <tr key={r.sku}>
                        <td className="px-3 py-2 font-mono">{r.sku}</td>
                        <td className="max-w-[14rem] truncate px-3 py-2">{r.name || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmtNum(r.stock)}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmtPrice(r.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-small text-ink-500">
                {fmtNum(parsed.rows.length)} products ready.
                {parsed.merged > 0 ? ` ${fmtNum(parsed.merged)} repeated SKUs were added together.` : ""}
                {parsed.skipped > 0 ? ` ${fmtNum(parsed.skipped)} rows have no SKU or no stock number and are left out.` : ""}
              </p>
              {parsed.rows.length === 0 && <Alert tone="warn" className="mt-3">No usable rows. Check the heading row and the SKU and stock columns.</Alert>}
            </>
          )}
        </Card>
      )}

      {file && parsed && !mapErr && parsed.rows.length > 0 && (
        <Card small>
          <h2 className="mb-1 text-body font-semibold text-ink-800">Step 4. Import</h2>
          <p className="mb-4 text-small text-ink-500">
            {storeId ? `Sets the stock in ${storeName} for these ${fmtNum(parsed.rows.length)} products. Products in ${storeName} that are not in this file keep their old numbers.` : "Choose a store in step 1 first."}
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
          <Btn type="button" variant="primary" size="lg" onClick={run} disabled={busy || !storeId}>
            {progress && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Import {fmtNum(parsed.rows.length)} products
          </Btn>
        </Card>
      )}
    </div>
  );
}
