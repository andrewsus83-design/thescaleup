"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { Alert } from "@/components/brand/primitives";
import { moveTask } from "@/lib/hub/task-actions";
import type { Priority, Stage } from "@/lib/hub/tasks/model";
import { cn } from "@/lib/utils";
import { Avatar, ChecklistChip, DueLabel, PriorityMark, STAGE_DOT, TagList, compactField } from "./parts";

export type BoardColumn = { key: string; label: string; stage: Stage };
export type BoardCard = {
  id: string;
  title: string;
  status: string;
  priority: Priority;
  due: string | null;
  assigneeEmail: string | null;
  tags: string[];
  /** The status keys this person may move the card to (includes its own). Under two means it cannot move. */
  moves: string[];
  closed: boolean;
  items?: { done: number; total: number };
};

/**
 * Columns by status. Drag a card to another column, or use the menu on the card: the menu is the way on phones and with a
 * keyboard. The move is shown at once and confirmed by the server; if the server says no, the card goes back and the reason shows.
 */
export function Board({ slug, brandId, columns, cards, today }: { slug: string; brandId: string; columns: BoardColumn[]; cards: BoardCard[]; today: string }) {
  const [shown, applyMove] = useOptimistic(cards, (cur: BoardCard[], a: { id: string; status: string }) => cur.map((c) => (c.id === a.id ? { ...c, status: a.status } : c)));
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const label = new Map(columns.map((c) => [c.key, c.label]));

  function send(id: string, to: string) {
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === to || !card.moves.includes(to)) return;
    setError(null);
    start(async () => {
      applyMove({ id, status: to });
      const r = await moveTask(brandId, id, to);
      if (!r.ok) setError(r.error);
    });
  }

  const dragging = dragId ? cards.find((c) => c.id === dragId) : null;

  return (
    <div>
      {error && (
        <Alert tone="bad" role="alert" className="mb-4">
          {error}
        </Alert>
      )}
      <p className="mb-3 text-caption text-ink-500">Drag a card to another column, or use the menu on the card.</p>
      <div className="relative -mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-6 sm:-mx-8 sm:px-8">
        {columns.map((col) => {
          const inCol = shown.filter((c) => c.status === col.key);
          const canDrop = !!dragging && dragging.moves.includes(col.key);
          return (
            <section
              key={col.key}
              aria-label={`${col.label}, ${inCol.length} tasks`}
              onDragOver={(e) => {
                if (canDrop) {
                  e.preventDefault();
                  setOver(col.key);
                }
              }}
              onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id) send(id, col.key);
              }}
              className={cn("w-72 shrink-0 snap-start rounded-bubble bg-paper-100 p-3 transition-shadow duration-150", over === col.key && "shadow-focus ring-2 ring-ink-800")}
            >
              <h2 className="mb-3 flex items-center gap-2 px-2 pt-1 text-small font-semibold text-ink-800">
                <span aria-hidden className={cn("size-2 rounded-full", STAGE_DOT[col.stage])} />
                {col.label}
                <span className="ml-auto font-mono text-caption font-medium text-ink-500">{inCol.length}</span>
              </h2>
              <ul className="space-y-3">
                {inCol.map((c) => {
                  const movable = c.moves.length > 1;
                  return (
                    <li
                      key={c.id}
                      draggable={movable}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", c.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(c.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOver(null);
                      }}
                      className={cn("rounded-field border border-hairline bg-paper-0 p-4 shadow-raised", movable && "cursor-grab active:cursor-grabbing", dragId === c.id && "opacity-50")}
                    >
                      <Link href={`/hub/b/${slug}/tasks/${c.id}`} className={cn("block text-small font-semibold hover:underline", c.closed ? "text-ink-500 line-through decoration-ink-300" : "text-ink-800")}>
                        {c.title}
                      </Link>
                      {c.tags.length > 0 && (
                        <div className="mt-2">
                          <TagList tags={c.tags} />
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <PriorityMark priority={c.priority} />
                        <DueLabel due={c.due} today={today} closed={c.closed} />
                        <ChecklistChip progress={c.items} />
                        <span className="ml-auto">
                          <Avatar person={c.assigneeEmail ? { email: c.assigneeEmail } : null} size="sm" />
                        </span>
                      </div>
                      {movable && (
                        <label className="mt-3 block">
                          <span className="sr-only">Move “{c.title}” to</span>
                          <select value={c.status} onChange={(e) => send(c.id, e.target.value)} className={cn(compactField, "h-10 w-full text-caption")}>
                            {c.moves.map((k) => (
                              <option key={k} value={k}>
                                {label.get(k) ?? k}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </li>
                  );
                })}
              </ul>
              {inCol.length === 0 && <p className="px-2 py-6 text-center text-caption text-ink-500">Nothing here</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
