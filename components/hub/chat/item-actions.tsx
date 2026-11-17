"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { labelCls } from "@/components/brand/styles";
import { CopyText } from "@/components/hub/copy-text";
import { compactField } from "@/components/hub/tasks/parts";
import { linkPerson, makeContent, makeLead, makeTasks, syncCrm, type Done } from "@/lib/hub/chat-actions";
import type { Findings } from "@/lib/hub/chat/model";
import { cn } from "@/lib/utils";

export type PersonOption = { id: string; name: string; company: string; kind: "lead" | "client" };

/** What can be done from one conversation's findings. Each button works once; what is done shows as done. */
export function ItemActions({ brandId, itemId, findings, personId, people, suggested, done, can }: {
  brandId: string;
  itemId: string;
  findings: Findings;
  personId: string | null;
  people: PersonOption[];
  suggested: string | null;
  /** Keys without the item id: "task:open:0", "crm:sync", "lead:lead", "content:idea:0". */
  done: string[];
  can: { tasks: boolean; crm: boolean; content: boolean };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pick, setPick] = useState(personId ?? suggested ?? "");

  async function act(key: string, f: () => Promise<Done>) {
    setBusy(key);
    setMsg(null);
    const r = await f();
    setBusy("");
    setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
  }

  const mine = findings.open_items.flatMap((o, i) => (o.owner === "us" ? [i] : []));
  const todo = mine.filter((i) => !done.includes(`task:open:${i}`));
  const ideasLeft = findings.content_ideas.filter((_, i) => !done.includes(`content:idea:${i}`)).length;
  const synced = done.includes("crm:sync");
  const leaded = done.includes("lead:lead");
  const spin = (k: string) => busy === k && <Loader2 className="size-4 animate-spin" aria-hidden />;
  const tick = <Check className="size-4 text-success" aria-hidden />;

  return (
    <div className="space-y-4 border-t border-ink-100 pt-4">
      {msg && (
        <Alert tone={msg.ok ? "ok" : "bad"} role={msg.ok ? "status" : "alert"}>
          {msg.text}
        </Alert>
      )}

      {can.tasks && mine.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {todo.length > 0 ? (
            <Btn onClick={() => act("tasks", () => makeTasks(brandId, itemId, todo))} disabled={busy !== ""}>
              {spin("tasks")}
              Create {todo.length} {todo.length === 1 ? "task" : "tasks"} from what is on us
            </Btn>
          ) : (
            <span className="inline-flex items-center gap-2 text-small text-ink-500">
              {tick}Tasks created
            </span>
          )}
        </div>
      )}

      {can.crm && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 basis-56">
              <label htmlFor={`pp-${itemId}`} className={labelCls}>
                CRM lead or client
              </label>
              <select id={`pp-${itemId}`} value={pick} onChange={(e) => setPick(e.target.value)} className={cn(compactField, "w-full")} disabled={busy !== ""}>
                <option value="">Not linked</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.company ? `, ${p.company}` : ""} ({p.kind})
                  </option>
                ))}
              </select>
            </div>
            {pick !== (personId ?? "") && (
              <Btn onClick={() => act("link", () => linkPerson(brandId, itemId, pick || null))} disabled={busy !== ""}>
                {spin("link")}
                {pick ? "Link" : "Unlink"}
              </Btn>
            )}
          </div>
          {personId && pick === personId && (synced ? (
            <span className="inline-flex items-center gap-2 text-small text-ink-500">
              {tick}Note and follow-up added to the CRM
            </span>
          ) : (
            <Btn onClick={() => act("crm", () => syncCrm(brandId, itemId))} disabled={busy !== ""}>
              {spin("crm")}
              Add the summary as a note{findings.follow_up_date || findings.stalled_on === "them" || findings.status === "ghosting" ? " and set the follow-up" : ""}
            </Btn>
          ))}
          {!personId && findings.buying_intent !== "none" && (leaded ? (
            <span className="inline-flex items-center gap-2 text-small text-ink-500">
              {tick}Added as a lead
            </span>
          ) : (
            <Btn variant="primary" onClick={() => act("lead", () => makeLead(brandId, itemId))} disabled={busy !== ""}>
              {spin("lead")}
              {findings.buying_intent === "strong" ? "Strong buying signal: add as a CRM lead" : "Possible buyer: add as a CRM lead"}
            </Btn>
          ))}
        </div>
      )}

      {can.content && findings.content_ideas.length > 0 && (
        <div>
          {ideasLeft > 0 ? (
            <Btn onClick={() => act("content", () => makeContent(brandId, itemId))} disabled={busy !== ""}>
              {spin("content")}
              Add {ideasLeft} content {ideasLeft === 1 ? "idea" : "ideas"} to Content
            </Btn>
          ) : (
            <span className="inline-flex items-center gap-2 text-small text-ink-500">
              {tick}Ideas added to Content
            </span>
          )}
        </div>
      )}

      {findings.follow_up_message && (
        <div>
          <p className={labelCls}>Message to restart the conversation</p>
          <CopyText text={findings.follow_up_message} label="Copy the follow-up message" />
        </div>
      )}
    </div>
  );
}
