"use client";

// Assets tab: the images, audio, video and documents that belong to the active brand. Files live in a
// private bucket in the real product; here uploads are mock entries (nothing leaves the browser).

import { useRef, useState } from "react";
import { File as FileIcon, FileText, ImageIcon, Music, Search, UploadCloud, Video } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import type { Asset, AssetKind, Project } from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { NeedProject, ProjectSwitcher } from "./project-switcher";
import { useRoom } from "./room-provider";
import { Btn, Chip, inputCls } from "./ui";

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
    <div className="mx-auto max-w-5xl px-5 py-8">
      <PageHeader title="Assets" description={`Files that belong to ${project.name}. The AI finds them by title and tags; they are never loaded into the chat in full.`} action={<ProjectSwitcher />} />

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
        className={cn("flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-5 py-8 text-center transition-colors", over ? "border-coral bg-coral/10" : "border-white/15 bg-card/30")}
      >
        <UploadCloud className="h-7 w-7 text-slate-300" aria-hidden />
        <p className="text-sm font-medium">Drag files here, or</p>
        <input ref={input} type="file" multiple className="sr-only" tabIndex={-1} aria-label="Choose files" onChange={(e) => e.target.files && add(e.target.files)} />
        <Btn variant="secondary" onClick={() => input.current?.click()}>Choose files</Btn>
        <p className="text-xs text-slate-400">Each upload gets a title, tags and an optional description. Uploads are logged in the chronicle; builder output is not.</p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <label htmlFor="asset-search" className="sr-only">Search assets</label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input id="asset-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by word, type or tag" className={`${inputCls} pl-10`} />
        </div>
        <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={kind === f.key}
              onClick={() => setKind(f.key)}
              className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70", kind === f.key ? "border-coral/50 bg-coral/10 text-coral" : "border-white/12 text-slate-300 hover:bg-white/5")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">{assets.length ? "No file matches." : "No files yet — add the logo, brand guide or price list to start."}</p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Assets">
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
    <li className="flex flex-col rounded-2xl border border-white/8 bg-card/40 p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-slate-200">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold" title={a.title}>{a.title}</p>
          <p className="text-xs capitalize text-slate-400">{a.kind}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {a.tags.map((t) => (
          <Chip key={t} tone="neutral">#{t}</Chip>
        ))}
        {a.byBuilder && <Chip tone="info">Made by builder</Chip>}
        {a.useAsContext && <Chip tone="coral">In context</Chip>}
      </div>
      <p className="mt-3 text-xs text-slate-400">{USE[a.kind]}</p>
      {a.kind === "document" && (
        <button
          type="button"
          role="switch"
          aria-checked={!!a.useAsContext}
          onClick={onContext}
          className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/70"
        >
          Use as context
          <span aria-hidden className={cn("relative h-5 w-9 rounded-full transition-colors", a.useAsContext ? "bg-coral" : "bg-white/20")}>
            <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", a.useAsContext ? "left-[18px]" : "left-0.5")} />
          </span>
        </button>
      )}
    </li>
  );
}
