"use client";

// The report dashboard, in the brand design system (BRAND.md v2.0): Paper surfaces, white cards (radius 28, raised),
// Paper tiles for the numbers, Ink for text and for the data, Scale Orange only where it means "this one thing" (a
// progress fill, the one highlighted series, the active step). Title for the big numbers, Mono for the technical ones.
// Nothing here is a literal: colours, type sizes, radii, shadows and spacing are the tokens of app/globals.css, and a
// bar's width is the only inline style (it is the data).

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
import { cn } from "@/lib/utils";
import { Alert, Bar, Card, Chip, Dot, EmptyState, IconBtn } from "@/components/brand/primitives";
import { capsCls, motion, tileCls } from "@/components/brand/styles";

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

/** A rem token of the stylesheet (--spacing, --container-*) in pixels, so layout maths in JS reads app/globals.css instead of repeating its numbers. */
function tokenPx(el: Element, name: string): number {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return 0;
  return v.endsWith("rem") ? n * parseFloat(getComputedStyle(document.documentElement).fontSize) : n;
}

/** Δ badge for period-over-period change (fraction, e.g. 0.23 → +23%). The arrow and the sign carry the direction; colour only reinforces it. */
function DeltaBadge({ d }: { d: number | null }) {
  if (d == null) return null;
  const up = d >= 0;
  const Icon = d === 0 ? Minus : up ? TrendingUp : TrendingDown;
  const tone = d === 0 ? "bg-paper-0 text-ink-500" : up ? "bg-success-bg text-success-ink" : "bg-danger-bg text-ink-800 [&>svg]:text-danger";
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 font-mono text-micro font-medium leading-none", tone)}>
      <Icon className="size-3" aria-hidden />
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
    const el = btn.current;
    const r = el?.getBoundingClientRect();
    if (!el || !r) return;
    const visible = r.bottom >= 0 && r.top <= window.innerHeight;
    if (visible) seenVisible.current = true;
    else if (closeIfGone && seenVisible.current) return setPos(null);
    const step = tokenPx(el, "--spacing") * 2; // the viewport gutter and the gap under the icon: two steps of the 4px grid
    const width = tokenPx(el, "--container-popover") || el.offsetWidth;
    const left = Math.min(Math.max(step, r.left + r.width / 2 - width / 2), window.innerWidth - width - step);
    setPos({ top: r.bottom + step, left });
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
        className={cn("hit-44 -m-1 rounded-full p-1 text-ink-500 hover:text-ink-800 focus-visible:text-ink-800", motion)}
      >
        <Info className="size-3" aria-hidden />
      </button>
      {pos && (
        <span
          role="tooltip"
          style={{ position: "fixed", top: pos.top, left: pos.left }}
          className="pointer-events-none z-50 w-popover whitespace-normal rounded-field border border-hairline bg-paper-0 p-4 text-left font-text text-caption font-normal normal-case tracking-normal text-ink-500 shadow-menu"
        >
          <b className="font-semibold text-ink-800">{m.label}</b>
          <span className="mt-1 block">{m.desc}</span>
          {sc && (
            <span className="mt-2 block">
              <b className="font-semibold text-ink-800">Cakupan:</b> {SCOPE_INFO[sc].label} — {SCOPE_INFO[sc].desc}
            </span>
          )}
          {m.rumus && (
            <span className="mt-2 block">
              <b className="font-semibold text-ink-800">Rumus:</b>{" "}
              <code className="rounded-nav bg-paper-100 px-1 font-mono text-ink-800">{m.rumus}</code>
            </span>
          )}
          {m.benchmark && (
            <span className="mt-2 block">
              <b className="font-semibold text-success-ink">Patokan bagus:</b> {m.benchmark}
            </span>
          )}
          {m.relation && <span className="mt-2 block">↔ {m.relation}</span>}
        </span>
      )}
    </span>
  );
}

/** Section heading with an optional info tooltip. */
function SectionTitle({ children, info }: { children: React.ReactNode; info?: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 font-title text-h3 text-ink-800">
      {children}
      {info && <InfoDot id={info} />}
    </h2>
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
      className="inline-flex h-5 items-center rounded-full border border-ink-100 bg-paper-0 px-2 font-mono text-micro font-medium uppercase leading-none text-ink-500"
    >
      {s.label}
    </span>
  );
}

/** Mono caps label that names a group of tiles. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className={cn(capsCls, "mb-3")}>{children}</p>;
}

/** Grid whose tiles default to one scope (e.g. a Stories-only block). */
function ScopeBox({ scope, className, children }: { scope: Scope; className?: string; children: React.ReactNode }) {
  return (
    <ScopeCtx.Provider value={scope}>
      <div className={className}>{children}</div>
    </ScopeCtx.Provider>
  );
}

/** One number: a Paper tile, the label in Mono caps, the value in Title 800, the scope and a hint underneath. */
function Tile({
  label,
  value,
  hint,
  info,
  delta,
  scope,
  hero,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  info?: string;
  delta?: number | null;
  scope?: Scope;
  /** The one lead number of a view: bigger type. */
  hero?: boolean;
  className?: string;
}) {
  const platform = useContext(PlatformCtx);
  const sectionScope = useContext(ScopeCtx);
  const sc = scope ?? (info ? scopeFor(info, platform) : undefined) ?? sectionScope;
  const na = value === "—"; // every formatter returns "—" for "no data"
  return (
    <div className={cn(tileCls, "flex min-w-0 flex-col gap-2", className)}>
      <p className={cn(capsCls, "flex items-center gap-2")}>
        {label}
        {info && <InfoDot id={info} />}
      </p>
      {/* the delta sits beside the number (wrapping under it when narrow) so a long label can never push it out of the tile */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p
          className={cn("font-title font-extrabold", hero ? "text-h2 sm:text-h1" : "text-h3 sm:text-h2", na ? "text-ink-500" : "text-ink-800")}
          title={na ? "Data tidak tersedia dari Zernio (bukan 0)" : undefined}
        >
          {na ? "n/a" : value}
        </p>
        {delta != null && <DeltaBadge d={delta} />}
      </div>
      {(sc || hint) && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-500">
          {sc && <ScopeChip scope={sc} />}
          {hint && <span>{hint}</span>}
        </p>
      )}
    </div>
  );
}

/** Simple SVG line chart of a daily series, drawn in the current text colour. */
function FollowerLine({ series }: { series: { date: string; value: number }[] }) {
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
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-24 w-full" role="img" aria-label="Grafik jumlah follower per hari">
        <polyline points={pts} className="fill-none stroke-ink-800 stroke-2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-2 flex justify-between font-mono text-caption text-ink-500">
        <span>{series[0]?.date}</span>
        <span>{series[series.length - 1]?.date}</span>
      </div>
    </div>
  );
}

/** Horizontal bar list of top demographic values: Ink bars on a Hairline track. */
function BarList({ title, items }: { title: string; items?: { name: string; value: number }[] }) {
  const list = (items ?? []).slice(0, 5);
  const total = list.reduce((a, x) => a + x.value, 0) || 1;
  if (!list.length) return null;
  return (
    <div>
      <p className={cn(capsCls, "mb-3")}>{title}</p>
      <div className="space-y-3">
        {list.map((x) => (
          <div key={x.name}>
            <div className="mb-1 flex justify-between gap-3 text-small text-ink-800">
              <span className="truncate">{x.name}</span>
              <span className="font-mono text-caption text-ink-500">{Math.round((x.value / total) * 100)}%</span>
            </div>
            <Bar value={x.value} max={total} tone="ink" label={`${title}: ${x.name}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Table cells, shared by every data table below: Mono tabular figures, 64px rows, 16px radius, Paper on hover, no rules between rows. */
const th = cn(capsCls, "px-4 py-3 text-left");
const td = cn("h-16 px-4 group-hover:bg-paper-100 first:rounded-l-field last:rounded-r-field", motion);
const num = "text-right font-mono tabular-nums";

/** Follower-share vs engaged-share table with a signed gap. */
function OverlapTable({ title, rows }: { title: string; rows: { name: string; follower: number; engaged: number; gap: number }[] }) {
  const list = rows.slice(0, 6);
  if (!list.length) return null;
  return (
    <div>
      <p className={cn(capsCls, "mb-3")}>{title}</p>
      <table className="w-full border-separate border-spacing-0 text-small">
        <thead>
          <tr>
            <th className={th}>Segmen</th>
            <th className={cn(th, "text-right")}>
              <Dot className="mr-2 inline-block bg-ink-800 align-middle" />
              Followers
            </th>
            <th className={cn(th, "text-right")}>
              <Dot className="mr-2 inline-block bg-brand-500 align-middle" />
              Interaksi
            </th>
            <th className={cn(th, "text-right")}>Gap</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.name} className="group">
              <td className={cn(td, "h-12 text-ink-800")}>{r.name}</td>
              <td className={cn(td, num, "h-12 text-ink-500")}>{(r.follower * 100).toFixed(0)}%</td>
              <td className={cn(td, num, "h-12 text-ink-500")}>{(r.engaged * 100).toFixed(0)}%</td>
              <td className={cn(td, num, "h-12 font-medium", r.gap >= 0 ? "text-success-ink" : "text-danger")}>
                {r.gap >= 0 ? "+" : "−"}
                {Math.abs(r.gap * 100).toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** List of post movers (drivers up / drags down) with an auto-reason. */
function MoverList({ title, tone, rows }: { title: string; tone: "up" | "down"; rows: Mover[] }) {
  const Icon = tone === "up" ? TrendingUp : TrendingDown;
  if (!rows.length) return null;
  return (
    <div>
      <p className={cn(capsCls, "mb-3 flex items-center gap-2", tone === "up" ? "text-success-ink" : "text-danger")}>
        <Icon className="size-4" aria-hidden /> {title}
      </p>
      <div className="space-y-3">
        {rows.map((m, i) => (
          <div key={i} className={cn(tileCls, "space-y-2")}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-caption text-ink-500">
                {m.post.date}
                {m.post.pillar ? ` · ${m.post.pillar}` : ""}
              </p>
              <span className="shrink-0 font-mono text-caption font-medium text-ink-800">
                {fmt(m.reach)} reach · {Math.round(m.shareOfReach * 100)}%
              </span>
            </div>
            <p className="line-clamp-2 text-small text-ink-800">{m.post.caption || "—"}</p>
            <p className="font-mono text-caption text-ink-500">
              ER {m.er != null ? (m.er * 100).toFixed(1) + "%" : "—"} · Total Actions {fmt(m.actions)}
            </p>
            <p className="text-caption text-ink-500">{m.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const CHECK_ICON = { pass: CircleCheck, warn: TriangleAlert, fail: CircleX, skip: Minus } as const;
const CHECK_TONE = { pass: "text-success", warn: "text-ink-800", fail: "text-danger", skip: "text-ink-500" } as const;
const CHECK_WORD = { pass: "Lolos", warn: "Cek", fail: "Gagal", skip: "Dilewati" } as const;
const CHECK_BOX = { fail: "bg-danger-bg", warn: "bg-warning-bg", pass: "bg-success-bg" } as const;
const CHECK_DOT = { fail: "bg-danger", warn: "bg-warning", pass: "bg-success" } as const;

/** Admin-only QA banner (BRAND "Alert": semantic fill, 8px dot, bold title): one line, expands (native <details>, keyboard-friendly) to every check. */
function DataQualityBanner({ checks }: { checks: DataCheck[] }) {
  const s = summarizeChecks(checks);
  if (s.level === "none") return null;
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
    <details className={cn("group rounded-field text-ink-800", CHECK_BOX[s.level])}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-small font-semibold [&::-webkit-details-marker]:hidden">
        <Dot className={CHECK_DOT[s.level]} />
        <span>{title}</span>
        <span className="hidden text-caption font-normal text-ink-500 sm:inline">· {sub}</span>
        <ChevronDown className={cn("ml-auto size-4 shrink-0 group-open:rotate-180", motion)} aria-hidden />
      </summary>
      <ul className="space-y-3 border-t border-ink-100 px-5 py-4 text-caption">
        {checks.map((c) => {
          const CIcon = CHECK_ICON[c.status];
          return (
            <li key={c.id} className="flex items-start gap-3">
              <CIcon className={cn("mt-1 size-4 shrink-0", CHECK_TONE[c.status])} aria-hidden />
              <span>
                <b className="font-semibold">{c.label}</b> {c.scope && <ScopeChip scope={c.scope} />}{" "}
                <span className="font-semibold">{CHECK_WORD[c.status]}</span>
                <br />
                <span className="text-ink-500">{c.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

const NOTE_STYLE = {
  good: { Icon: CircleCheck, tone: "text-success" },
  info: { Icon: Lightbulb, tone: "text-info" },
  warn: { Icon: TriangleAlert, tone: "text-warning" },
} as const;

/** Plain-language reasons behind the numbers — fixed rules, not AI. */
function AutoNotes({ notes }: { notes: AutoNote[] }) {
  if (!notes.length) return null;
  return (
    <Card>
      <SectionTitle>Catatan Otomatis</SectionTitle>
      <ul className="space-y-4">
        {notes.map((n) => {
          const { Icon, tone } = NOTE_STYLE[n.tone];
          return (
            <li key={n.id} className="flex items-start gap-3 text-body text-ink-800">
              <Icon className={cn("mt-1 size-4 shrink-0", tone)} aria-hidden />
              <span className="max-w-chat text-pretty">{n.text}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-caption text-ink-500">
        Dibuat otomatis dari aturan tetap (bukan AI): angka yang sama selalu menghasilkan kalimat yang sama.
      </p>
    </Card>
  );
}

type Slide = { id: string; title: string; node: React.ReactNode };

/** Mobile Typeform-style swipe deck: one section per full-height card, swipe L/R. */
function MobileDeck({ slides }: { slides: Slide[] }) {
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
      <div className="mb-4 flex items-center justify-between gap-3">
        {/* native picker: a real jump-to-section control with a full-size tap target */}
        <label className="relative flex min-w-0 flex-1 items-center">
          <span className="sr-only">Pindah ke section</span>
          <select
            value={active}
            onChange={(e) => go(Number(e.target.value))}
            className={cn(
              "h-11 w-full cursor-pointer appearance-none truncate rounded-full border-control border-ink-200 bg-paper-0 pl-5 pr-11 font-title text-small font-bold text-ink-800 hover:bg-paper-100",
              motion,
            )}
          >
            {slides.map((s, i) => (
              <option key={s.id} value={i}>
                {s.title}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 size-4 text-ink-500" aria-hidden />
        </label>
        <span className="shrink-0 font-mono text-caption text-ink-500">
          {active + 1} / {slides.length}
        </span>
      </div>
      <div
        ref={ref}
        onScroll={onScroll}
        className="no-scrollbar flex h-(--size-deck) snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth"
      >
        {slides.map((s) => (
          <section key={s.id} className="flex h-full w-full shrink-0 snap-center snap-always flex-col">
            <div className="flex-1 overflow-y-auto px-2 pb-6">{s.node}</div>
          </section>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <IconBtn label="Sebelumnya" onClick={() => go(active - 1)} disabled={active === 0} className="border-control border-ink-200 bg-paper-0">
          <ChevronLeft className="size-5" aria-hidden />
        </IconBtn>
        {/* progress only — jumping between sections is the picker above */}
        <div aria-hidden className="pointer-events-none flex flex-1 flex-wrap items-center justify-center gap-1">
          {slides.map((s, i) => (
            <span key={s.id} className={cn("h-2 rounded-full transition-all", i === active ? "w-6 bg-ink-800" : "w-2 bg-ink-200")} />
          ))}
        </div>
        <IconBtn label="Berikutnya" onClick={() => go(active + 1)} disabled={active === slides.length - 1} className="border-control border-ink-200 bg-paper-0">
          <ChevronRight className="size-5" aria-hidden />
        </IconBtn>
      </div>
      <p className="mt-3 text-center text-caption text-ink-500">Geser kiri / kanan untuk pindah section</p>
    </div>
  );
}

export function ReportDashboard({
  metrics,
  showReason = false,
  showChecks = false,
}: {
  metrics: ReportMetrics;
  showReason?: boolean;
  /** Admin-only data-quality banner — never pass on the client-facing page. */
  showChecks?: boolean;
}) {
  if (!metrics.connected) {
    return (
      <EmptyState title="Belum ada data laporan" hint="Data ditarik dari Zernio setelah akun terhubung dan laporan digenerate.">
        {showReason && metrics.reason && <Alert tone="warn">{metrics.reason}</Alert>}
      </EmptyState>
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
      <Card className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="text-small text-ink-500">
              {metrics.platform ? <span className="font-semibold capitalize text-ink-800">{metrics.platform}</span> : "Akun"} ·{" "}
              {metrics.account?.username ? `@${metrics.account.username}` : "terhubung"} · <span className="font-mono text-caption">{metrics.period ?? "periode"}</span>
            </p>
            <p className="mt-1 font-title text-h2 font-extrabold text-ink-800">
              {fmt(metrics.account?.followers)} <span className="font-text text-small font-medium tracking-normal text-ink-500">followers</span>
            </p>
          </div>
          {metrics.fetchedAt && (
            <p className="font-mono text-caption text-ink-500">Data ditarik: {new Date(metrics.fetchedAt).toLocaleString("id-ID")}</p>
          )}
        </div>
        <DataQualityBanner checks={checks} />
        <div>
          <GroupLabel>Jangkauan &amp; volume</GroupLabel>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Tile hero className="col-span-2" label="Reach" value={fmt(t?.reach)} info="reach" delta={deltas?.reach} />
            <Tile label="Impressions (post)" value={fmt(postImpressions.total)} hint={postImpressions.n ? `dari ${postImpressions.n} post` : undefined} info="impressions" />
            <Tile label="Jumlah Post" value={fmt(t?.posts)} info="posts" />
          </div>
        </div>
        <div>
          <GroupLabel>Interaksi</GroupLabel>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
            <Tile label="Total Interaksi" value={fmt(t?.totalInteractions)} info="totalInteractions" delta={deltas?.totalInteractions} />
            <Tile label="ER (Reach)" value={pct(t?.erReach)} info="erReach" delta={deltas?.erReach} />
            <Tile label="Accounts Engaged" value={fmt(t?.accountsEngaged)} info="accountsEngaged" />
            <Tile label="Likes" value={fmt(t?.likes)} info="likes" delta={deltas?.likes} />
            <Tile label="Komentar" value={fmt(t?.comments)} info="comments" delta={deltas?.comments} />
            <Tile label="Shares" value={fmt(t?.shares)} info="shares" delta={deltas?.shares} />
            <Tile label="Saved" value={fmt(t?.saved)} info="saved" delta={deltas?.saved} />
          </div>
        </div>
        <div>
          <GroupLabel>Konversi</GroupLabel>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Tile label="Follows" value={fmt(t?.follows)} info="follows" />
            <Tile label="Web Clicks" value={fmt(t?.webClicks)} info="webClicks" />
          </div>
        </div>
        <p className="text-caption text-ink-500">
          <b className="font-semibold text-ink-800">Cakupan angka:</b>{" "}
          {legendScopes.map((s, i) => (
            <span key={s}>
              {i > 0 && " · "}
              <b className="font-semibold text-ink-800">{SCOPE_INFO[s].label}</b> = {SCOPE_LEGEND[s]}
            </span>
          ))}
          . Angka beda cakupan tidak untuk dibandingkan langsung.
        </p>
      </Card>
    ),
  });

  slides.push({
    id: "efisiensi",
    title: "Efisiensi & Kualitas",
    node: (
      <Card>
        <SectionTitle>Efisiensi, Funnel &amp; Kualitas</SectionTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Tile label="Reach Rate" value={times(eff.reachRate)} hint="reach ÷ followers" info="reachRate" />
          <Tile label="ER (Reach)" value={pct1(eff.erReach)} hint="interaksi ÷ reach" info="erReach" delta={deltas?.erReach} />
          <Tile label="Content Quality Score" value={qScore != null ? qScore.toFixed(1) : "—"} hint="engagement berbobot / 1k reach" info="qualityScore" />
          <Tile label="Saves Rate" value={pct1(eff.savesRate)} hint="saved ÷ reach · sinyal simpan" info="savesRate" delta={savesRateDelta} />
          <Tile label="Shares Rate" value={pct1(eff.sharesRate)} hint="shares ÷ reach · viralitas" info="sharesRate" delta={sharesRateDelta} />
          <Tile label="Profile Visit Rate" value={pct1(eff.pvRate)} hint="Σ profil ÷ Σ reach post" info="pvRate" />
          <Tile label="Follow Rate" value={pct1(eff.followRate)} hint="follows ÷ reach" info="followRate" />
          <Tile
            label="Net Follower Growth"
            value={netGrowth != null ? (netGrowth >= 0 ? "+" : "") + fmt(netGrowth) : "—"}
            hint={growthRate != null ? `${pct1(growthRate)} dari basis` : "gained − lost"}
            info="netGrowth"
          />
          <Tile label="Avg Reach / Post" value={fmt(eff.avgReach != null ? Math.round(eff.avgReach) : null)} hint={eff.reachPosts ? `rata-rata dari ${eff.reachPosts} post` : "rata-rata jangkauan"} info="avgReach" />
        </div>
      </Card>
    ),
  });

  if (deltas) {
    slides.push({
      id: "perbandingan",
      title: "vs Periode Lalu",
      node: (
        <Card>
          <SectionTitle info="comparison">Perbandingan vs Periode Sebelumnya</SectionTitle>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
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
              <div key={label} className={cn(tileCls, "flex flex-col items-center gap-3 text-center")}>
                <p className={capsCls}>{label}</p>
                {d != null ? <DeltaBadge d={d} /> : <span className="font-mono text-caption text-ink-500">—</span>}
              </div>
            ))}
          </div>
          <p className="mt-4 text-caption text-ink-500">Dibandingkan dengan periode sepanjang yang sama tepat sebelum rentang tanggal ini.</p>
        </Card>
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
        <Card>
          <SectionTitle info="movers">Post Pendorong &amp; Penyeret</SectionTitle>
          <div className="grid gap-6 sm:grid-cols-2">
            <MoverList title="Pendorong (Naik)" tone="up" rows={movers.up} />
            <MoverList title="Penyeret (Turun)" tone="down" rows={movers.down} />
          </div>
          <p className="mt-6 text-caption text-ink-500">
            Rata-rata reach periode: <b className="font-mono font-medium text-ink-800">{fmt(Math.round(movers.avgReach))}</b>. Pendorong = jauh di atas rata-rata; penyeret = di bawahnya.
          </p>
        </Card>
      ),
    });
  }

  if (bestTime) {
    slides.push({
      id: "waktu",
      title: "Waktu Terbaik",
      node: (
        <Card>
          <SectionTitle info="bestTime">Waktu Terbaik Posting (WIB)</SectionTitle>
          <ScopeBox scope="P" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Tile label="Hari Terbaik" value={bestTime.day} hint={`avg reach ${fmt(bestTime.dayAvgReach)}`} />
            <Tile label="Jam Terbaik" value={`${String(bestTime.hour).padStart(2, "0")}:00`} hint={`avg reach ${fmt(bestTime.hourAvgReach)}`} />
          </ScopeBox>
          <p className="mt-4 text-caption text-ink-500">Berdasarkan rata-rata reach per hari/jam dari post di periode ini.</p>
        </Card>
      ),
    });
  }

  if (pillarRoll.length > 0) {
    slides.push({
      id: "pillar",
      title: "Per Pillar",
      node: (
        <Card>
          <SectionTitle info="pillar">Performa per Pillar Konten</SectionTitle>
          <div className="space-y-4">
            {pillarRoll.map((p) => (
              <div key={p.name}>
                <div className="mb-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-small">
                  <span className="font-semibold text-ink-800">
                    {p.name} <span className="font-normal text-ink-500">· {p.count} post</span>
                  </span>
                  <span className="font-mono text-caption text-ink-500">
                    {fmt(p.reach)} reach · {fmt(p.ti)} actions
                  </span>
                </div>
                <Bar value={p.reach} max={pillarMaxReach} tone="ink" label={`Reach pillar ${p.name}`} />
              </div>
            ))}
          </div>
          <p className="mt-4 text-caption text-ink-500">Pillar disarankan AI (Claude) — regenerate laporan untuk mengisinya.</p>
        </Card>
      ),
    });
  }

  if (metrics.aiAnalysis && metrics.aiAnalysis.length > 0) {
    slides.push({
      id: "ai",
      title: "Analisa AI",
      node: (
        <Card>
          <SectionTitle>
            <Sparkles className="size-5 text-brand-700" aria-hidden /> Analisa AI (Claude Opus)
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            {metrics.aiAnalysis.map((a, i) => (
              <div key={i} className={cn(tileCls, "space-y-2")}>
                <p className="flex flex-wrap items-center gap-2 font-title text-body font-bold text-ink-800">
                  {a.label}
                  <span className="rounded-full bg-paper-0 px-2 py-1 font-mono text-micro font-medium capitalize leading-none text-ink-500">{a.type}</span>
                </p>
                <p className="whitespace-pre-line text-small font-normal text-ink-800">{a.text}</p>
              </div>
            ))}
          </div>
        </Card>
      ),
    });
  }

  if ((disc && discTotal > 0) || ct.length > 0) {
    slides.push({
      id: "jangkauan",
      title: "Jangkauan & Format",
      node: (
        <div className="grid gap-6 lg:grid-cols-2">
          {disc && discTotal > 0 && (
            <Card>
              <SectionTitle info="discovery">Jangkauan: Followers vs Non-followers</SectionTitle>
              {/* two series in one bar: Ink for followers, the one Orange highlight for people reached beyond them */}
              <div
                role="img"
                aria-label={`Followers ${Math.round(((disc.followers ?? 0) / discTotal) * 100)}%, non-followers ${Math.round(((disc.nonFollowers ?? 0) / discTotal) * 100)}%`}
                className="flex h-3 gap-1 overflow-hidden rounded-full"
              >
                <div className="bg-ink-800" style={{ width: `${((disc.followers ?? 0) / discTotal) * 100}%` }} />
                <div className="bg-brand-500" style={{ width: `${((disc.nonFollowers ?? 0) / discTotal) * 100}%` }} />
              </div>
              <div className="mt-4 flex flex-wrap justify-between gap-x-6 gap-y-2 text-small text-ink-800">
                <span className="flex items-center gap-2">
                  <Dot className="bg-ink-800" /> Followers <b className="font-mono font-medium">{fmt(disc.followers)}</b>
                  <span className="text-ink-500">({Math.round(((disc.followers ?? 0) / discTotal) * 100)}%)</span>
                </span>
                <span className="flex items-center gap-2">
                  <Dot className="bg-brand-500" /> Non-followers <b className="font-mono font-medium">{fmt(disc.nonFollowers)}</b>
                  <span className="text-ink-500">({Math.round(((disc.nonFollowers ?? 0) / discTotal) * 100)}%)</span>
                </span>
              </div>
              <p className="mt-4 text-caption text-ink-500">Porsi non-followers tinggi = konten Anda banyak ditemukan lewat discovery/explore.</p>
            </Card>
          )}
          {ct.length > 0 && (
            <Card>
              <SectionTitle info="contentType">Reach per Jenis Konten</SectionTitle>
              <div className="space-y-4">
                {ct
                  .slice()
                  .sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))
                  .map((c) => (
                    <div key={c.type}>
                      <div className="mb-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-small">
                        <span className="font-semibold text-ink-800">{CT_LABEL[c.type] ?? c.type}</span>
                        <span className="font-mono text-caption text-ink-500">
                          {fmt(c.reach)} reach{c.interactions != null ? ` · ${fmt(c.interactions)} interaksi` : ""}
                        </span>
                      </div>
                      <Bar value={c.reach ?? 0} max={ctMax} tone="ink" label={`Reach ${CT_LABEL[c.type] ?? c.type}`} />
                    </div>
                  ))}
              </div>
            </Card>
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
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <h2 className="flex items-center gap-2 font-title text-h3 text-ink-800">
              Pertumbuhan Follower
              <InfoDot id="followerGrowth" />
            </h2>
            <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-caption">
              {metrics.followersGained != null && <span className="text-success-ink">+{fmt(metrics.followersGained)} gained</span>}
              {metrics.followersLost != null && <span className="text-danger">−{fmt(metrics.followersLost)} lost</span>}
              {metrics.account?.followers != null && <span className="font-medium text-ink-800">{fmt(metrics.account.followers)} total</span>}
            </div>
          </div>
          {metrics.followerSeries && metrics.followerSeries.length > 1 && <FollowerLine series={metrics.followerSeries} />}
        </Card>
      ),
    });
  }

  if (hasDemo) {
    slides.push({
      id: "demografi",
      title: "Audiens (Followers)",
      node: (
        <Card>
          <SectionTitle>Audiens (Followers)</SectionTitle>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <BarList title="Umur" items={metrics.demographics!.ages} />
            <BarList title="Gender" items={metrics.demographics!.genders} />
            <BarList title="Kota" items={metrics.demographics!.cities} />
            <BarList title="Negara" items={metrics.demographics!.countries} />
          </div>
        </Card>
      ),
    });
  }

  if ((metrics.reels && metrics.reels.count > 0) || reels.length > 0) {
    slides.push({
      id: "reels",
      title: "Reels & Retensi",
      node: (
        <div className="space-y-6">
          {metrics.reels && metrics.reels.count > 0 && (
            <Card>
              <SectionTitle info="completion">Performa Reels / Video</SectionTitle>
              <ScopeBox scope="P" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Tile label="Jumlah Video" value={fmt(metrics.reels.count)} />
                <Tile label="Total Views" value={fmt(metrics.reels.totalViews)} />
                <Tile label="Avg Watch Time" value={avgWatch != null ? `${avgWatch.toFixed(1)} dtk` : "—"} />
                <Tile label="Completion Rate" value={pct(metrics.reels.avgCompletion)} />
              </ScopeBox>
            </Card>
          )}
          {reels.length > 0 && (
            <Card className="px-0 pb-4 sm:px-0 sm:pb-6">
              <div className="px-6 sm:px-8">
                <SectionTitle info="viewRate">Retensi Reels per Video</SectionTitle>
              </div>
              <div className="overflow-x-auto px-3 sm:px-5">
                <table className="w-full min-w-table-sm border-separate border-spacing-0 text-caption">
                  <caption className="sr-only">Retensi Reels per video</caption>
                  <thead>
                    <tr>
                      <th className={th}>Tanggal</th>
                      <th className={th}>Konten</th>
                      <th className={cn(th, "text-right")}>Views</th>
                      <th className={cn(th, "text-right")}>Reach</th>
                      <th className={cn(th, "text-right")}>View Rate</th>
                      <th className={cn(th, "text-right")}>Avg Watch</th>
                      <th className={cn(th, "text-right")}>Completion</th>
                      <th className={cn(th, "text-right")}>Skip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reels.map((v, i) => (
                      <tr key={i} className="group">
                        <td className={cn(td, "whitespace-nowrap font-mono text-ink-500")}>{v.date}</td>
                        <td className={cn(td, "max-w-xs text-ink-800")}>
                          <span className="line-clamp-2">{v.caption || "—"}</span>
                        </td>
                        <td className={cn(td, num, "font-medium text-ink-800")}>{fmt(v.views)}</td>
                        <td className={cn(td, num, "text-ink-800")}>{fmt(v.reach)}</td>
                        <td className={cn(td, num, "text-ink-500")}>{v.viewRate != null ? times(v.viewRate) : "—"}</td>
                        <td className={cn(td, num, "text-ink-800")}>{v.avgWatchSec != null ? `${v.avgWatchSec.toFixed(1)} dtk` : "—"}</td>
                        <td className={cn(td, num, "text-ink-800")}>{pct1(v.completion)}</td>
                        <td className={cn(td, num, "text-ink-500")}>{pct1(v.skip)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-6 pt-4 text-caption text-ink-500 sm:px-8">
                View Rate = views ÷ reach (daya tarik hook). Completion tinggi + Skip rendah = retensi kuat.
              </p>
            </Card>
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
        <Card>
          <SectionTitle>Instagram Stories ({metrics.stories.count})</SectionTitle>
          <ScopeBox scope="S" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Tile label="Views" value={fmt(metrics.stories.views)} />
            <Tile label="Reach" value={fmt(metrics.stories.reach)} />
            <Tile label="Replies" value={fmt(metrics.stories.replies)} />
            <Tile label="Taps Fwd" value={fmt(metrics.stories.tapsForward)} />
            <Tile label="Taps Back" value={fmt(metrics.stories.tapsBack)} />
            <Tile label="Exits" value={fmt(metrics.stories.exits)} />
            <Tile label="Profile Visits" value={fmt(metrics.stories.profileVisits)} />
            <Tile label="Follows" value={fmt(metrics.stories.follows)} />
          </ScopeBox>
        </Card>
      ),
    });
  }

  if (hasEngDemo) {
    slides.push({
      id: "engaged",
      title: "Audiens Interaksi",
      node: (
        <Card>
          <SectionTitle>Audiens yang Berinteraksi</SectionTitle>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <BarList title="Umur" items={metrics.engagedDemographics!.ages} />
            <BarList title="Gender" items={metrics.engagedDemographics!.genders} />
            <BarList title="Kota" items={metrics.engagedDemographics!.cities} />
            <BarList title="Negara" items={metrics.engagedDemographics!.countries} />
          </div>
        </Card>
      ),
    });
  }

  if (genderOverlap.length > 0 || ageOverlap.length > 0) {
    slides.push({
      id: "overlap",
      title: "Overlap Audiens",
      node: (
        <Card>
          <SectionTitle info="overlap">Overlap Audiens: Followers vs yang Berinteraksi</SectionTitle>
          <p className="-mt-2 mb-6 max-w-chat text-caption text-ink-500">
            Gap positif = segmen itu <b className="font-semibold text-ink-800">lebih aktif</b> berinteraksi dibanding porsinya di followers.
          </p>
          <div className="grid gap-8 sm:grid-cols-2">
            <OverlapTable title="Umur" rows={ageOverlap} />
            <OverlapTable title="Gender" rows={genderOverlap} />
          </div>
        </Card>
      ),
    });
  }

  if (metrics.contactButtons && metrics.contactButtons.length > 0) {
    slides.push({
      id: "kontak",
      title: "Tombol Kontak",
      node: (
        <Card>
          <SectionTitle>Tap Tombol Kontak (Profil)</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {metrics.contactButtons.map((c) => (
              <Chip key={c.type} tone="neutral" className="text-ink-800">
                {c.type}: <b className="font-mono font-medium">{fmt(c.value)}</b>
              </Chip>
            ))}
          </div>
        </Card>
      ),
    });
  }

  if (series.length > 1) {
    slides.push({
      id: "tren",
      title: "Tren Reach",
      node: (
        <Card>
          <SectionTitle>Tren Reach Harian</SectionTitle>
          <div className="flex h-24 items-end gap-1" role="img" aria-label="Grafik batang reach per hari">
            {series.map((s, i) => (
              <div
                key={i}
                title={`${s.date}: ${fmt(s.value)}`}
                className="flex-1 rounded-t-full bg-ink-800"
                style={{ height: `${Math.max(2, (s.value / sMax) * 100)}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-caption text-ink-500">
            <span>{series[0]?.date}</span>
            <span>{series[series.length - 1]?.date}</span>
          </div>
        </Card>
      ),
    });
  }

  if (posts.length > 0) {
    slides.push({
      id: "postmaster",
      title: "Post Master",
      node: (
        <Card className="px-0 pb-4 sm:px-0 sm:pb-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 sm:px-8">
            <SectionTitle>Post Master — detail per post</SectionTitle>
            <span className="mb-4 font-mono text-caption text-ink-500">sama seperti Excel · {posts.length} post</span>
          </div>
          <div className="overflow-x-auto px-3 sm:px-5">
            <table className="w-full min-w-table border-separate border-spacing-0 text-caption">
              <caption className="sr-only">Detail per post, sama seperti Excel</caption>
              <thead>
                <tr>
                  <th className={cn(th, "sticky left-0 z-10 bg-paper-0")}>Tanggal</th>
                  <th className={th}>Pillar</th>
                  <th className={th}>Konten</th>
                  <th className={cn(th, "text-right")}>Followers</th>
                  <th className={cn(th, "text-right")}>Likes</th>
                  <th className={cn(th, "text-right")}>Komen</th>
                  <th className={cn(th, "text-right")}>ER</th>
                  <th className={cn(th, "text-right")}>Follows</th>
                  <th className={cn(th, "text-right")}>Profil</th>
                  <th className={cn(th, "text-right")}>Shared</th>
                  <th className={cn(th, "text-right")}>Saved</th>
                  <th className={cn(th, "text-right")}>Web Clk</th>
                  <th className={cn(th, "text-right")}>Impr.</th>
                  <th className={cn(th, "text-right")}>Reach</th>
                  <th className={cn(th, "text-right")}>Reach ER</th>
                  <th className={cn(th, "text-right")}>Total Actions</th>
                </tr>
              </thead>
              <tbody>
                {monthGroups.map(([ym, mp]) => (
                  <MonthRows key={ym} ym={ym} posts={mp} followersBase={followersBase} sumBy={sumBy} multi={monthGroups.length > 1} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-6 pt-4 text-caption text-ink-500 sm:px-8">
            “—” = data tidak tersedia dari Zernio (bukan 0). Total Actions = like + komentar + follows + profil + shared + saved + web click.
          </p>
        </Card>
      ),
    });
  }

  return (
    <PlatformCtx.Provider value={metrics.platform}>
      {/* Desktop: stacked sections, 24px apart (BRAND "kartu 24") */}
      <div className="hidden space-y-6 sm:block">
        {slides.map((s) => (
          <div key={s.id}>{s.node}</div>
        ))}
      </div>
      {/* Mobile: Typeform-style swipe deck */}
      <div className="sm:hidden">
        <MobileDeck slides={slides} />
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
  const cell = cn(td, num);
  return (
    <>
      {multi && (
        <tr>
          <td colSpan={16} className={cn(capsCls, "px-4 pb-2 pt-6")}>
            {monthLabel(ym)}
          </td>
        </tr>
      )}
      {posts.map((p, i) => {
        const ti = totalActions(p);
        const has = postHasData(p); // a post with no insights yet shows "—", not 0 actions / 0% ER
        const followers = p.followersAtPeriod ?? followersBase;
        return (
          <tr key={i} className="group">
            <td className={cn(td, "sticky left-0 z-10 whitespace-nowrap bg-paper-0 font-mono text-ink-500")}>{p.date}</td>
            <td className={cn(td, "whitespace-nowrap text-ink-800")}>{p.pillar ?? "—"}</td>
            <td className={cn(td, "max-w-xs text-ink-800")}>
              <span className="line-clamp-2">{p.caption || "—"}</span>
            </td>
            <td className={cn(cell, "text-ink-500")}>{fmt(followers)}</td>
            <td className={cn(cell, "text-ink-800")}>{fmt(p.likes)}</td>
            <td className={cn(cell, "text-ink-800")}>{fmt(p.comments)}</td>
            <td className={cn(cell, "text-ink-500")}>{followers && has ? pct1(ti / followers) : "—"}</td>
            <td className={cn(cell, "text-ink-800")}>{fmt(p.follows)}</td>
            <td className={cn(cell, "text-ink-800")}>{fmt(p.profileVisits)}</td>
            <td className={cn(cell, "text-ink-800")}>{fmt(p.shares)}</td>
            <td className={cn(cell, "text-ink-800")}>{fmt(p.saved)}</td>
            <td className={cn(cell, "text-ink-800")}>{fmt(p.webClicks)}</td>
            <td className={cn(cell, "text-ink-800")}>{fmt(p.impressions)}</td>
            <td className={cn(cell, "font-medium text-ink-800")}>{fmt(p.reach)}</td>
            <td className={cn(cell, "text-ink-500")}>{p.reach ? pct1(ti / p.reach) : "—"}</td>
            <td className={cn(cell, "font-semibold text-ink-800")}>{has ? fmt(ti) : "—"}</td>
          </tr>
        );
      })}
      <tr className="font-semibold text-ink-800">
        {/* the month total is a Paper band: its cells carry the fill so the rounded ends show */}
        <td className={cn("h-12 rounded-l-field bg-paper-100 px-4")} colSpan={3}>
          {multi ? `${monthLabel(ym)} — Total` : "Total"}
        </td>
        <td className="bg-paper-100 px-4"></td>
        <td className={cn("bg-paper-100 px-4", num)}>{fmt(sumBy(posts, (p) => p.likes))}</td>
        <td className={cn("bg-paper-100 px-4", num)}>{fmt(sumBy(posts, (p) => p.comments))}</td>
        <td className="bg-paper-100 px-4"></td>
        <td className={cn("bg-paper-100 px-4", num)}>{fmt(sumBy(posts, (p) => p.follows))}</td>
        <td className={cn("bg-paper-100 px-4", num)}>{fmt(sumBy(posts, (p) => p.profileVisits))}</td>
        <td className={cn("bg-paper-100 px-4", num)}>{fmt(sumBy(posts, (p) => p.shares))}</td>
        <td className={cn("bg-paper-100 px-4", num)}>{fmt(sumBy(posts, (p) => p.saved))}</td>
        <td className={cn("bg-paper-100 px-4", num)}>{fmt(sumBy(posts, (p) => p.webClicks))}</td>
        <td className={cn("bg-paper-100 px-4", num)}>{fmt(sumBy(posts, (p) => p.impressions))}</td>
        <td className={cn("bg-paper-100 px-4", num)}>{fmt(sumBy(posts, (p) => p.reach))}</td>
        <td className="bg-paper-100 px-4"></td>
        <td className={cn("rounded-r-field bg-paper-100 px-4", num)}>{fmt(sumBy(posts, (p) => (postHasData(p) ? totalActions(p) : null)))}</td>
      </tr>
    </>
  );
}
