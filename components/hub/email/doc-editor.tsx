"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { inputCls, labelCls, pillCls, textareaCls } from "@/components/brand/styles";
import { compactField } from "@/components/hub/tasks/parts";
import { BLOCK_LABEL, BLOCK_TYPES, EMAIL_LIMITS, MERGE_TAGS, newBlock, type Block, type BlockType, type Doc } from "@/lib/hub/email/model";
import { cn } from "@/lib/utils";

/**
 * The words of one email: subject, preview line and the blocks. Colour and footer are not here; a sequence sets them once for all its emails.
 * Same fields, same limits and same wording as the campaign editor, so people learn it once.
 */
export function DocEditor({ doc, onChange, idPrefix }: { doc: Doc; onChange: (next: Doc) => void; idPrefix: string }) {
  const setBlock = (i: number, patch: Record<string, string>) => onChange({ ...doc, blocks: doc.blocks.map((b, k) => (k === i ? ({ ...b, ...patch } as Block) : b)) });
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= doc.blocks.length) return;
    const blocks = [...doc.blocks];
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    onChange({ ...doc, blocks });
  };
  const add = (t: BlockType) => doc.blocks.length < EMAIL_LIMITS.blocks && onChange({ ...doc, blocks: [...doc.blocks, newBlock(t)] });
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label htmlFor={`${idPrefix}-subject`} className={labelCls}>
            Subject
          </label>
          <input id={`${idPrefix}-subject`} value={doc.subject} maxLength={EMAIL_LIMITS.subject} onChange={(e) => onChange({ ...doc, subject: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-pre`} className={labelCls}>
            Preview line
          </label>
          <input id={`${idPrefix}-pre`} value={doc.preheader} maxLength={EMAIL_LIMITS.preheader} onChange={(e) => onChange({ ...doc, preheader: e.target.value })} className={inputCls} />
          <p className="mt-2 text-caption text-ink-500">The grey text next to the subject in most inboxes.</p>
        </div>
        <p className="text-caption text-ink-500">
          Personalise with {MERGE_TAGS.map((t) => `{{${t}}}`).join(", ")}. Add a fallback after a bar, like {"{{first_name|there}}"}, for people without a name.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-small font-semibold text-ink-800">Content</h3>
        {doc.blocks.length === 0 && <p className="rounded-field bg-paper-100 p-4 text-small text-ink-500">Nothing here yet. Add a block below.</p>}
        <ol className="space-y-3">
          {doc.blocks.map((b, i) => (
            <li key={i} className="rounded-bubble border border-hairline bg-paper-0 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-small font-semibold text-ink-800">{BLOCK_LABEL[b.type]}</span>
                <span className="flex items-center gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move block ${i + 1} up`} className="hit-44 inline-flex size-11 items-center justify-center rounded-full text-ink-500 hover:bg-paper-100 disabled:opacity-30">
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === doc.blocks.length - 1} aria-label={`Move block ${i + 1} down`} className="hit-44 inline-flex size-11 items-center justify-center rounded-full text-ink-500 hover:bg-paper-100 disabled:opacity-30">
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                  <button type="button" onClick={() => onChange({ ...doc, blocks: doc.blocks.filter((_, k) => k !== i) })} aria-label={`Delete block ${i + 1}`} className="hit-44 inline-flex size-11 items-center justify-center rounded-full text-ink-500 hover:bg-paper-100">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </span>
              </div>
              {b.type === "heading" && <input aria-label="Heading" value={b.text} maxLength={EMAIL_LIMITS.heading} onChange={(e) => setBlock(i, { text: e.target.value })} className={cn(compactField, "w-full")} />}
              {b.type === "text" && <textarea aria-label="Text" value={b.text} maxLength={EMAIL_LIMITS.text} rows={4} onChange={(e) => setBlock(i, { text: e.target.value })} className={textareaCls} />}
              {b.type === "button" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <input aria-label="Button label" placeholder="Button text" value={b.label} maxLength={EMAIL_LIMITS.label} onChange={(e) => setBlock(i, { label: e.target.value })} className={cn(compactField, "w-full")} />
                  <input aria-label="Button link" placeholder="https://…" inputMode="url" autoCapitalize="none" spellCheck={false} value={b.url} maxLength={EMAIL_LIMITS.url} onChange={(e) => setBlock(i, { url: e.target.value })} className={cn(compactField, "w-full")} />
                </div>
              )}
              {b.type === "image" && (
                <div className="space-y-3">
                  <input aria-label="Image link" placeholder="Link to the picture, https://…" inputMode="url" autoCapitalize="none" spellCheck={false} value={b.url} maxLength={EMAIL_LIMITS.url} onChange={(e) => setBlock(i, { url: e.target.value })} className={cn(compactField, "w-full")} />
                  <input aria-label="Describe the image" placeholder="Describe the picture in a few words" value={b.alt} maxLength={EMAIL_LIMITS.alt} onChange={(e) => setBlock(i, { alt: e.target.value })} className={cn(compactField, "w-full")} />
                  <input aria-label="Where the image links to (optional)" placeholder="Where it goes when clicked (optional)" inputMode="url" autoCapitalize="none" spellCheck={false} value={b.link} maxLength={EMAIL_LIMITS.url} onChange={(e) => setBlock(i, { link: e.target.value })} className={cn(compactField, "w-full")} />
                </div>
              )}
              {(b.type === "divider" || b.type === "spacer") && <p className="text-caption text-ink-500">{b.type === "divider" ? "A thin line between two parts." : "Empty space."}</p>}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Add a block">
          {BLOCK_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => add(t)} disabled={doc.blocks.length >= EMAIL_LIMITS.blocks} className={pillCls(false)}>
              <Plus className="size-4" aria-hidden />
              {BLOCK_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
