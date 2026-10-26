"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Article, ArticleSource } from "@/lib/scalehub/content";
import { formatDate } from "@/lib/scalehub/content";
import { cn } from "@/lib/utils";

type SourceFilter = "all" | ArticleSource;

const SOURCE_TABS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "scaleup", label: "ScaleUp" },
  { value: "client", label: "Klien" },
];

function SourceBadge({ source, author }: { source: ArticleSource; author: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-wider",
        source === "scaleup"
          ? "border-coral/25 bg-coral/10 text-coral-soft"
          : "border-sky-500/25 bg-sky-500/10 text-sky-300",
      )}
    >
      {source === "scaleup" ? "ScaleUp" : author}
    </span>
  );
}

function Cover({ article }: { article: Article }) {
  if (article.coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={article.coverUrl}
        alt={article.title}
        className="h-40 w-full rounded-2xl object-cover"
      />
    );
  }
  return (
    <div className="flex h-40 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-coral/15 via-card to-obsidian">
      <span className="font-mono text-xs uppercase tracking-widest text-coral-soft/70">
        {article.category}
      </span>
    </div>
  );
}

export function ArticleGrid({ articles }: { articles: Article[] }) {
  const [source, setSource] = useState<SourceFilter>("all");
  const [cat, setCat] = useState<string>("all");

  const cats = useMemo(
    () => Array.from(new Set(articles.map((a) => a.category))).sort(),
    [articles],
  );

  const filtered = articles.filter(
    (a) =>
      (source === "all" || a.source === source) &&
      (cat === "all" || a.category === cat),
  );

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-white/8 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-full border border-white/10 bg-card/40 p-1">
          {SOURCE_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setSource(t.value)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                source === t.value
                  ? "bg-coral text-white"
                  : "text-slate-400 hover:text-white",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCat("all")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              cat === "all"
                ? "border-coral/30 bg-coral/10 text-coral-soft"
                : "border-white/10 text-slate-400 hover:text-white",
            )}
          >
            Semua topik
          </button>
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                cat === c
                  ? "border-coral/30 bg-coral/10 text-coral-soft"
                  : "border-white/10 text-slate-400 hover:text-white",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">
          Belum ada artikel untuk filter ini.
        </p>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <Link
              key={a.slug}
              href={`/scalehub/${a.slug}`}
              className="group flex flex-col rounded-3xl border border-white/8 bg-card/40 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-coral/30"
            >
              <Cover article={a} />
              <div className="mt-4 flex items-center justify-between gap-2">
                <SourceBadge source={a.source} author={a.authorName} />
                <ArrowUpRight className="h-4 w-4 text-slate-600 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-coral" />
              </div>
              <h2 className="mt-3 font-display text-lg font-bold leading-snug text-mist transition-colors group-hover:text-coral-soft">
                {a.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
                {a.excerpt}
              </p>
              <div className="mt-4 flex items-center gap-3 border-t border-white/5 pt-3 font-mono text-xs text-slate-500">
                <span>{a.category}</span>
                <span className="h-1 w-1 rounded-full bg-slate-600" />
                <span>{formatDate(a.date)}</span>
                <span className="h-1 w-1 rounded-full bg-slate-600" />
                <span>{a.readMinutes} mnt</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
