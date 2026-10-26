"use client";

// Assets tab: the images, audio, video and documents that belong to the active brand. Files live in a
// private bucket in the real product; here uploads are mock entries (nothing leaves the browser).

import { useRef, useState } from "react";
import { File as FileIcon, FileText, ImageIcon, Music, Search, UploadCloud, Video } from "lucide-react";
import type { Asset, AssetKind, Project } from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { NeedProject, ProjectSwitcher } from "./project-switcher";
import { useRoom } from "./room-provider";
import { Btn, Card, Dot, EmptyState, PageHeader, Tag, inputCls, motion, pageX, pillCls } from "./ui";

const ICON = { image: ImageIcon, audio: Music, video: Video, document: FileText, other: FileIcon } as const;
const FILTERS: { key: AssetKind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "image", label: "Images" },
  { key: "audio", label: "Audio" },
  { key: "video", label: "Video" },
  { key: "document", label: "Documents" },
];
const USE: Record<AssetKind, string> = {
  image: "Builder input and output; found by title and tags",
  audio: "Content builder input; found by title and tags",
  video: "Content builder input; found by title and tags",
  document: "Catalogue, or “Use as context”: text is extracted, summarized and can be pinned",
  other: "Catalogue only",
};

function kindOf(file: File): AssetKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf" || file.type.startsWith("text/") || /word|sheet|presentation|document/.test(file.type)) return "document";
  return "other";
}

export function AssetsScreen() {
  const { activeProject } = useRoom();
  if (!activeProject) return <NeedProject what="Assets" />;
  return <AssetsFor key={activeProject.id} project={activeProject} />;
}

function AssetsFor({ project }: { project: Project }) {
  const api = useRoom();
  const assets = api.state.assets[project.id] ?? [];
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<AssetKind | "all">("all");
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const needle = q.trim().toLowerCase();
  const shown = assets.filter((a) => (kind === "all" || a.kind === kind) && (!needle || a.title.toLowerCase().includes(needle) || a.tags.some((t) => t.includes(needle)) || a.kind.includes(needle)));

  const add = (files: FileList | File[]) => {
    const list = Array.from(files);
    list.forEach((f) => api.addAsset(project.id, { title: f.name, kind: kindOf(f), tags: ["new"] }));
    if (list.length) api.toast(`${list.length} file${list.length === 1 ? "" : "s"} added (prototype: nothing was uploaded)`);
  };

  return (
    <div className={cn("mx-auto max-w-5xl py-10 sm:py-12", pageX)}>
      <PageHeader title="Assets" description={`Files that belong to ${project.name}. The AI finds them by title and tags; they are never loaded into the chat in full.`} action={<ProjectSwitcher />} />

      {/* BRAND "Empty / create" card: dashed Ink-200 border; Orange border and tint on hover or while a file is dragged over */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-card border-[1.5px] border-dashed px-6 py-10 text-center hover:border-brand-500 hover:bg-brand-25",
          motion,
          over ? "border-brand-500 bg-brand-25" : "border-ink-200",
        )}
      >
        <UploadCloud className="size-8 text-ink-500" aria-hidden />
        <p className="text-[16px] font-semibold">Drag files here, or</p>
        <input ref={input} type="file" multiple className="sr-only" tabIndex={-1} aria-label="Choose files" onChange={(e) => e.target.files && add(e.target.files)} />
        <Btn variant="secondary" className="hover:bg-paper-0" onClick={() => input.current?.click()}>Choose files</Btn>
        <p className="max-w-lg text-[13px] leading-[1.5] text-ink-500">Each upload gets a title, tags and an optional description. Uploads are logged in the chronicle; builder output is not.</p>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <label htmlFor="asset-search" className="sr-only">Search assets</label>
          <Search className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-ink-500" aria-hidden />
          <input id="asset-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by word, type or tag" className={cn(inputCls, "pl-12")} />
        </div>
        <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" aria-pressed={kind === f.key} onClick={() => setKind(f.key)} className={cn(pillCls(kind === f.key), kind !== f.key && "hover:bg-paper-0")}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={assets.length ? "No file matches." : "No files yet — add the logo, brand guide or price list to start."} />
        </div>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Assets">
          {shown.map((a) => (
            <AssetCard key={a.id} asset={a} onContext={() => api.toggleAssetContext(project.id, a.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AssetCard({ asset: a, onContext }: { asset: Asset; onContext: () => void }) {
  const Icon = ICON[a.kind];
  return (
    <li className="flex">
      <Card small interactive className="flex w-full flex-col">
        <div className="flex items-start gap-4">
          <span aria-hidden className="inline-flex size-11 shrink-0 items-center justify-center rounded-nav bg-paper-100 text-ink-800">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold" title={a.title}>{a.title}</p>
            <p className="mt-0.5 text-[13px] capitalize text-ink-500">{a.kind}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {a.tags.map((t) => (
            <Tag key={t}>#{t}</Tag>
          ))}
          {a.byBuilder && (
            <Tag className="bg-info-bg">
              <Dot className="size-1.5 bg-info" /> Made by builder
            </Tag>
          )}
          {a.useAsContext && (
            <Tag className="bg-brand-chip text-brand-chip-ink">
              <Dot className="size-1.5 bg-brand-500" /> In context
            </Tag>
          )}
        </div>
        <p className="mt-4 text-[13px] leading-[1.5] text-ink-500">{USE[a.kind]}</p>
        {a.kind === "document" && (
          <button
            type="button"
            role="switch"
            aria-checked={!!a.useAsContext}
            onClick={onContext}
            className={cn("mt-4 flex min-h-12 items-center justify-between gap-3 rounded-field border-[1.5px] border-ink-200 px-4 py-2 text-[14px] font-semibold text-ink-800 hover:bg-paper-100", motion)}
          >
            Use as context
            <span aria-hidden className={cn("relative h-6 w-11 shrink-0 rounded-full", motion, a.useAsContext ? "bg-brand-500" : "bg-ink-200")}>
              <span className={cn("absolute left-0.5 top-0.5 size-5 rounded-full bg-paper-0 shadow-sm transition-transform duration-150 ease-out", a.useAsContext && "translate-x-5")} />
            </span>
          </button>
        )}
      </Card>
    </li>
  );
}
