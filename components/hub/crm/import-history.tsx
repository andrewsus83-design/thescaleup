"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Btn, Card } from "@/components/brand/primitives";
import { undoPeopleImport } from "@/lib/hub/crm-actions";
import type { ImportRecord } from "@/lib/hub/crm/data";
import type { FormState } from "@/lib/hub/actions";
import { fmtNum } from "@/lib/hub/products/model";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const people = (n: number) => `${fmtNum(n)} ${n === 1 ? "person" : "people"}`;

function Undo({ brandId, rec }: { brandId: string; rec: ImportRecord }) {
  const [state, action, pending] = useActionState<FormState, FormData>(undoPeopleImport, {});
  return (
    <details className="mt-2">
      <summary className="hit-44 inline-flex min-h-11 cursor-pointer items-center text-small font-semibold text-ink-500 hover:text-ink-800">Undo this import</summary>
      <form action={action} className="mt-2 space-y-3 rounded-field bg-paper-100 p-4">
        <input type="hidden" name="brandId" value={brandId} />
        <input type="hidden" name="importId" value={rec.id} />
        <p className="text-small text-ink-800">
          Removes the {people(rec.created_count)} this file added, with their notes. Anyone who has been worked on since (moved, edited, or given a note) is kept. This cannot be undone.
        </p>
        {state.error && (
          <Alert tone="bad" role="alert">
            {state.error}
          </Alert>
        )}
        <Btn type="submit" variant="danger" size="sm" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Remove what this file added
        </Btn>
      </form>
      {state.message && (
        <Alert tone="ok" role="status" className="mt-2">
          {state.message}
        </Alert>
      )}
    </details>
  );
}

/** The files imported so far. A manager can take one back while it is still recent in everyone's mind: people nobody has touched are removed, the rest stay. */
export function ImportHistory({ brandId, records, manager }: { brandId: string; records: ImportRecord[]; manager: boolean }) {
  if (records.length === 0) return null;
  return (
    <Card small>
      <h2 className="mb-1 text-body font-semibold text-ink-800">Earlier imports</h2>
      <p className="mb-3 text-small text-ink-500">Added the wrong file? {manager ? "Undo it here." : "A manager can undo it."}</p>
      <ul className="divide-y divide-hairline">
        {records.map((r) => (
          <li key={r.id} className="py-3">
            <p className="text-body font-semibold text-ink-800 [overflow-wrap:anywhere]">{r.file_name || "Untitled file"}</p>
            <p className="text-small text-ink-500">
              {day(r.created_at)} · {r.kind === "lead" ? "Leads" : "Clients"} · added {people(r.created_count)}
              {r.skipped_count > 0 ? `, ${people(r.skipped_count)} already there` : ""}
              {r.tags.length > 0 ? ` · tagged ${r.tags.join(", ")}` : ""}
              {r.undone_at ? ` · undone ${day(r.undone_at)}` : ""}
            </p>
            {manager && !r.undone_at && r.created_count > 0 && <Undo brandId={brandId} rec={r} />}
          </li>
        ))}
      </ul>
    </Card>
  );
}
