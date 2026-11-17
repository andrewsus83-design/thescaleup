"use client";

import { pillCls } from "@/components/brand/styles";
import { AUDIENCE_KINDS, type Audience } from "@/lib/hub/email/model";

const KIND_LABEL = { lead: "Leads", client: "Clients" } as const;

/** Who an email or sequence is for: leads and/or clients, optionally only some stages, optionally only people with a tag. */
export function AudiencePicker({ audience, onChange, stageList, tags, labels = {} }: { audience: Audience; onChange: (a: Audience) => void; stageList: string[]; tags: { tag: string; n: number }[]; labels?: Record<string, string> }) {
  const allTags = [...tags, ...audience.tags.filter((t) => !tags.some((x) => x.tag === t)).map((t) => ({ tag: t, n: 0 }))];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="People">
        {AUDIENCE_KINDS.map((k) => {
          const on = audience.kinds.includes(k);
          return (
            <button key={k} type="button" aria-pressed={on} onClick={() => onChange({ ...audience, kinds: on ? audience.kinds.filter((x) => x !== k) : [...audience.kinds, k], stages: [] })} className={pillCls(on)}>
              {KIND_LABEL[k]}
            </button>
          );
        })}
      </div>
      {stageList.length > 0 && (
        <div>
          <p className="mb-2 text-caption text-ink-500">Only these stages. Pick none to include all.</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Stages">
            {stageList.map((s) => {
              const on = audience.stages.includes(s);
              return (
                <button key={s} type="button" aria-pressed={on} onClick={() => onChange({ ...audience, stages: on ? audience.stages.filter((x) => x !== s) : [...audience.stages, s] })} className={pillCls(on)}>
                  {labels[s] ?? s}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {allTags.length > 0 && (
        <div>
          <p className="mb-2 text-caption text-ink-500">Only people with at least one of these tags. Pick none to include everyone above.</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Tags">
            {allTags.map((t) => {
              const on = audience.tags.includes(t.tag);
              return (
                <button key={t.tag} type="button" aria-pressed={on} onClick={() => onChange({ ...audience, tags: on ? audience.tags.filter((x) => x !== t.tag) : [...audience.tags, t.tag].slice(0, 10) })} className={pillCls(on)}>
                  {t.tag}
                  {t.n > 0 && <span className="font-mono text-micro opacity-70">{t.n}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
