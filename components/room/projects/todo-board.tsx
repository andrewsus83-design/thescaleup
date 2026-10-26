"use client";

// The To do tab as a board, like Trello: the project's tips are cards on four lists (On progress, Approved, Rejected, Done).
// A card moves by drag and drop on a desktop, or from its detail sheet — the way on a phone and from the keyboard.
// The provider writes every move to the Chronicle. Inside a list the cards keep their horizon order (Week 1 first).

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Hammer, Lightbulb, UserRound } from "lucide-react";
import { TODO_STATUSES, groupLabel, isOpen, sortByHorizon, statusLabel } from "@/lib/room/todos";
import type { Project, Todo, TodoStatus } from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { useRoom } from "../room-provider";
import { Btn, Chip, Dot, EmptyState, Sheet, Tag, capsCls, motion, pillCls, type Tone } from "../ui";

/** Each list's colour: the chip tone and its dot. A dot always travels with its label, so colour is never the only signal. */
const STATUS_UI: Record<TodoStatus, { tone: Tone; dot: string }> = {
  progress: { tone: "info", dot: "bg-info" },
  approved: { tone: "brand", dot: "bg-brand-500" },
  rejected: { tone: "bad", dot: "bg-danger" },
  done: { tone: "ok", dot: "bg-success" },
};

const PEOPLE = ["Dewi", "Andre", "Sari"];

export function TodoBoard({ project }: { project: Project }) {
  const api = useRoom();
  const todos = api.state.todos[project.id] ?? [];
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<TodoStatus | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const lists = useRef<Partial<Record<TodoStatus, HTMLElement | null>>>({});

  if (!todos.length) return <EmptyState title="No to dos yet" hint="The first audit turns its insights into a Week 1 plan. You can also add one from the chat with /todo." />;

  const sorted = sortByHorizon(todos);
  const inList = (s: TodoStatus) => sorted.filter((t) => t.status === s);
  const openTodo = todos.find((t) => t.id === openId) ?? null;

  const drop = (e: React.DragEvent, status: TodoStatus) => {
    e.preventDefault();
    const t = todos.find((x) => x.id === (e.dataTransfer.getData("text/plain") || dragId));
    setDragId(null);
    setOverKey(null);
    if (!t || t.status === status) return;
    api.setTodoStatus(project.id, t.id, status);
    api.toast(`Moved to ${statusLabel(status)}: ${t.title}`);
  };

  return (
    <div>
      <p className="mb-4 max-w-chat text-pretty text-caption text-ink-500">
        {todos.filter(isOpen).length} open of {todos.length}. Drag a card to another list, or open it to pick a status. Every move is written to the Chronicle.
      </p>

      {/* below xl the lists scroll sideways: these jump to one */}
      <nav aria-label="Jump to a list" className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:hidden">
        {TODO_STATUSES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => lists.current[s.key]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" })}
            className={cn(pillCls(false), "justify-start whitespace-nowrap")}
          >
            <Dot className={STATUS_UI[s.key].dot} />
            {s.label}
          </button>
        ))}
      </nav>

      {/* `relative`: the sr-only counts inside would otherwise be positioned against the app shell, and lists scrolled out of sight would make the shell itself scrollable sideways */}
      <div className="no-scrollbar relative -mx-5 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto scroll-px-5 px-5 pb-2 sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:-mx-12 lg:scroll-px-12 lg:px-12 xl:mx-0 xl:grid xl:grid-cols-4 xl:overflow-visible xl:px-0 xl:pb-0">
        {TODO_STATUSES.map((s) => {
          const items = inList(s.key);
          return (
            <section
              key={s.key}
              ref={(el) => {
                lists.current[s.key] = el;
              }}
              aria-labelledby={`todo-list-${s.key}`}
              onDragOver={(e) => {
                if (!dragId) return; // only a card of this board is a drop
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOverKey(s.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverKey((k) => (k === s.key ? null : k));
              }}
              onDrop={(e) => drop(e, s.key)}
              className={cn(
                "flex min-h-48 min-w-0 shrink-0 basis-5/6 snap-start flex-col rounded-bubble border-control bg-paper-0 p-2 sm:basis-72 xl:basis-auto",
                motion,
                overKey === s.key ? "border-ink-800" : "border-hairline",
              )}
            >
              <header className="mb-2 flex items-center justify-between gap-2 px-2 pt-1">
                <h3 id={`todo-list-${s.key}`}>
                  <Chip tone={STATUS_UI[s.key].tone}>{s.label}</Chip>
                </h3>
                <span className="font-mono text-code text-ink-500">
                  <span className="sr-only">Cards: </span>
                  {items.length}
                </span>
              </header>
              <ul className="flex flex-1 flex-col gap-2">
                {items.map((t) => (
                  <li key={t.id}>
                    <Card todo={t} dragging={dragId === t.id} onOpen={() => setOpenId(t.id)} onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setOverKey(null); }} />
                  </li>
                ))}
                {!items.length && (
                  <li className="flex flex-1 items-center justify-center rounded-field border-control border-dashed border-ink-200 px-4 py-8 text-center text-caption text-ink-500">
                    {dragId ? "Drop here" : "No cards"}
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>

      <Sheet open={!!openTodo} onClose={() => setOpenId(null)} title={openTodo?.title ?? "To do"}>
        {openTodo && <CardBack project={project} todo={openTodo} />}
      </Sheet>
    </div>
  );
}

/** The card on a list: horizon, assignee, title and the tip it came from. The whole card is the drag handle and opens the sheet. */
function Card({ todo, dragging, onOpen, onDragStart, onDragEnd }: { todo: Todo; dragging: boolean; onOpen: () => void; onDragStart: () => void; onDragEnd: () => void }) {
  return (
    // a div, not a <button>: Firefox does not start a drag from a button inside a draggable element
    <div
      role="button"
      tabIndex={0}
      draggable
      aria-haspopup="dialog"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", todo.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn("block cursor-grab rounded-field bg-paper-100 p-3 text-left hover:shadow-raised active:cursor-grabbing", motion, dragging && "opacity-40")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Tag className="bg-paper-0">{groupLabel(todo.group)}</Tag>
        {todo.assignee && (
          <Tag className="bg-paper-0">
            <UserRound className="size-3" aria-hidden />
            {todo.assignee}
          </Tag>
        )}
      </div>
      <p className={cn("mt-2 text-small font-semibold text-ink-800", todo.status === "done" && "line-through", (todo.status === "done" || todo.status === "rejected") && "text-ink-500")}>{todo.title}</p>
      {todo.tip && (
        <p className="mt-2 flex items-start gap-2 text-caption text-ink-500">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="line-clamp-2">{todo.tip}</span>
        </p>
      )}
    </div>
  );
}

/** The back of a card (a sheet): pick the status, read the tip it came from, assign it, start a build. */
function CardBack({ project, todo }: { project: Project; todo: Todo }) {
  const api = useRoom();
  const router = useRouter();
  const builds = api.state.builds[project.id] ?? [];
  const canBuild = /builder/i.test(todo.service ?? "") && isOpen(todo) && !builds.some((b) => b.todoId === todo.id);
  const rows: [string, string | undefined][] = [
    ["Horizon", groupLabel(todo.group)],
    ["Failed check", todo.check],
    ["Tip", todo.tip],
    ["Fixed by", todo.service],
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className={capsCls}>Status</p>
        <div role="group" aria-label="Status" className="mt-3 flex flex-wrap gap-2">
          {TODO_STATUSES.map((s) => (
            <button key={s.key} type="button" aria-pressed={todo.status === s.key} onClick={() => api.setTodoStatus(project.id, todo.id, s.key)} className={pillCls(todo.status === s.key)}>
              <Dot className={STATUS_UI[s.key].dot} />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {todo.check ? (
        <dl className="space-y-4">
          {rows.map(([k, v]) =>
            v ? (
              <div key={k} className="grid gap-1 sm:grid-cols-3 sm:gap-4">
                <dt className={capsCls}>{k}</dt>
                <dd className="text-small text-ink-800 sm:col-span-2">{v}</dd>
              </div>
            ) : null,
          )}
        </dl>
      ) : (
        <p className="text-small text-ink-500">Manual item: it did not come from an audit tip.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-3 text-small font-semibold text-ink-500">
          Assign
          <select
            value={todo.assignee ?? ""}
            onChange={(e) => api.assignTodo(project.id, todo.id, e.target.value)}
            className={cn("h-11 rounded-full border-control border-ink-200 bg-paper-0 px-4 text-small font-semibold text-ink-800 hover:bg-paper-100", motion)}
          >
            <option value="">Unassigned</option>
            {PEOPLE.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        {canBuild && (
          <Btn
            variant="secondary"
            onClick={() => {
              api.startBuild(project.id, todo);
              api.open(project.id);
              router.push(api.href("/builder"));
            }}
          >
            <Hammer className="size-4" aria-hidden /> Start a build
          </Btn>
        )}
      </div>
    </div>
  );
}
