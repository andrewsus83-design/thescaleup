"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { compactField } from "@/components/hub/tasks/parts";
import { FollowChip, StageChip, crmBase } from "@/components/hub/crm/parts";
import { bulkPeople } from "@/lib/hub/crm-actions";
import type { BulkInput, BulkOp } from "@/lib/hub/crm/bulk";
import { stagesOf, type FollowState, type Kind, type StageDef } from "@/lib/hub/crm/model";
import { fmtNum } from "@/lib/hub/products/model";

export type PersonRow = { id: string; name: string; company: string; source: string; stage: string; value: number | null; follow: FollowState | null; followDate: string | null; tags: string[] };
export type ListFilter = { q: string; stage: string; due: boolean; tag: string };

const FOLLOW_CHOICES = [
  ["1", "Tomorrow"],
  ["3", "In 3 days"],
  ["7", "In a week"],
  ["14", "In 2 weeks"],
  ["30", "In a month"],
  ["clear", "Clear the follow-up"],
] as const;

const DONE: Record<BulkOp, (n: number) => string> = {
  stage: (n) => `Moved ${fmtNum(n)} ${n === 1 ? "person" : "people"}.`,
  follow: (n) => `Updated the follow-up for ${fmtNum(n)} ${n === 1 ? "person" : "people"}.`,
  tag_add: (n) => `Tagged ${fmtNum(n)} ${n === 1 ? "person" : "people"}.`,
  tag_remove: (n) => `Removed the tag from ${fmtNum(n)} ${n === 1 ? "person" : "people"}.`,
  delete: (n) => `Deleted ${fmtNum(n)} ${n === 1 ? "person" : "people"}.`,
};

/** The people on this page, each with a tick box. Ticking some (or choosing everyone who matches) opens a bar to move, tag, schedule or delete them together. */
export function PeopleTable({
  rows,
  brandId,
  slug,
  kind,
  stages,
  total,
  filter,
  canEdit,
  manager,
}: {
  rows: PersonRow[];
  brandId: string;
  slug: string;
  kind: Kind;
  stages: StageDef[];
  total: number;
  filter: ListFilter;
  canEdit: boolean;
  manager: boolean;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [everyone, setEveryone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [stage, setStage] = useState("");
  const [follow, setFollow] = useState("");
  const [tags, setTags] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const options = useMemo(() => stagesOf(stages, kind), [stages, kind]);
  const count = everyone ? total : picked.size;
  const pageAll = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const noun = kind === "lead" ? "lead" : "client";
  const nouns = kind === "lead" ? "leads" : "clients";

  function toggle(id: string) {
    setEveryone(false);
    setConfirmDelete(false);
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function togglePage() {
    setEveryone(false);
    setConfirmDelete(false);
    setPicked(pageAll ? new Set() : new Set(rows.map((r) => r.id)));
  }
  function clear() {
    setPicked(new Set());
    setEveryone(false);
    setConfirmDelete(false);
  }

  async function run(op: BulkOp, arg = "", tagText = "") {
    setBusy(true);
    setMsg(null);
    const input: BulkInput = { brandId, kind, op, arg, tags: tagText, ...(everyone ? { all: { ...filter } } : { ids: [...picked] }) };
    let r: Awaited<ReturnType<typeof bulkPeople>>;
    try {
      r = await bulkPeople(input);
    } catch {
      r = { ok: false, error: "The connection dropped. Check the list and try again." };
    }
    setBusy(false);
    if (!r.ok) {
      setMsg({ ok: false, text: r.error });
      return;
    }
    setMsg({ ok: true, text: r.changed === 0 && op === "stage" ? "Nothing changed: they were already in that stage." : DONE[op](r.changed) });
    clear();
    setStage("");
    setFollow("");
    setTags("");
    router.refresh();
  }

  return (
    <div>
      {msg && (
        <Alert tone={msg.ok ? "ok" : "bad"} role={msg.ok ? "status" : "alert"} className="mb-4">
          {msg.text}
        </Alert>
      )}

      {canEdit && count > 0 && (
        <div className="sticky top-2 z-10 mb-4 space-y-3 rounded-bubble border border-hairline bg-paper-0 p-4 shadow-raised" role="region" aria-label="Change the selected people">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-small font-semibold text-ink-800">
              {everyone ? `All ${fmtNum(total)} ${total === 1 ? noun : nouns} that match are selected.` : `${fmtNum(picked.size)} selected.`}
              {!everyone && pageAll && total > rows.length && (
                <button type="button" onClick={() => setEveryone(true)} className="ml-2 font-semibold underline underline-offset-4">
                  Select all {fmtNum(total)} that match
                </button>
              )}
            </p>
            <button type="button" onClick={clear} disabled={busy} className="hit-44 inline-flex min-h-11 items-center text-small font-semibold text-ink-500 hover:text-ink-800">
              Clear selection
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex gap-2">
              <label htmlFor="bulk-stage" className="sr-only">
                Move to stage
              </label>
              <select id="bulk-stage" value={stage} onChange={(e) => setStage(e.target.value)} disabled={busy} className={`${compactField} h-12 min-w-0 flex-1 rounded-field`}>
                <option value="">Move to stage…</option>
                {options.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <Btn variant="secondary" size="sm" disabled={busy || !stage} onClick={() => run("stage", stage)}>
                Move
              </Btn>
            </div>
            <div className="flex gap-2">
              <label htmlFor="bulk-follow" className="sr-only">
                Follow up
              </label>
              <select id="bulk-follow" value={follow} onChange={(e) => setFollow(e.target.value)} disabled={busy} className={`${compactField} h-12 min-w-0 flex-1 rounded-field`}>
                <option value="">Follow up…</option>
                {FOLLOW_CHOICES.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
              <Btn variant="secondary" size="sm" disabled={busy || !follow} onClick={() => run("follow", follow)}>
                Set
              </Btn>
            </div>
            <div className="flex gap-2">
              <label htmlFor="bulk-tags" className="sr-only">
                Tags
              </label>
              <input id="bulk-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, e.g. webinar, jakarta" maxLength={200} disabled={busy} className={`${compactField} h-12 min-w-0 flex-1 rounded-field`} />
              <Btn variant="secondary" size="sm" disabled={busy || !tags.trim()} onClick={() => run("tag_add", "", tags)}>
                Add
              </Btn>
              <Btn variant="secondary" size="sm" disabled={busy || !tags.trim()} onClick={() => run("tag_remove", "", tags)}>
                Remove
              </Btn>
            </div>
          </div>

          {manager && (
            <div>
              {!confirmDelete ? (
                <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} className="hit-44 inline-flex min-h-11 items-center text-small font-semibold text-ink-500 hover:text-ink-800">
                  Delete {fmtNum(count)} {count === 1 ? noun : nouns}…
                </button>
              ) : (
                <div className="space-y-3 rounded-field bg-paper-100 p-4">
                  <p className="text-small text-ink-800">
                    Deletes {fmtNum(count)} {count === 1 ? "person" : "people"} and their notes. This cannot be undone. To keep them but stop following up, move them to a closed stage instead.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Btn variant="danger" size="sm" disabled={busy} onClick={() => run("delete")}>
                      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                      Delete {fmtNum(count)} {count === 1 ? "person" : "people"}
                    </Btn>
                    <Btn variant="secondary" size="sm" disabled={busy} onClick={() => setConfirmDelete(false)}>
                      Keep them
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          )}
          {busy && (
            <p className="flex items-center gap-2 text-small text-ink-500" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Working on it. Keep this page open.
            </p>
          )}
        </div>
      )}

      {canEdit && rows.length > 0 && (
        <label className="mb-2 flex w-fit cursor-pointer items-center gap-3 text-small text-ink-500">
          <input type="checkbox" checked={pageAll} onChange={togglePage} disabled={busy} className="size-5 accent-ink-800" />
          Select the {rows.length} on this page
        </label>
      )}

      <ul className="divide-y divide-hairline rounded-bubble border border-hairline bg-paper-0">
        {rows.map((p) => (
          <li key={p.id} className="flex items-start">
            {canEdit && (
              <label className="hit-44 flex shrink-0 cursor-pointer items-center justify-center self-stretch pl-5">
                <span className="sr-only">Select {p.name}</span>
                <input type="checkbox" checked={picked.has(p.id) || everyone} onChange={() => toggle(p.id)} disabled={busy || everyone} className="size-5 accent-ink-800" />
              </label>
            )}
            <Link href={`${crmBase(slug)}/${p.id}`} className="flex min-w-0 flex-1 items-start gap-4 px-5 py-4 hover:bg-paper-100 focus-visible:shadow-focus focus-visible:outline-none">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold text-ink-800">{p.name}</span>
                {(p.company || p.source) && <span className="mt-0.5 block truncate text-small text-ink-500">{[p.company, p.source].filter(Boolean).join(" · ")}</span>}
                <span className="mt-2 flex flex-wrap gap-1.5">
                  <StageChip stages={stages} stage={p.stage} />
                  <FollowChip state={p.follow} date={p.followDate} />
                  {p.tags.slice(0, 4).map((t) => (
                    <span key={t} className="inline-flex items-center rounded-full bg-paper-200 px-2.5 py-0.5 text-caption text-ink-500">
                      {t}
                    </span>
                  ))}
                  {p.tags.length > 4 && <span className="inline-flex items-center px-1 text-caption text-ink-500">+{p.tags.length - 4}</span>}
                </span>
              </span>
              {p.value !== null && p.value > 0 && <span className="shrink-0 font-mono text-body font-medium text-ink-800">{fmtNum(p.value)}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
