"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import { Btn } from "@/components/brand/primitives";
import { ATTACH_LIMITS, attachError, sizeLabel } from "@/lib/hub/mail/files";
import { discardUpload, prepareUpload } from "@/lib/hub/mail-actions";

type Item = { key: string; name: string; size: number; state: "uploading" | "done" | "error"; pct: number; id?: string; error?: string };

/** Sends the file straight to storage on the link the server made, and reports progress. Resolves true when storage accepted it. */
function put(url: string, file: File, onProgress: (pct: number) => void, register: (x: XMLHttpRequest) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const x = new XMLHttpRequest();
    register(x);
    x.open("PUT", url);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    x.onload = () => resolve(x.status >= 200 && x.status < 300);
    x.onerror = () => resolve(false);
    x.onabort = () => resolve(false);
    x.send(file);
  });
}

/**
 * The paperclip of the writing window. Each file goes to storage as soon as it is picked; the form then carries only the ids of
 * the finished uploads, so Send is quick and a large file never passes through the app's server. `onBusy` keeps Send off while
 * a file is still going up.
 */
export function AttachPicker({ brandId, onBusy }: { brandId: string; onBusy: (busy: boolean) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const live = useRef(new Map<string, XMLHttpRequest>());
  const mine = useRef<Item[]>([]);

  const set = (next: Item[]) => {
    mine.current = next;
    setItems(next);
  };
  const patch = (key: string, p: Partial<Item>) => set(mine.current.map((i) => (i.key === key ? { ...i, ...p } : i)));

  useEffect(() => {
    onBusy(items.some((i) => i.state === "uploading"));
  }, [items, onBusy]);

  async function upload(file: File, key: string) {
    const ticket = await prepareUpload({ brandId, name: file.name, type: file.type, size: file.size, count: 0, total: 0 });
    if (!ticket.ok) return patch(key, { state: "error", error: ticket.error });
    patch(key, { id: ticket.id });
    const ok = await put(
      ticket.url,
      file,
      (pct) => patch(key, { pct }),
      (x) => live.current.set(key, x),
    );
    live.current.delete(key);
    if (!mine.current.some((i) => i.key === key)) return; // removed while it was going up
    if (ok) return patch(key, { state: "done", pct: 100 });
    void discardUpload(brandId, ticket.id);
    patch(key, { state: "error", error: "The upload failed. Check your connection and try again." });
  }

  function pick(list: FileList | null) {
    if (!list || list.length === 0) return;
    const next = [...mine.current];
    const started: { file: File; key: string }[] = [];
    for (const file of Array.from(list)) {
      const key = crypto.randomUUID();
      const counted = next.filter((i) => i.state !== "error");
      const bad = attachError(file.name, file.size, counted.length, counted.reduce((n, i) => n + i.size, 0));
      if (bad) next.push({ key, name: file.name, size: file.size, state: "error", pct: 0, error: bad });
      else {
        next.push({ key, name: file.name, size: file.size, state: "uploading", pct: 0 });
        started.push({ file, key });
      }
    }
    set(next);
    if (inputRef.current) inputRef.current.value = "";
    for (const s of started) void upload(s.file, s.key);
  }

  function remove(item: Item) {
    live.current.get(item.key)?.abort();
    live.current.delete(item.key);
    set(mine.current.filter((i) => i.key !== item.key));
    if (item.id && item.state !== "error") void discardUpload(brandId, item.id);
  }

  return (
    <div className="px-5 pb-4">
      {items.map((i) => i.state === "done" && i.id && <input key={i.key} type="hidden" name="attachmentId" value={i.id} />)}
      <input ref={inputRef} type="file" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => pick(e.target.files)} />
      {items.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2" aria-label="Attached files">
          {items.map((i) => (
            <li key={i.key} className="min-w-0 max-w-full">
              <span className={`inline-flex min-h-11 max-w-full items-center gap-2 rounded-full pl-4 pr-1 text-small ${i.state === "error" ? "bg-danger-bg text-danger-ink" : "bg-paper-100 text-ink-800"}`}>
                {i.state === "uploading" ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : <Paperclip className="size-4 shrink-0" aria-hidden />}
                <span className="min-w-0 truncate">{i.name}</span>
                <span className="shrink-0 whitespace-nowrap text-caption text-ink-500">{i.state === "uploading" ? `${i.pct}%` : i.state === "error" ? "" : sizeLabel(i.size)}</span>
                <button type="button" onClick={() => remove(i)} aria-label={`Remove ${i.name}`} className="hit-44 inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-paper-200">
                  <X className="size-4" aria-hidden />
                </button>
              </span>
              {i.state === "error" && (
                <p role="alert" className="mt-1 px-4 text-caption text-danger">
                  {i.error}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <Btn variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={items.filter((i) => i.state !== "error").length >= ATTACH_LIMITS.files}>
        <Paperclip className="size-4" aria-hidden />
        Attach files
      </Btn>
      <span className="ml-3 text-caption text-ink-500">Up to {ATTACH_LIMITS.files} files, {ATTACH_LIMITS.bytes / 1024 / 1024} MB in total.</span>
    </div>
  );
}
