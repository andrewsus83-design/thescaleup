"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Btn } from "@/components/brand/primitives";
import { stopPerson } from "@/lib/hub/sequence-actions";

export type PersonLine = { id: string; name: string; email: string; progress: string; when: string; canStop: boolean };

/** The newest people in one state of the sequence. Emails arrive already hidden when the reader may not see them. */
export function SequencePeople({ brandId, rows, empty, more }: { brandId: string; rows: PersonLine[]; empty: string; more: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  if (rows.length === 0) return <p className="rounded-field bg-paper-100 p-4 text-small text-ink-500">{empty}</p>;
  return (
    <div className="space-y-3">
      {error && (
        <Alert tone="bad" role="alert">
          {error}
        </Alert>
      )}
      <ul className="divide-y divide-hairline rounded-bubble border border-hairline bg-paper-0">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-small font-semibold text-ink-800">{r.name || r.email}</p>
              {r.name && <p className="truncate text-caption text-ink-500">{r.email}</p>}
              <p className="text-caption text-ink-500">
                {r.progress} · {r.when}
              </p>
            </div>
            {r.canStop &&
              (asking === r.id ? (
                <span className="flex items-center gap-2 text-small text-ink-800">
                  Stop emailing them?
                  <Btn
                    variant="danger"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await stopPerson(brandId, r.id);
                        setAsking(null);
                        if (res.ok) {
                          setError("");
                          router.refresh();
                        } else setError(res.error);
                      })
                    }
                  >
                    Yes, stop
                  </Btn>
                  <Btn variant="ghost" size="sm" onClick={() => setAsking(null)}>
                    Keep
                  </Btn>
                </span>
              ) : (
                <Btn variant="ghost" size="sm" onClick={() => setAsking(r.id)}>
                  Stop
                </Btn>
              ))}
          </li>
        ))}
      </ul>
      {more && <p className="text-caption text-ink-500">{more}</p>}
    </div>
  );
}
