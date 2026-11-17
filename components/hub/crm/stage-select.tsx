"use client";

import { compactField } from "@/components/hub/tasks/parts";
import { setStage } from "@/lib/hub/crm-actions";

/** Moves a person to another stage the moment a stage is picked. Without scripts the Move button does it. */
export function StageSelect({ brandId, id, stage, options, name }: { brandId: string; id: string; stage: string; options: { key: string; label: string }[]; name: string }) {
  return (
    <form action={setStage} className="flex items-center gap-2">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`move-${id}`} className="sr-only">
        Move {name} to another stage
      </label>
      <select id={`move-${id}`} name="stage" defaultValue={stage} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={`${compactField} w-full`}>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="hit-44 h-11 rounded-full border-control border-ink-200 px-4 text-small font-semibold text-ink-800">
          Move
        </button>
      </noscript>
    </form>
  );
}
