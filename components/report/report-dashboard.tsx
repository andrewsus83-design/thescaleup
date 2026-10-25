"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  Sparkles, TrendingUp, TrendingDown, Minus, Info, ChevronLeft, ChevronRight, ChevronDown,
  CircleCheck, CircleX, TriangleAlert, Lightbulb,
} from "lucide-react";
import type { ReportMetrics, PostMetric } from "@/lib/report/types";
import { METRIC_INFO, SCOPE_INFO, scopeFor, type MetricInfo, type Scope } from "@/lib/report/metric-info";
import {
  efficiency,
  computeDeltas,
  pctChange,
  qualityScore,
  bestDayTime,
  reelRows,
  overlapRows,
  topMovers,
  type Mover,
  totalActions,
  postTotal,
  postHasData,
} from "@/lib/report/derive";
import { runChecks, summarizeChecks, type DataCheck } from "@/lib/report/checks";
import { autoNotes, type AutoNote } from "@/lib/report/notes";

const INK = "#1B2A4A";
/** Brand/accent colors are fills. As text they must clear 4.5:1 on white (WCAG AA), else fall back to ink —
 *  a light accent like #38B6F0 is ~2.2:1 and unreadable as a number. */
function readableOnWhite(hex?: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return INK;
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (lum + 0.05) >= 4.5 ? `#${m[1]}` : INK;
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("id-ID");
}
function pct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return (n * 100).toFixed(2) + "%";
}
function pct1(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return (n * 100).toFixed(1) + "%";
}
/** Ratios ≥1 read better as "×" (e.g. reach 4.8× followers), else as a percent. */
function times(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n >= 1 ? n.toFixed(1) + "×" : (n * 100).toFixed(1) + "%";
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** Δ badge for period-over-period change (fraction, e.g. 0.23 → +23%). */
function DeltaBadge({ d }: { d: number | null }) {
  if (d == null) return null;
  const up = d >= 0;
  const Icon = d === 0 ? Minus : up ? TrendingUp : TrendingDown;
  const cls = d === 0 ? "text-slate-500 bg-slate-100" : up ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />
      {up && d !== 0 ? "+" : ""}
      {(d * 100).toFixed(0)}%
    </span>
  );
}
function monthLabel(ym: string): string {
  const mo = Number(ym.slice(5, 7));
  return mo >= 1 && mo <= 12 ? `${MONTHS[mo - 1]} ${ym.slice(0, 4)}` : ym;
}
const CT_LABEL: Record<string, string> = {
  POST: "Post / Image",
  CAROUSEL_CONTAINER: "Carousel",
  REEL: "Reels",
  STORY: "Story",
};

/** Platform + section-scope context, so tiles and tooltips can name their scope without threading props. */
const PlatformCtx = createContext<string | undefined>(undefined);
const ScopeCtx = createContext<Scope | undefined>(undefined);

const POP_W = 256; // popover width (px)

/** Info popover: description + rumus + benchmark + relation. Opens on hover (mouse), focus (keyboard)
 *  or tap (touch). Positioned `fixed` and clamped to the viewport so the deck's scroll containers
 *  can't clip it. It follows its icon while the page scrolls (focusing an off-screen icon scrolls it
 *  into view) and closes on Esc, blur, an outside tap, or once the icon has left the screen. */
function InfoDot({ id, info }: { id?: string; info?: MetricInfo }) {
  const platform = useContext(PlatformCtx);
  const btn = useRef<HTMLButtonElement>(null);
  const openedAt = useRef(0);
  const seenVisible = useRef(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const open = pos != null;
  // Re-anchor under the icon. Close only if the icon WAS on screen during this open and has now left —
  // a focus on an off-screen icon opens first, and the browser scrolls it into view afterwards.
  const place = useCallback((closeIfGone: boolean) => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const visible = r.bottom >= 0 && r.top <= window.innerHeight;
    if (visible) seenVisible.current = true;
    else if (closeIfGone && seenVisible.current) return setPos(null);
    const left = Math.min(Math.max(8, r.left + r.width / 2 - POP_W / 2), window.innerWidth - POP_W - 8);
    setPos({ top: r.bottom + 6, left });
  }, []);
  useEffect(() => {
    if (!open) return;
    const follow = () => place(true);
    const outside = (e: PointerEvent) => {
      if (!btn.current?.contains(e.target as Node)) setPos(null);
    };
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open, place]);
  const m = info ?? (id ? METRIC_INFO[id] : undefined);
  if (!m) return null;
  const sc = id ? scopeFor(id, platform) : undefined;
  const show = () => {
    openedAt.current = Date.now();
    seenVisible.current = false;
    place(false);
  };
  return (
    <span className="relative inline-flex align-middle">
      <button
        ref={btn}
        type="button"
        aria-label={`Info: ${m.label}`}
        aria-expanded={pos != null}
        // a tap fires focus then click on the same gesture: only a later click closes it
        onClick={() => (pos && Date.now() - openedAt.current > 250 ? setPos(null) : show())}
        onPointerEnter={(e) => e.pointerType === "mouse" && show()}
        onPointerLeave={(e) => e.pointerType === "mouse" && setPos(null)}
        onFocus={show}
        onBlur={() => setPos(null)}
        onKeyDown={(e) => e.key === "Escape" && setPos(null)}
        className="-m-1 rounded-full p-1 text-slate-500 transition-colors hover:text-slate-600 focus-visible:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        <Info className="h-3 w-3" aria-hidden />
      </button>
      {pos && (
      <span
        role="tooltip"
        style={{ position: "fixed", top: pos.top, left: pos.left, width: POP_W }}
        className="pointer-events-none z-50 whitespace-normal rounded-xl border border-slate-200 bg-white p-3 text-left text-[11px] font-normal normal-case leading-relaxed tracking-normal text-slate-600 shadow-xl"
      >
        <b className="text-slate-800">{m.label}</b>
        <span className="mt-1 block text-slate-600">{m.desc}</span>
        {sc && (
          <span className="mt-1 block">
            <b className="text-slate-500">Cakupan:</b> {SCOPE_INFO[sc].label} — {SCOPE_INFO[sc].desc}
          </span>
        )}
        {m.rumus && (
          <span className="mt-1.5 block">
            <b className="text-slate-500">Rumus:</b> <code className="rounded bg-slate-100 px-1 text-slate-700">{m.rumus}</code>
          </span>
        )}
        {m.benchmark && (
          <span className="mt-1 block">
            <b className="text-emerald-700">Patokan bagus:</b> {m.benchmark}
          </span>
        )}
        {m.relation && <span className="mt-1 block text-slate-500">↔ {m.relation}</span>}
      </span>
      )}
    </span>
  );
}

/** Section heading with an optional info tooltip. */
function SectionTitle({ children, info }: { children: React.ReactNode; info?: string }) {
  return (
    <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
      {children}
      {info && <InfoDot id={info} />}
    </p>
  );
}

const SCOPE_LEGEND: Record<Scope, string> = {
  A: "semua konten di periode ini",
  P: "hanya post yang terbit di periode ini",
  S: "story saja",
  D: "snapshot audiens saat ditarik",
};

/** Small pill naming which slice of the data a number covers (account vs posts vs …). */
function ScopeChip({ scope }: { scope: Scope }) {
  const s = SCOPE_INFO[scope];
  return (
    <span
      title={`${s.label}: ${s.desc}`}
      className="inline-flex items-center rounded bg-slate-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-slate-600"
    >
      {s.label}
    </span>
  );
}

/** Small caps label that names a group of tiles. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">{children}</p>;
}

/** Grid whose tiles default to one scope (e.g. a Stories-only block). */
function ScopeBox({ scope, className, children }: { scope: Scope; className?: string; children: React.ReactNode }) {
  return (
    <ScopeCtx.Provider value={scope}>
      <div className={className}>{children}</div>
    </ScopeCtx.Provider>
  );
}

function Tile({
  label,
  value,
  accent,
  hint,
  info,
  delta,
  scope,
  hero,
  className,
}: {
  label: string;
  value: string;
  accent?: string;
  hint?: string;
  info?: string;
  delta?: number | null;
  scope?: Scope;
  /** The one lead number of a view: bigger type, same sans. */
  hero?: boolean;
  className?: string;
}) {
  const platform = useContext(PlatformCtx);
  const sectionScope = useContext(ScopeCtx);
  const sc = scope ?? (info ? scopeFor(info, platform) : undefined) ?? sectionScope;
  const na = value === "—"; // every formatter returns "—" for "no data"
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 ${className ?? ""}`}>
      <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
        {info && <InfoDot id={info} />}
      </p>
      {/* the delta sits beside the number (wrapping under it when narrow) so a long label can never push it out of the tile */}
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <p
          className={`${hero ? "text-4xl sm:text-5xl" : "text-2xl"} font-bold ${na ? "text-slate-500" : ""}`}
          style={na ? undefined : { color: readableOnWhite(accent) }}
          title={na ? "Data tidak tersedia dari Zernio (bukan 0)" : undefined}
        >
          {na ? "n/a" : value}
        </p>
        {delta != null && <DeltaBadge d={delta} />}
      </div>
      {(sc || hint) && (
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500">
          {sc && <ScopeChip scope={sc} />}
          {hint && <span>{hint}</span>}
        </p>
      )}
    </div>
  );
}

/** Simple SVG line chart of a daily series. */
function FollowerLine({ series, color }: { series: { date: string; value: number }[]; color: string }) {
  const vals = series.map((s) => s.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const w = 600;
  const h = 60;
  const pts = series
    .map((s, i) => `${(i / (series.length - 1)) * w},${h - ((s.value - min) / span) * (h - 8) - 4}`)
    .join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-16 w-full">
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
        <span>{series[0]?.date}</span>
        <span>{series[series.length - 1]?.date}</span>
      </div>
    </div>
  );
}

/** Horizontal bar list of top demographic values. */
function BarList({
  title,
  items,
  color,
}: {
  title: string;
  items?: { name: string; value: number }[];
  color: string;
}) {
  const list = (items ?? []).slice(0, 5);
  const total = list.reduce((a, x) => a + x.value, 0) || 1;
  if (!list.length) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="space-y-1.5">
        {list.map((x) => (
          <div key={x.name}>
            <div className="mb-0.5 flex justify-between text-xs">
              <span className="truncate text-slate-600">{x.name}</span>
              <span className="text-slate-500">{Math.round((x.value / total) * 100)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${(x.value / total) * 100}%`, backgroundColor: color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Follower-share vs engaged-share table with a signed gap. */
function OverlapTable({
  title,
  rows,
  brandColor,
  accentColor,
}: {
  title: string;
  rows: { name: string; follower: number; engaged: number; gap: number }[];
  brandColor: string;
  accentColor: string;
}) {
  const list = rows.slice(0, 6);
  if (!list.length) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[11px] uppercase text-slate-500">
            <th className="py-1">Segmen</th>
            <th className="py-1 text-right">
              <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: brandColor }} />
              Followers
            </th>
            <th className="py-1 text-right">
              <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
              Interaksi
            </th>
            <th className="py-1 text-right">Gap</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.name} className="border-t border-slate-50">
              <td className="py-1.5 pr-2 text-slate-600">{r.name}</td>
              <td className="py-1.5 text-right text-slate-500">{(r.follower * 100).toFixed(0)}%</td>
              <td className="py-1.5 text-right text-slate-500">{(r.engaged * 100).toFixed(0)}%</td>
              <td className={`py-1.5 text-right font-semibold ${r.gap >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {r.gap >= 0 ? "+" : ""}
                {(r.gap * 100).toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** List of post movers (drivers up / drags down) with an auto-reason. */
function MoverList({ title, tone, rows, accent }: { title: string; tone: "up" | "down"; rows: Mover[]; accent: string }) {
  const Icon = tone === "up" ? TrendingUp : TrendingDown;
  if (!rows.length) return null;
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      <div className="space-y-2">
        {rows.map((m, i) => (
          <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] text-slate-500">
                {m.post.date}
                {m.post.pillar ? ` · ${m.post.pillar}` : ""}
              </p>
              <span className="shrink-0 text-[11px] font-semibold" style={{ color: accent }}>
                {fmt(m.reach)} reach · {Math.round(m.shareOfReach * 100)}%
              </span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-sm text-slate-700">{m.post.caption || "—"}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              ER {m.er != null ? (m.er * 100).toFixed(1) + "%" : "—"} · Total Actions {fmt(m.actions)}
            </p>
            <p className="mt-1 text-[11px]" style={{ color: accent }}>
              {m.reason}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const CHECK_ICON = { pass: CircleCheck, warn: TriangleAlert, fail: CircleX, skip: Minus } as const;
const CHECK_TONE = { pass: "text-emerald-700", warn: "text-amber-700", fail: "text-red-700", skip: "text-slate-500" } as const;
const CHECK_WORD = { pass: "Lolos", warn: "Cek", fail: "Gagal", skip: "Dilewati" } as const;

/** Admin-only QA banner: one line, expands (native <details>, keyboard-friendly) to every check. */
function DataQualityBanner({ checks }: { checks: DataCheck[] }) {
  const s = summarizeChecks(checks);
  if (s.level === "none") return null;
  const tone = {
    fail: "border-red-200 bg-red-50 text-red-800",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    pass: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }[s.level];
  const Icon = CHECK_ICON[s.level];
  const title =
    s.level === "fail"
      ? `Cek data: ${s.fail} gagal${s.warn ? `, ${s.warn} peringatan` : ""}`
      : s.level === "warn"
        ? `Cek data: ${s.warn} peringatan`
        : `Cek data: ${s.pass} lolos`;
  const sub =
    s.level === "fail"
      ? "Periksa sebelum laporan dibagikan ke klien."
      : s.level === "warn"
        ? "Angka tetap tampil — baca dengan catatan."
        : s.skip
          ? `${s.skip} cek dilewati (data tidak tersedia).`
          : "Semua cek lolos.";
  return (
    <details className={`group rounded-xl border ${tone}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span>{title}</span>
        <span className="hidden text-xs font-normal opacity-80 sm:inline">· {sub}</span>
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="space-y-2 border-t border-slate-200 bg-white/80 px-3 py-2.5 text-xs text-slate-700">
        {checks.map((c) => {
          const CIcon = CHECK_ICON[c.status];
          return (
            <li key={c.id} className="flex items-start gap-2">
              <CIcon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${CHECK_TONE[c.status]}`} aria-hidden />
              <span>
                <b className="font-semibold text-slate-800">{c.label}</b> <ScopeChip scope={c.scope} />{" "}
                <span className={`font-semibold ${CHECK_TONE[c.status]}`}>{CHECK_WORD[c.status]}</span>
                <br />
                <span className="text-slate-500">{c.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

const NOTE_STYLE = {
  good: { Icon: CircleCheck, tone: "text-emerald-700" },
  info: { Icon: Lightbulb, tone: "text-sky-600" },
  warn: { Icon: TriangleAlert, tone: "text-amber-600" },
} as const;

/** Plain-language reasons behind the numbers — fixed rules, not AI. */
function AutoNotes({ notes }: { notes: AutoNote[] }) {
  if (!notes.length) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <SectionTitle>Catatan Otomatis</SectionTitle>
      <ul className="space-y-3">
        {notes.map((n) => {
          const { Icon, tone } = NOTE_STYLE[n.tone];
          return (
            <li key={n.id} className="flex items-start gap-2.5 text-sm text-slate-700">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} aria-hidden />
              <span>{n.text}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-slate-500">
        Dibuat otomatis dari aturan tetap (bukan AI): angka yang sama selalu menghasilkan kalimat yang sama.
      </p>
    </div>
  );
}

type Slide = { id: string; title: string; node: React.ReactNode };

/** Mobile Typeform-style swipe deck: one section per full-height card, swipe L/R. */
function MobileDeck({ slides, brandColor }: { slides: Slide[]; brandColor: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const go = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, Math.min(slides.length - 1, i));
    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = ref.current;
    if (el) setActive(Math.round(el.scrollLeft / el.clientWidth));
  };
  return (
    <div className="select-none">
      <style>{`.sc-deck::-webkit-scrollbar{display:none}`}</style>
      <div className="mb-2 flex items-center justify-between px-1">
        {/* native picker: a real jump-to-section control with a full-size tap target (the 6px dots were not one) */}
        <label className="relative flex items-center text-sm font-bold text-[#1B2A4A]">
          <span className="sr-only">Pindah ke section</span>
          <select
            value={active}
            onChange={(e) => go(Number(e.target.value))}
            className="max-w-[60vw] cursor-pointer appearance-none truncate rounded bg-transparent py-1 pr-6 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {slides.map((s, i) => (
              <option key={s.id} value={i}>
                {s.title}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-0 h-4 w-4 text-slate-500" aria-hidden />
        </label>
        <span className="text-xs font-medium text-slate-600">
          {active + 1} / {slides.length}
        </span>
      </div>
      <div
        ref={ref}
        onScroll={onScroll}
        className="sc-deck flex h-[74vh] snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth"
        style={{ scrollbarWidth: "none" }}
      >
        {slides.map((s) => (
          <section key={s.id} className="flex h-full w-full shrink-0 snap-center snap-always flex-col">
            <div className="flex-1 overflow-y-auto px-0.5 pb-2">{s.node}</div>
          </section>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => go(active - 1)}
          disabled={active === 0}
          aria-label="Sebelumnya"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-40"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        {/* progress only — jumping between sections is the picker above */}
        <div aria-hidden className="pointer-events-none flex flex-1 flex-wrap items-center justify-center gap-1.5">
          {slides.map((s, i) => (
            <span
              key={s.id}
              className="h-1.5 rounded-full transition-all"
              style={{ width: i === active ? 18 : 6, backgroundColor: i === active ? brandColor : "#CBD5E1" }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(active + 1)}
          disabled={active === slides.length - 1}
          aria-label="Berikutnya"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-40"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-600">Geser kiri / kanan untuk pindah section</p>
    </div>
  );
}

export function ReportDashboard({
  metrics,
  brandColor = "#2A2870",
  accentColor = "#38B6F0",
  showReason = false,
  showChecks = false,
}: {
  metrics: ReportMetrics;
  brandColor?: string;
  accentColor?: string;
  showReason?: boolean;
  /** Admin-only data-quality banner — never pass on the client-facing page. */
  showChecks?: boolean;
}) {
  if (!metrics.connected) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
        <p className="font-semibold text-slate-700">Belum ada data laporan</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
          Data ditarik dari Zernio setelah akun terhubung dan laporan digenerate.
        </p>
        {showReason && metrics.reason && (
          <p className="mx-auto mt-3 max-w-md rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{metrics.reason}</p>
        )}
      </div>
    );
  }

  const t = metrics.totals;
  const posts = metrics.posts ?? [];
  const disc = metrics.discovery;
  const discTotal = (disc?.followers ?? 0) + (disc?.nonFollowers ?? 0);
  const ct = (metrics.byContentType ?? []).filter((c) => (c.reach ?? 0) > 0);
  const ctMax = Math.max(1, ...ct.map((c) => c.reach ?? 0));
  const series = metrics.reachSeries ?? [];
  const sMax = Math.max(1, ...series.map((s) => s.value));

  // ---- CMO efficiency + funnel + advanced metrics (shared with the Excel) ----
  const followersBase = metrics.account?.followers ?? null;
  const eff = efficiency(t, followersBase, posts);
  const postImpressions = postTotal(posts, (p) => p.impressions); // post scope — never shown as an account total
  const deltas = computeDeltas(t, metrics.comparison);
  const cmp = metrics.comparison;
  const prevRate = (n?: number | null, d?: number | null) => (cmp && n != null && d != null && d > 0 ? n / d : null);
  const savesRateDelta = pctChange(eff.savesRate, prevRate(cmp?.saved, cmp?.reach));
  const sharesRateDelta = pctChange(eff.sharesRate, prevRate(cmp?.shares, cmp?.reach));
  const qScore = qualityScore(posts);
  const bestTime = bestDayTime(posts);
  const reels = reelRows(posts);
  const avgWatch = (() => {
    const v = reels.map((r) => r.avgWatchSec).filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  })();
  const checks = showChecks ? runChecks(metrics) : [];
  const notes = autoNotes(metrics);
  const legendScopes: Scope[] = metrics.platform === "tiktok" ? ["P"] : ["A", "P"];
  const movers = topMovers(posts);
  const genderOverlap = overlapRows(metrics.demographics?.genders, metrics.engagedDemographics?.genders);
  const ageOverlap = overlapRows(metrics.demographics?.ages, metrics.engagedDemographics?.ages);
  const netGrowth =
    metrics.followersGained != null || metrics.followersLost != null
      ? (metrics.followersGained ?? 0) - (metrics.followersLost ?? 0)
      : null;
  const growthRate = netGrowth != null && followersBase ? netGrowth / followersBase : null;

  const pillarRoll = (() => {
    const m = new Map<string, { count: number; reach: number; ti: number }>();
    for (const p of posts) {
      if (!p.pillar) continue;
      const e = m.get(p.pillar) ?? { count: 0, reach: 0, ti: 0 };
      e.count += 1;
      e.reach += p.reach ?? 0;
      e.ti += totalActions(p);
      m.set(p.pillar, e);
    }
    return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.reach - a.reach);
  })();
  const pillarMaxReach = Math.max(1, ...pillarRoll.map((p) => p.reach));

  const sortedPosts = [...posts].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const monthGroups = (() => {
    const m = new Map<string, PostMetric[]>();
    for (const p of sortedPosts) {
      const k = (p.date || "").slice(0, 7) || "—";
      (m.get(k) ?? m.set(k, []).get(k)!).push(p);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  })();
  // null (→ "—") when no post has the field, never a fake 0
  const sumBy = (arr: PostMetric[], f: (p: PostMetric) => number | null | undefined) => postTotal(arr, f).total;

  const hasDemo =
    !!metrics.demographics &&
    ((metrics.demographics.ages?.length ?? 0) > 0 ||
      (metrics.demographics.cities?.length ?? 0) > 0 ||
      (metrics.demographics.genders?.length ?? 0) > 0);
  const hasEngDemo =
    !!metrics.engagedDemographics &&
    ((metrics.engagedDemographics.ages?.length ?? 0) > 0 ||
      (metrics.engagedDemographics.cities?.length ?? 0) > 0 ||
      (metrics.engagedDemographics.genders?.length ?? 0) > 0);

  // ------------------------------- build slides -----------------------------
  const slides: Slide[] = [];

  slides.push({
    id: "ringkasan",
    title: "Ringkasan",
    node: (
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-slate-600">
              {metrics.platform ? <span className="font-semibold capitalize">{metrics.platform}</span> : "Akun"} ·{" "}
              {metrics.account?.username ? `@${metrics.account.username}` : "terhubung"} · {metrics.period ?? "periode"}
            </p>
            <p className="text-lg font-bold" style={{ color: readableOnWhite(brandColor) }}>
              {fmt(metrics.account?.followers)} followers
            </p>
          </div>
          {metrics.fetchedAt && (
            <p className="text-xs text-slate-600">Data ditarik: {new Date(metrics.fetchedAt).toLocaleString("id-ID")}</p>
          )}
        </div>
        <DataQualityBanner checks={checks} />
        <GroupLabel>Jangkauan &amp; volume</GroupLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile hero className="col-span-2" label="Reach" value={fmt(t?.reach)} accent={brandColor} info="reach" delta={deltas?.reach} />
          <Tile label="Impressions (post)" value={fmt(postImpressions.total)} hint={postImpressions.n ? `dari ${postImpressions.n} post` : undefined} info="impressions" />
          <Tile label="Jumlah Post" value={fmt(t?.posts)} info="posts" />
        </div>
        <GroupLabel>Interaksi</GroupLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
          <Tile label="Total Interaksi" value={fmt(t?.totalInteractions)} accent={accentColor} info="totalInteractions" delta={deltas?.totalInteractions} />
          <Tile label="ER (Reach)" value={pct(t?.erReach)} info="erReach" delta={deltas?.erReach} />
          <Tile label="Accounts Engaged" value={fmt(t?.accountsEngaged)} info="accountsEngaged" />
          <Tile label="Likes" value={fmt(t?.likes)} info="likes" delta={deltas?.likes} />
          <Tile label="Komentar" value={fmt(t?.comments)} info="comments" delta={deltas?.comments} />
          <Tile label="Shares" value={fmt(t?.shares)} info="shares" delta={deltas?.shares} />
          <Tile label="Saved" value={fmt(t?.saved)} info="saved" delta={deltas?.saved} />
        </div>
        <GroupLabel>Konversi</GroupLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Follows" value={fmt(t?.follows)} info="follows" />
          <Tile label="Web Clicks" value={fmt(t?.webClicks)} info="webClicks" />
        </div>
        <p className="text-[11px] leading-relaxed text-slate-600">
          <b className="font-semibold text-slate-700">Cakupan angka:</b>{" "}
          {legendScopes.map((s, i) => (
            <span key={s}>
              {i > 0 && " · "}
              <b className="font-semibold text-slate-700">{SCOPE_INFO[s].label}</b> = {SCOPE_LEGEND[s]}
            </span>
          ))}
          . Angka beda cakupan tidak untuk dibandingkan langsung.
        </p>
      </div>
    ),
  });

  slides.push({
    id: "efisiensi",
    title: "Efisiensi & Kualitas",
    node: (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="mb-3 text-sm font-semibold text-slate-700">Efisiensi, Funnel & Kualitas</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Tile label="Reach Rate" value={times(eff.reachRate)} accent={brandColor} hint="reach ÷ followers" info="reachRate" />
          <Tile label="ER (Reach)" value={pct1(eff.erReach)} hint="interaksi ÷ reach" info="erReach" delta={deltas?.erReach} />
          <Tile label="Content Quality Score" value={qScore != null ? qScore.toFixed(1) : "—"} accent={accentColor} hint="engagement berbobot / 1k reach" info="qualityScore" />
          <Tile label="Saves Rate" value={pct1(eff.savesRate)} hint="saved ÷ reach · sinyal simpan" info="savesRate" delta={savesRateDelta} />
          <Tile label="Shares Rate" value={pct1(eff.sharesRate)} hint="shares ÷ reach · viralitas" info="sharesRate" delta={sharesRateDelta} />
          <Tile label="Profile Visit Rate" value={pct1(eff.pvRate)} hint="Σ profil ÷ Σ reach post" info="pvRate" />
          <Tile label="Follow Rate" value={pct1(eff.followRate)} hint="follows ÷ reach" info="followRate" />
          <Tile
            label="Net Follower Growth"
            value={netGrowth != null ? (netGrowth >= 0 ? "+" : "") + fmt(netGrowth) : "—"}
            accent={netGrowth != null && netGrowth < 0 ? "#DC2626" : brandColor}
            hint={growthRate != null ? `${pct1(growthRate)} dari basis` : "gained − lost"}
            info="netGrowth"
          />
          <Tile label="Avg Reach / Post" value={fmt(eff.avgReach != null ? Math.round(eff.avgReach) : null)} hint={eff.reachPosts ? `rata-rata dari ${eff.reachPosts} post` : "rata-rata jangkauan"} info="avgReach" />
        </div>
      </div>
    ),
  });

  if (deltas) {
    slides.push({
      id: "perbandingan",
      title: "vs Periode Lalu",
      node: (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <SectionTitle info="comparison">Perbandingan vs Periode Sebelumnya</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {(
              [
                ["Reach", deltas.reach],
                ["Total Interaksi", deltas.totalInteractions],
                ["ER", deltas.erReach],
                ["Likes", deltas.likes],
                ["Komentar", deltas.comments],
                ["Saved", deltas.saved],
                ["Shares", deltas.shares],
              ] as [string, number | null][]
            ).map(([label, d]) => (
              <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-center">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
                <div className="mt-1.5 flex justify-center">
                  {d != null ? <DeltaBadge d={d} /> : <span className="text-xs text-slate-500">—</span>}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Dibandingkan dengan periode sepanjang yang sama tepat sebelum rentang tanggal ini.</p>
        </div>
      ),
    });
  }

  if (notes.length > 0) {
    slides.push({ id: "catatan", title: "Catatan", node: <AutoNotes notes={notes} /> });
  }

  if (movers && (movers.up.length > 0 || movers.down.length > 0)) {
    slides.push({
      id: "movers",
      title: "Pendorong & Penyeret",
      node: (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <SectionTitle info="movers">Post Pendorong &amp; Penyeret</SectionTitle>
          <div className="grid gap-5 sm:grid-cols-2">
            <MoverList title="Pendorong (Naik)" tone="up" rows={movers.up} accent="#15803D" />
            <MoverList title="Penyeret (Turun)" tone="down" rows={movers.down} accent="#DC2626" />
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Rata-rata reach periode: <b>{fmt(Math.round(movers.avgReach))}</b>. Pendorong = jauh di atas rata-rata; penyeret = di bawahnya.
          </p>
        </div>
      ),
    });
  }

  if (bestTime) {
    slides.push({
      id: "waktu",
      title: "Waktu Terbaik",
      node: (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <SectionTitle info="bestTime">Waktu Terbaik Posting (WIB)</SectionTitle>
          <ScopeBox scope="P" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Hari Terbaik" value={bestTime.day} accent={brandColor} hint={`avg reach ${fmt(bestTime.dayAvgReach)}`} />
            <Tile label="Jam Terbaik" value={`${String(bestTime.hour).padStart(2, "0")}:00`} accent={accentColor} hint={`avg reach ${fmt(bestTime.hourAvgReach)}`} />
          </ScopeBox>
          <p className="mt-2 text-[11px] text-slate-500">Berdasarkan rata-rata reach per hari/jam dari post di periode ini.</p>
        </div>
      ),
    });
  }

  if (pillarRoll.length > 0) {
    slides.push({
      id: "pillar",
      title: "Per Pillar",
      node: (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <SectionTitle info="pillar">Performa per Pillar Konten</SectionTitle>
          <div className="space-y-2.5">
            {pillarRoll.map((p) => (
              <div key={p.name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-slate-600">
                    {p.name} <span className="text-slate-500">· {p.count} post</span>
                  </span>
                  <span className="text-slate-500">
                    {fmt(p.reach)} reach · {fmt(p.ti)} actions
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${(p.reach / pillarMaxReach) * 100}%`, backgroundColor: brandColor }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Pillar disarankan AI (Claude) — regenerate laporan untuk mengisinya.</p>
        </div>
      ),
    });
  }

  if (metrics.aiAnalysis && metrics.aiAnalysis.length > 0) {
    slides.push({
      id: "ai",
      title: "Analisa AI",
      node: (
        <div className="rounded-2xl border border-[#2A2870]/25 bg-gradient-to-br from-[#2A2870]/[0.06] to-white p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#2A2870]">
            <Sparkles className="h-4 w-4" /> Analisa AI (Claude Opus)
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {metrics.aiAnalysis.map((a, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-[#1B2A4A]">
                  {a.label}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] capitalize text-slate-500">{a.type}</span>
                </p>
                <p className="whitespace-pre-line text-sm text-slate-600">{a.text}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  if ((disc && discTotal > 0) || ct.length > 0) {
    slides.push({
      id: "jangkauan",
      title: "Jangkauan & Format",
      node: (
        <div className="grid gap-4 lg:grid-cols-2">
          {disc && discTotal > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <SectionTitle info="discovery">Jangkauan: Followers vs Non-followers</SectionTitle>
              <div className="flex h-4 gap-0.5 overflow-hidden rounded-full">
                <div style={{ width: `${((disc.followers ?? 0) / discTotal) * 100}%`, backgroundColor: brandColor }} />
                <div style={{ width: `${((disc.nonFollowers ?? 0) / discTotal) * 100}%`, backgroundColor: accentColor }} />
              </div>
              <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: brandColor }} /> Followers{" "}
                  <b>{fmt(disc.followers)}</b> ({Math.round(((disc.followers ?? 0) / discTotal) * 100)}%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accentColor }} /> Non-followers{" "}
                  <b>{fmt(disc.nonFollowers)}</b> ({Math.round(((disc.nonFollowers ?? 0) / discTotal) * 100)}%)
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Porsi non-followers tinggi = konten Anda banyak ditemukan lewat discovery/explore.
              </p>
            </div>
          )}
          {ct.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <SectionTitle info="contentType">Reach per Jenis Konten</SectionTitle>
              <div className="space-y-2.5">
                {ct
                  .slice()
                  .sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))
                  .map((c) => (
                    <div key={c.type}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-medium text-slate-600">{CT_LABEL[c.type] ?? c.type}</span>
                        <span className="text-slate-500">
                          {fmt(c.reach)} reach{c.interactions != null ? ` · ${fmt(c.interactions)} interaksi` : ""}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${((c.reach ?? 0) / ctMax) * 100}%`, backgroundColor: brandColor }} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      ),
    });
  }

  if (metrics.followerSeries?.length || metrics.followersGained != null) {
    slides.push({
      id: "follower",
      title: "Pertumbuhan Follower",
      node: (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              Pertumbuhan Follower
              <InfoDot id="followerGrowth" />
            </p>
            <div className="flex gap-4 text-sm">
              {metrics.followersGained != null && <span className="text-emerald-700">+{fmt(metrics.followersGained)} gained</span>}
              {metrics.followersLost != null && <span className="text-red-600">−{fmt(metrics.followersLost)} lost</span>}
              {metrics.account?.followers != null && (
                <span className="font-semibold" style={{ color: readableOnWhite(brandColor) }}>
                  {fmt(metrics.account.followers)} total
                </span>
              )}
            </div>
          </div>
          {metrics.followerSeries && metrics.followerSeries.length > 1 && (
            <FollowerLine series={metrics.followerSeries} color={brandColor} />
          )}
        </div>
      ),
    });
  }

  if (hasDemo) {
    slides.push({
      id: "demografi",
      title: "Audiens (Followers)",
      node: (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-4 text-sm font-semibold text-slate-700">Audiens (Followers)</p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <BarList title="Umur" items={metrics.demographics!.ages} color={brandColor} />
            <BarList title="Gender" items={metrics.demographics!.genders} color={accentColor} />
            <BarList title="Kota" items={metrics.demographics!.cities} color={brandColor} />
            <BarList title="Negara" items={metrics.demographics!.countries} color={accentColor} />
          </div>
        </div>
      ),
    });
  }

  if ((metrics.reels && metrics.reels.count > 0) || reels.length > 0) {
    slides.push({
      id: "reels",
      title: "Reels & Retensi",
      node: (
        <div className="space-y-4">
          {metrics.reels && metrics.reels.count > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <SectionTitle info="completion">Performa Reels / Video</SectionTitle>
              <ScopeBox scope="P" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Tile label="Jumlah Video" value={fmt(metrics.reels.count)} />
                <Tile label="Total Views" value={fmt(metrics.reels.totalViews)} accent={accentColor} />
                <Tile label="Avg Watch Time" value={avgWatch != null ? `${avgWatch.toFixed(1)} dtk` : "—"} />
                <Tile label="Completion Rate" value={pct(metrics.reels.avgCompletion)} accent={brandColor} />
              </ScopeBox>
            </div>
          )}
          {reels.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white">
              <p className="flex items-center gap-1.5 px-4 pt-4 text-sm font-semibold text-slate-700">
                Retensi Reels per Video
                <InfoDot id="viewRate" />
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[720px] text-xs">
                  <thead>
                    <tr className="border-y border-slate-100 text-left uppercase tracking-wide text-slate-500">
                      <th className="p-2.5">Tanggal</th>
                      <th className="p-2.5">Konten</th>
                      <th className="p-2.5 text-right">Views</th>
                      <th className="p-2.5 text-right">Reach</th>
                      <th className="p-2.5 text-right">View Rate</th>
                      <th className="p-2.5 text-right">Avg Watch</th>
                      <th className="p-2.5 text-right">Completion</th>
                      <th className="p-2.5 text-right">Skip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reels.map((v, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0">
                        <td className="whitespace-nowrap p-2.5 text-slate-500">{v.date}</td>
                        <td className="max-w-[240px] p-2.5 text-slate-700">
                          <span className="line-clamp-1">{v.caption || "—"}</span>
                        </td>
                        <td className="p-2.5 text-right font-medium">{fmt(v.views)}</td>
                        <td className="p-2.5 text-right">{fmt(v.reach)}</td>
                        <td className="p-2.5 text-right text-slate-500">{v.viewRate != null ? times(v.viewRate) : "—"}</td>
                        <td className="p-2.5 text-right">{v.avgWatchSec != null ? `${v.avgWatchSec.toFixed(1)} dtk` : "—"}</td>
                        <td className="p-2.5 text-right">{pct1(v.completion)}</td>
                        <td className="p-2.5 text-right text-slate-500">{pct1(v.skip)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-4 pb-3 pt-2 text-[11px] text-slate-500">
                View Rate = views ÷ reach (daya tarik hook). Completion tinggi + Skip rendah = retensi kuat.
              </p>
            </div>
          )}
        </div>
      ),
    });
  }

  if (metrics.stories && metrics.stories.count > 0) {
    slides.push({
      id: "stories",
      title: "Stories",
      node: (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-slate-700">Instagram Stories ({metrics.stories.count})</p>
          <ScopeBox scope="S" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <Tile label="Views" value={fmt(metrics.stories.views)} accent={brandColor} />
            <Tile label="Reach" value={fmt(metrics.stories.reach)} />
            <Tile label="Replies" value={fmt(metrics.stories.replies)} />
            <Tile label="Taps Fwd" value={fmt(metrics.stories.tapsForward)} />
            <Tile label="Taps Back" value={fmt(metrics.stories.tapsBack)} />
            <Tile label="Exits" value={fmt(metrics.stories.exits)} />
            <Tile label="Profile Visits" value={fmt(metrics.stories.profileVisits)} />
            <Tile label="Follows" value={fmt(metrics.stories.follows)} />
          </ScopeBox>
        </div>
      ),
    });
  }

  if (hasEngDemo) {
    slides.push({
      id: "engaged",
      title: "Audiens Interaksi",
      node: (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-4 text-sm font-semibold text-slate-700">Audiens yang Berinteraksi</p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <BarList title="Umur" items={metrics.engagedDemographics!.ages} color={brandColor} />
            <BarList title="Gender" items={metrics.engagedDemographics!.genders} color={accentColor} />
            <BarList title="Kota" items={metrics.engagedDemographics!.cities} color={brandColor} />
            <BarList title="Negara" items={metrics.engagedDemographics!.countries} color={accentColor} />
          </div>
        </div>
      ),
    });
  }

  if (genderOverlap.length > 0 || ageOverlap.length > 0) {
    slides.push({
      id: "overlap",
      title: "Overlap Audiens",
      node: (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            Overlap Audiens: Followers vs yang Berinteraksi
            <InfoDot id="overlap" />
          </p>
          <p className="mb-4 text-[11px] text-slate-500">
            Gap positif = segmen itu <b>lebih aktif</b> berinteraksi dibanding porsinya di followers.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <OverlapTable title="Umur" rows={ageOverlap} brandColor={brandColor} accentColor={accentColor} />
            <OverlapTable title="Gender" rows={genderOverlap} brandColor={brandColor} accentColor={accentColor} />
          </div>
        </div>
      ),
    });
  }

  if (metrics.contactButtons && metrics.contactButtons.length > 0) {
    slides.push({
      id: "kontak",
      title: "Tombol Kontak",
      node: (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-slate-700">Tap Tombol Kontak (Profil)</p>
          <div className="flex flex-wrap gap-2">
            {metrics.contactButtons.map((c) => (
              <span key={c.type} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                {c.type}: <b>{fmt(c.value)}</b>
              </span>
            ))}
          </div>
        </div>
      ),
    });
  }

  if (series.length > 1) {
    slides.push({
      id: "tren",
      title: "Tren Reach",
      node: (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-slate-700">Tren Reach Harian</p>
          <div className="flex h-24 items-end gap-[3px]">
            {series.map((s, i) => (
              <div
                key={i}
                title={`${s.date}: ${fmt(s.value)}`}
                className="flex-1 rounded-t"
                style={{ height: `${Math.max(2, (s.value / sMax) * 100)}%`, backgroundColor: accentColor }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
            <span>{series[0]?.date}</span>
            <span>{series[series.length - 1]?.date}</span>
          </div>
        </div>
      ),
    });
  }

  if (posts.length > 0) {
    slides.push({
      id: "postmaster",
      title: "Post Master",
      node: (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between px-4 pt-4">
            <p className="text-sm font-semibold text-slate-700">Post Master — detail per post</p>
            <span className="text-[11px] text-slate-500">sama seperti Excel · {posts.length} post</span>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[1180px] text-xs">
              <thead>
                <tr className="border-y border-slate-100 text-left uppercase tracking-wide text-slate-500">
                  <th className="sticky left-0 z-10 border-r border-slate-100 bg-white p-2.5">Tanggal</th>
                  <th className="p-2.5">Pillar</th>
                  <th className="p-2.5">Konten</th>
                  <th className="p-2.5 text-right">Followers</th>
                  <th className="p-2.5 text-right">Likes</th>
                  <th className="p-2.5 text-right">Komen</th>
                  <th className="p-2.5 text-right">ER</th>
                  <th className="p-2.5 text-right">Follows</th>
                  <th className="p-2.5 text-right">Profil</th>
                  <th className="p-2.5 text-right">Shared</th>
                  <th className="p-2.5 text-right">Saved</th>
                  <th className="p-2.5 text-right">Web Clk</th>
                  <th className="p-2.5 text-right">Impr.</th>
                  <th className="p-2.5 text-right">Reach</th>
                  <th className="p-2.5 text-right">Reach ER</th>
                  <th className="p-2.5 text-right">Total Actions</th>
                </tr>
              </thead>
              <tbody>
                {monthGroups.map(([ym, mp]) => (
                  <MonthRows key={ym} ym={ym} posts={mp} followersBase={followersBase} sumBy={sumBy} multi={monthGroups.length > 1} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 pb-3 pt-2 text-[11px] text-slate-500">
            “—” = data tidak tersedia dari Zernio (bukan 0). Total Actions = like + komentar + follows + profil + shared + saved + web click.
          </p>
        </div>
      ),
    });
  }

  return (
    <PlatformCtx.Provider value={metrics.platform}>
      {/* Desktop: stacked sections */}
      <div className="hidden space-y-5 sm:block">
        {slides.map((s) => (
          <div key={s.id}>{s.node}</div>
        ))}
      </div>
      {/* Mobile: Typeform-style swipe deck */}
      <div className="sm:hidden">
        <MobileDeck slides={slides} brandColor={brandColor} />
      </div>
    </PlatformCtx.Provider>
  );
}

/** One month's post rows + a bold month-total row (mirrors the Excel per-month total). */
function MonthRows({
  ym,
  posts,
  followersBase,
  sumBy,
  multi,
}: {
  ym: string;
  posts: PostMetric[];
  followersBase: number | null;
  sumBy: (arr: PostMetric[], f: (p: PostMetric) => number | null | undefined) => number | null;
  multi: boolean;
}) {
  return (
    <>
      {multi && (
        <tr className="bg-slate-50/70">
          <td colSpan={16} className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {monthLabel(ym)}
          </td>
        </tr>
      )}
      {posts.map((p, i) => {
        const ti = totalActions(p);
        const has = postHasData(p); // a post with no insights yet shows "—", not 0 actions / 0% ER
        const followers = p.followersAtPeriod ?? followersBase;
        return (
          <tr key={i} className="border-b border-slate-50 last:border-0">
            <td className="sticky left-0 z-10 whitespace-nowrap border-r border-slate-100 bg-white p-2.5 text-slate-500">{p.date}</td>
            <td className="whitespace-nowrap p-2.5 text-slate-600">{p.pillar ?? "—"}</td>
            <td className="max-w-[220px] p-2.5 text-slate-700">
              <span className="line-clamp-2">{p.caption || "—"}</span>
            </td>
            <td className="p-2.5 text-right text-slate-500">{fmt(followers)}</td>
            <td className="p-2.5 text-right">{fmt(p.likes)}</td>
            <td className="p-2.5 text-right">{fmt(p.comments)}</td>
            <td className="p-2.5 text-right text-slate-500">{followers && has ? pct1(ti / followers) : "—"}</td>
            <td className="p-2.5 text-right">{fmt(p.follows)}</td>
            <td className="p-2.5 text-right">{fmt(p.profileVisits)}</td>
            <td className="p-2.5 text-right">{fmt(p.shares)}</td>
            <td className="p-2.5 text-right">{fmt(p.saved)}</td>
            <td className="p-2.5 text-right">{fmt(p.webClicks)}</td>
            <td className="p-2.5 text-right">{fmt(p.impressions)}</td>
            <td className="p-2.5 text-right font-medium">{fmt(p.reach)}</td>
            <td className="p-2.5 text-right text-slate-500">{p.reach ? pct1(ti / p.reach) : "—"}</td>
            <td className="p-2.5 text-right font-semibold">{has ? fmt(ti) : "—"}</td>
          </tr>
        );
      })}
      <tr className="border-b border-slate-100 bg-amber-50/50 font-semibold text-slate-700">
        <td className="p-2.5" colSpan={3}>
          {multi ? `${monthLabel(ym)} — Total` : "Total"}
        </td>
        <td className="p-2.5"></td>
        <td className="p-2.5 text-right">{fmt(sumBy(posts, (p) => p.likes))}</td>
        <td className="p-2.5 text-right">{fmt(sumBy(posts, (p) => p.comments))}</td>
        <td className="p-2.5"></td>
        <td className="p-2.5 text-right">{fmt(sumBy(posts, (p) => p.follows))}</td>
        <td className="p-2.5 text-right">{fmt(sumBy(posts, (p) => p.profileVisits))}</td>
        <td className="p-2.5 text-right">{fmt(sumBy(posts, (p) => p.shares))}</td>
        <td className="p-2.5 text-right">{fmt(sumBy(posts, (p) => p.saved))}</td>
        <td className="p-2.5 text-right">{fmt(sumBy(posts, (p) => p.webClicks))}</td>
        <td className="p-2.5 text-right">{fmt(sumBy(posts, (p) => p.impressions))}</td>
        <td className="p-2.5 text-right">{fmt(sumBy(posts, (p) => p.reach))}</td>
        <td className="p-2.5"></td>
        <td className="p-2.5 text-right">{fmt(sumBy(posts, (p) => (postHasData(p) ? totalActions(p) : null)))}</td>
      </tr>
    </>
  );
}
