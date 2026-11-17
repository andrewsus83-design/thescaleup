"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { labelCls } from "@/components/brand/styles";
import { compactField } from "@/components/hub/tasks/parts";
import { importDocs, importTasks, scanClickUp } from "@/lib/hub/clickup-actions";
import type { Scan } from "@/lib/hub/clickup/model";
import { cn } from "@/lib/utils";

type Totals = { pages: number; tasks: number; skipped: number; empty: number; refused: { name: string; reason: string }[] };
const ZERO: Totals = { pages: 0, tasks: 0, skipped: 0, empty: 0, refused: [] };
const DOC_BATCH = 3;
const MAX_TASK_PAGES = 100; // 100 tasks a page: 10,000 tasks per list is the most one run will walk

/** Reads the brand's ClickUp, lets the founder pick what to bring over, then does it in small steps while this page stays open. */
export function ImportPanel({ brandId, slug, hasToken }: { brandId: string; slug: string; hasToken: boolean }) {
  const [scan, setScan] = useState<Scan | null>(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [done, setDone] = useState<Totals | null>(null);
  const [withDocs, setWithDocs] = useState(true);
  const [withClosed, setWithClosed] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const stop = useRef(false);

  async function read(workspaceId?: string) {
    setScanning(true);
    setError("");
    setDone(null);
    const r = await scanClickUp(brandId, workspaceId);
    setScanning(false);
    if (!r.ok) return setError(r.error);
    setScan(r);
    setPicked(new Set(r.lists.map((l) => l.id)));
  }

  async function run() {
    if (!scan) return;
    stop.current = false;
    setRunning(true);
    setError("");
    setDone(null);
    const t: Totals = { ...ZERO, refused: [] };
    const fail = (m: string) => {
      setError(`${m} What was imported so far is kept. Run it again to carry on: anything already imported is skipped.`);
      setDone(t);
    };
    if (withDocs) {
      for (let i = 0; i < scan.docs.length && !stop.current; i += DOC_BATCH) {
        setStatus(`Docs ${Math.min(i + DOC_BATCH, scan.docs.length)} of ${scan.docs.length}`);
        const r = await importDocs(brandId, scan.workspace.id, scan.docs.slice(i, i + DOC_BATCH));
        if (!r.ok) {
          setRunning(false);
          setStatus("");
          return fail(r.error);
        }
        t.pages += r.pages;
        t.skipped += r.skipped;
        t.empty += r.empty;
        t.refused.push(...r.refused);
      }
    }
    const lists = scan.lists.filter((l) => picked.has(l.id));
    for (let n = 0; n < lists.length && !stop.current; n++) {
      const l = lists[n];
      for (let page = 0; page < MAX_TASK_PAGES && !stop.current; page++) {
        setStatus(`Tasks: list ${n + 1} of ${lists.length}, “${l.name}”, page ${page + 1}`);
        const r = await importTasks(brandId, l.id, l.name, page, withClosed);
        if (!r.ok) {
          setRunning(false);
          setStatus("");
          return fail(r.error);
        }
        t.tasks += r.imported;
        t.skipped += r.skipped;
        if (r.last) break;
      }
    }
    setRunning(false);
    setStatus("");
    setDone(t);
    if (stop.current) setError("Stopped. What was imported so far is kept.");
  }

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const listed = scan ? scan.lists.filter((l) => picked.has(l.id)).reduce((s, l) => s + l.tasks, 0) : 0;
  const nothing = !scan || (!withDocs && picked.size === 0);

  return (
    <div className="space-y-6">
      {!hasToken && (
        <Alert tone="warn">
          Save the ClickUp token above first. In ClickUp: your avatar, Settings, Apps, API Token, then copy the one that starts with pk_.
        </Alert>
      )}
      {error && (
        <Alert tone="bad" role="alert">
          {error}
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Btn variant={scan ? "secondary" : "primary"} size="lg" onClick={() => read(scan?.workspace.id)} disabled={!hasToken || scanning || running}>
          {scanning && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {scan ? "Read ClickUp again" : "Read ClickUp"}
        </Btn>
        {scanning && (
          <p role="status" className="text-small text-ink-500">
            Reading the workspace. A big one can take half a minute.
          </p>
        )}
      </div>

      {scan && (
        <div className="space-y-6">
          {scan.workspaces.length > 1 && (
            <div>
              <label htmlFor="ck-ws" className={labelCls}>
                Workspace
              </label>
              <select id="ck-ws" value={scan.workspace.id} onChange={(e) => read(e.target.value)} disabled={scanning || running} className={cn(compactField, "h-11 w-full max-w-sm")}>
                {scan.workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <p className="text-body text-ink-700">
            <strong>{scan.workspace.name}</strong>: {scan.docs.length}
            {scan.docsMore ? "+" : ""} Docs and {scan.lists.length} lists.
            {scan.already.pages + scan.already.tasks > 0 && ` Already here from earlier runs: ${scan.already.pages} pages and ${scan.already.tasks} tasks (they are skipped).`}
          </p>

          <fieldset className="space-y-3">
            <legend className={labelCls}>What to bring over</legend>
            <label className="flex items-start gap-3 text-body text-ink-800">
              <input type="checkbox" className="mt-1 size-4" checked={withDocs} onChange={(e) => setWithDocs(e.target.checked)} disabled={running} />
              <span>
                Docs to the Wiki ({scan.docs.length}
                {scan.docsMore ? "+" : ""})
                <span className="block text-small text-ink-500">Each Doc becomes a page; a Doc with several pages gets its pages beneath it. Tagged with where it sat in ClickUp.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-body text-ink-800">
              <input type="checkbox" className="mt-1 size-4" checked={withClosed} onChange={(e) => setWithClosed(e.target.checked)} disabled={running} />
              <span>
                Include finished tasks
                <span className="block text-small text-ink-500">Off keeps the board to open work only.</span>
              </span>
            </label>
          </fieldset>

          <fieldset>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <legend className={labelCls}>
                Lists to Tasks ({picked.size} of {scan.lists.length}
                {listed > 0 ? `, about ${listed.toLocaleString("en-US")} tasks` : ""})
              </legend>
              <div className="flex gap-2">
                <Btn size="sm" onClick={() => setPicked(new Set(scan.lists.map((l) => l.id)))} disabled={running}>
                  All
                </Btn>
                <Btn size="sm" onClick={() => setPicked(new Set())} disabled={running}>
                  None
                </Btn>
              </div>
            </div>
            <ul className="max-h-80 divide-y divide-ink-100 overflow-y-auto rounded-xl border border-ink-100">
              {scan.lists.map((l) => (
                <li key={l.id}>
                  <label className="flex items-center gap-3 px-3 py-2 text-body text-ink-800">
                    <input type="checkbox" className="size-4" checked={picked.has(l.id)} onChange={() => toggle(l.id)} disabled={running} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{l.name}</span>
                      <span className="block truncate text-caption text-ink-500">{l.where}</span>
                    </span>
                    {l.tasks > 0 && <span className="text-small text-ink-500">{l.tasks.toLocaleString("en-US")}</span>}
                  </label>
                </li>
              ))}
              {scan.lists.length === 0 && <li className="px-3 py-4 text-small text-ink-500">This token sees no lists.</li>}
            </ul>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <Btn variant="primary" size="lg" onClick={run} disabled={running || nothing}>
              {running && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Import into this brand
            </Btn>
            {running && (
              <Btn
                onClick={() => {
                  stop.current = true;
                }}
              >
                Stop after this step
              </Btn>
            )}
          </div>
          {running && (
            <p role="status" className="text-small text-ink-600">
              {status || "Starting"}. Keep this page open.
            </p>
          )}
        </div>
      )}

      {done && (
        <Alert tone={done.refused.length ? "warn" : "ok"} role="status">
          <p>
            Brought over {done.pages} Wiki pages and {done.tasks} tasks. Skipped {done.skipped} that were already here
            {done.empty ? `, and ${done.empty} empty pages` : ""}.
          </p>
          {done.refused.length > 0 && (
            <div className="mt-2">
              <p>Not imported ({done.refused.length}):</p>
              <ul className="mt-1 list-disc pl-5">
                {done.refused.slice(0, 15).map((r, i) => (
                  <li key={i}>
                    {r.name}: {r.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-2">
            <Link href={`/hub/b/${slug}/wiki`} className="underline">
              Open the Wiki
            </Link>
            {" · "}
            <Link href={`/hub/b/${slug}/tasks`} className="underline">
              Open Tasks
            </Link>
          </p>
        </Alert>
      )}
    </div>
  );
}
