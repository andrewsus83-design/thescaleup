"use client";

// Web Builder setup form + lite edit mode.
// Four sections: Brand Design · Page Sections (EEAT) · Web References · Build action.
// After a build exists, an edit bar appears at the bottom for prompt-driven revisions.

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronDown, ChevronRight, Phone, MapPin, HelpCircle,
  BookOpen, Sparkles, Send, Check, Pencil, Wand2, X, Plus,
  Globe, Palette, LayoutTemplate, Zap,
} from "lucide-react";
import type {
  Project, BrandDesign, EeatSections, FaqItem,
  FontSlot, StyleTag, PageSchema, WebSetup, WebBuild,
} from "@/lib/room/types";
import { cn } from "@/lib/utils";
import { useRoom } from "./room-provider";
import {
  Alert, Btn, Card, PageHeader, EmptyState, pageX,
} from "./ui";
import { inputCls, textareaCls, labelCls, cardCls, motion, capsCls } from "@/components/brand/styles";
import { ProjectSwitcher, NeedProject } from "./project-switcher";
import { runWebBuild, runWebEdit } from "@/lib/room/brand-actions";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FONT_OPTIONS: Record<FontSlot, string[]> = {
  title:  ["Playfair Display", "Cormorant Garamond", "DM Serif Display", "Fraunces", "Lora", "Merriweather", "Libre Baskerville"],
  body:   ["Inter", "DM Sans", "Outfit", "Plus Jakarta Sans", "Nunito", "Lato", "Figtree"],
  mono:   ["JetBrains Mono", "Fira Code", "IBM Plex Mono", "Space Mono", "Roboto Mono"],
  accent: ["Dancing Script", "Pacifico", "Satisfy", "Great Vibes", "Caveat", "Sacramento", "Kalam"],
};

const FONT_LABEL: Record<FontSlot, string> = {
  title: "Title",
  body: "Body",
  mono: "Mono",
  accent: "Accent",
};

const FONT_HINT: Record<FontSlot, string> = {
  title:  "Headlines & hero text",
  body:   "Paragraphs & UI",
  mono:   "Code, stats & captions",
  accent: "Pull quotes & highlights",
};

const STYLE_META: Record<StyleTag, { label: string; bg: string; dot: string }> = {
  minimal:   { label: "Minimal",   bg: "#f1f5f9", dot: "#64748b" },
  bold:      { label: "Bold",      bg: "#1e293b", dot: "#f8fafc" },
  luxury:    { label: "Luxury",    bg: "#fef9ee", dot: "#b89c5a" },
  playful:   { label: "Playful",   bg: "#fff0f6", dot: "#ec4899" },
  corporate: { label: "Corporate", bg: "#eff6ff", dot: "#3b82f6" },
  organic:   { label: "Organic",   bg: "#f0fdf4", dot: "#22c55e" },
  tech:      { label: "Tech",      bg: "#ecfeff", dot: "#06b6d4" },
  artisan:   { label: "Artisan",   bg: "#fefce8", dot: "#a16207" },
  editorial: { label: "Editorial", bg: "#f5f3ff", dot: "#6366f1" },
  energetic: { label: "Energetic", bg: "#fff7ed", dot: "#f97316" },
};

const SCHEMAS: {
  key: PageSchema;
  label: string;
  desc: string;
  sections: string[];
}[] = [
  { key: "landing",  label: "Landing Page",  desc: "Konversi & awareness",           sections: ["Hero", "Features", "Social Proof", "CTA"] },
  { key: "service",  label: "Service Page",  desc: "Jasa & layanan profesional",      sections: ["Hero", "Services", "Process", "FAQ", "CTA"] },
  { key: "product",  label: "Product Page",  desc: "Produk & online store",           sections: ["Hero", "Product", "Benefits", "Reviews", "CTA"] },
  { key: "custom",   label: "Custom",         desc: "Susun section sendiri",           sections: ["Hero", "…", "CTA"] },
];

const DEFAULT_SETUP: WebSetup = {
  design: {
    fonts:  { title: "Playfair Display", body: "Inter", mono: "JetBrains Mono", accent: "Dancing Script" },
    colors: { primary: "#1a1a2e", secondary: "#f5f5f0", accent: "#e94560" },
    style:  ["minimal"],
    schema: "landing",
  },
  sections: {
    whatsapp: { enabled: false, number: "" },
    maps:     { enabled: false, url: "" },
    faq:      { enabled: true,  autoGenerate: true, items: [] },
    blog:     { enabled: false, label: "Artikel" },
  },
  refUrls: ["", "", ""],
};

// ─────────────────────────────────────────────────────────────────────────────
// Utility hooks
// ─────────────────────────────────────────────────────────────────────────────

/** Inject a Google Fonts stylesheet once per font family. */
function useGoogleFont(family: string) {
  useEffect(() => {
    if (!family || typeof document === "undefined") return;
    const id = `gf-${family.replace(/\s+/g, "-").toLowerCase()}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`;
    document.head.appendChild(link);
  }, [family]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Micro-components
// ─────────────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
        motion,
        checked ? "bg-brand-500" : "bg-ink-200",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow-sm",
          motion,
          checked ? "left-[1.375rem]" : "left-0.5",
        )}
      />
    </button>
  );
}

function SectionAccordion({
  icon, title, desc, open, onToggle, children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cardCls()}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 text-left"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-paper-100 text-ink-500">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-title text-[16px] font-semibold text-ink-800">{title}</p>
          <p className="mt-0.5 text-[13px] text-ink-500">{desc}</p>
        </div>
        {open
          ? <ChevronDown className="size-5 shrink-0 text-ink-400" />
          : <ChevronRight className="size-5 shrink-0 text-ink-400" />}
      </button>
      {open && <div className="mt-6 space-y-6 border-t border-hairline pt-6">{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Font picker row
// ─────────────────────────────────────────────────────────────────────────────

function FontRow({
  slot, value, onChange,
}: {
  slot: FontSlot;
  value: string;
  onChange: (v: string) => void;
}) {
  useGoogleFont(value);
  return (
    <div className="grid gap-2 sm:grid-cols-[7rem_1fr_auto] sm:items-center sm:gap-4">
      <div>
        <p className={capsCls}>{FONT_LABEL[slot]}</p>
        <p className="mt-0.5 text-[12px] text-ink-400">{FONT_HINT[slot]}</p>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputCls, "h-12")}
        aria-label={`${FONT_LABEL[slot]} font`}
      >
        {FONT_OPTIONS[slot].map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
      <div
        className="hidden text-right text-[20px] text-ink-800 sm:block sm:w-28 sm:shrink-0 sm:truncate"
        style={{ fontFamily: `"${value}", serif` }}
        aria-hidden
      >
        Aa Bb Cc
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Color swatch
// ─────────────────────────────────────────────────────────────────────────────

function ColorSwatch({
  label, value, onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [hex, setHex] = useState(value);

  function commit(raw: string) {
    const v = raw.startsWith("#") ? raw : `#${raw}`;
    setHex(v);
    if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="size-16 rounded-full border-2 border-hairline shadow-sm transition-transform hover:scale-110 active:scale-95"
        style={{ backgroundColor: value }}
        aria-label={`Pick ${label} colour`}
      />
      <p className={capsCls}>{label}</p>
      <input
        type="text"
        value={hex}
        maxLength={7}
        onChange={(e) => commit(e.target.value)}
        className="w-24 rounded-full border border-hairline bg-paper-0 px-3 py-1 text-center font-mono text-[13px] text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
        aria-label={`${label} hex value`}
      />
      <input
        ref={ref}
        type="color"
        value={value}
        onChange={(e) => { setHex(e.target.value); onChange(e.target.value); }}
        className="sr-only"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Style tags
// ─────────────────────────────────────────────────────────────────────────────

function StyleTagPicker({
  value, onChange,
}: {
  value: StyleTag[];
  onChange: (v: StyleTag[]) => void;
}) {
  const MAX = 3;
  const toggle = (tag: StyleTag) => {
    if (value.includes(tag)) {
      onChange(value.filter((t) => t !== tag));
    } else if (value.length < MAX) {
      onChange([...value, tag]);
    }
  };

  return (
    <div>
      <p className={cn(labelCls, "mb-3")}>Visual style <span className="font-normal text-ink-400">(pick up to 3)</span></p>
      <div className="flex flex-wrap gap-2">
        {(Object.entries(STYLE_META) as [StyleTag, typeof STYLE_META[StyleTag]][]).map(([key, meta]) => {
          const active = value.includes(key);
          const disabled = !active && value.length >= MAX;
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              disabled={disabled}
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] font-semibold",
                motion,
                active
                  ? "border-transparent text-ink-800 shadow-sm"
                  : "border-hairline bg-paper-0 text-ink-600 hover:border-ink-300",
                disabled && "cursor-not-allowed opacity-40",
              )}
              style={active ? { backgroundColor: meta.bg } : undefined}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: meta.dot }}
              />
              {meta.label}
              {active && <Check className="size-3" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema picker
// ─────────────────────────────────────────────────────────────────────────────

function SchemaPicker({
  value, onChange,
}: {
  value: PageSchema;
  onChange: (v: PageSchema) => void;
}) {
  return (
    <div>
      <p className={cn(labelCls, "mb-3")}>Page schema</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SCHEMAS.map((s) => {
          const active = value === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onChange(s.key)}
              className={cn(
                "relative flex flex-col gap-4 rounded-bubble border-2 p-4 text-left",
                motion,
                active
                  ? "border-brand-500 bg-brand-50"
                  : "border-hairline bg-paper-0 hover:border-ink-300",
              )}
            >
              {active && (
                <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-brand-500">
                  <Check className="size-3 text-white" />
                </span>
              )}
              {/* Mini layout preview */}
              <div className="space-y-1.5 pr-6">
                {s.sections.map((sec, i) => (
                  <div
                    key={i}
                    className="h-[5px] rounded-full"
                    style={{
                      width: i === 0 ? "100%" : i === s.sections.length - 1 ? "70%" : `${75 + i * 5}%`,
                      backgroundColor: active ? "#ff6b35" : "#e2e8f0",
                      opacity: 0.5 + i * 0.1,
                    }}
                  />
                ))}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-ink-800">{s.label}</p>
                <p className="mt-0.5 text-[12px] text-ink-500">{s.desc}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {s.sections.map((sec) => (
                  <span key={sec} className="rounded-full bg-paper-100 px-2 py-0.5 font-mono text-[10px] text-ink-500">
                    {sec}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EEAT section toggle rows
// ─────────────────────────────────────────────────────────────────────────────

function EeatRow({
  icon, title, desc, enabled, onToggle, children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-bubble border border-hairline bg-paper-0">
      <div className="flex items-center gap-4 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-paper-100 text-ink-500">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink-800">{title}</p>
          <p className="mt-0.5 text-[13px] text-ink-500">{desc}</p>
        </div>
        <Toggle checked={enabled} onChange={onToggle} label={`Toggle ${title}`} />
      </div>
      {enabled && children && (
        <div className="border-t border-hairline px-4 pb-4 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FAQ item editor
// ─────────────────────────────────────────────────────────────────────────────

function FaqEditor({
  items, onChange,
}: {
  items: FaqItem[];
  onChange: (items: FaqItem[]) => void;
}) {
  const add = () => onChange([...items, { q: "", a: "" }]);
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  const set = (i: number, field: "q" | "a", val: string) =>
    onChange(items.map((item, j) => j === i ? { ...item, [field]: val } : item));

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="relative rounded-field border border-hairline p-3">
          <button
            type="button"
            onClick={() => remove(i)}
            className="absolute right-2 top-2 text-ink-400 hover:text-ink-800"
            aria-label="Remove FAQ item"
          >
            <X className="size-4" />
          </button>
          <input
            value={item.q}
            onChange={(e) => set(i, "q", e.target.value)}
            placeholder="Question"
            className={cn(inputCls, "h-10 pr-8")}
          />
          <textarea
            value={item.a}
            onChange={(e) => set(i, "a", e.target.value)}
            placeholder="Answer"
            rows={2}
            className={cn(textareaCls, "mt-2 min-h-[4rem]")}
          />
        </div>
      ))}
      <Btn size="sm" variant="secondary" onClick={add}>
        <Plus className="size-4" /> Add FAQ item
      </Btn>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit bar (appears after a build exists)
// ─────────────────────────────────────────────────────────────────────────────

const QUICK_EDITS = [
  "Make the hero more dramatic",
  "Add more whitespace",
  "Bolder typography",
  "Softer & warmer colours",
  "More minimalist",
  "Add a strong opening hook",
];

function EditBar({
  version, onEdit, editing,
}: {
  version: number;
  onEdit: (prompt: string) => void;
  editing: boolean;
}) {
  const [prompt, setPrompt] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if (!prompt.trim() || editing) return;
    onEdit(prompt.trim());
    setPrompt("");
  };

  return (
    <div className={cn(cardCls(), "border-t-2 border-brand-500")}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pencil className="size-4 text-brand-600" />
          <p className="text-[14px] font-semibold text-ink-800">Edit with a prompt</p>
        </div>
        <div className="flex items-center gap-2 text-[13px] text-ink-500">
          <span className="font-mono">v{version}</span>
          <span>·</span>
          <span>~$0.15 / edit via Sonnet</span>
        </div>
      </div>

      {/* Quick edit chips */}
      <div className="mb-3 flex flex-wrap gap-2">
        {QUICK_EDITS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => { setPrompt(q); ref.current?.focus(); }}
            className={cn(
              "inline-flex h-7 items-center rounded-full border border-hairline bg-paper-100 px-3 text-[12px] text-ink-600",
              motion,
              "hover:border-ink-300 hover:bg-paper-200",
            )}
          >
            {q}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <textarea
          ref={ref}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder='Describe what to change — e.g. "Make the hero text bigger and more impactful"'
          rows={2}
          className={cn(textareaCls, "flex-1 min-h-[3rem] resize-none")}
          disabled={editing}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!prompt.trim() || editing}
          className={cn(
            "flex size-11 shrink-0 self-end items-center justify-center rounded-full",
            motion,
            "bg-brand-500 text-ink-800 hover:bg-brand-600 active:bg-brand-700",
            "disabled:cursor-not-allowed disabled:bg-ink-100 disabled:text-ink-300",
          )}
          aria-label="Apply edit"
        >
          {editing
            ? <span className="size-4 animate-spin rounded-full border-2 border-ink-400 border-t-transparent" />
            : <Send className="size-4" />}
        </button>
      </div>
      <p className="mt-2 text-[12px] text-ink-400">⌘ + Enter to apply</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main setup form
// ─────────────────────────────────────────────────────────────────────────────

function WebSetupForm({
  project,
  setup,
  onChange,
  onBuild,
  building,
  lastBuild,
  onEdit,
  editing,
}: {
  project: Project;
  setup: WebSetup;
  onChange: (s: WebSetup) => void;
  onBuild: () => void;
  building: boolean;
  lastBuild: WebBuild | null;
  onEdit: (prompt: string) => void;
  editing: boolean;
}) {
  const [open, setOpen] = useState({ design: true, sections: true, refs: false });
  const toggleSection = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const setDesign = (d: Partial<BrandDesign>) =>
    onChange({ ...setup, design: { ...setup.design, ...d } });
  const setFont = (slot: FontSlot, v: string) =>
    setDesign({ fonts: { ...setup.design.fonts, [slot]: v } });
  const setColor = (k: keyof BrandDesign["colors"], v: string) =>
    setDesign({ colors: { ...setup.design.colors, [k]: v } });
  const setSections = (s: Partial<EeatSections>) =>
    onChange({ ...setup, sections: { ...setup.sections, ...s } });
  const setRef = (i: 0 | 1 | 2, v: string) => {
    const next: [string, string, string] = [...setup.refUrls];
    next[i] = v;
    onChange({ ...setup, refUrls: next });
  };

  const canBuild = setup.design.style.length > 0;

  return (
    <div className="space-y-4">

      {/* ── Brand Design ─────────────────────────────────────────────────── */}
      <SectionAccordion
        icon={<Palette className="size-5" />}
        title="Brand Design"
        desc="Fonts, colours, visual style and page schema"
        open={open.design}
        onToggle={() => toggleSection("design")}
      >
        {/* Fonts */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className={labelCls}>Typography — 4 font slots</p>
            <button
              type="button"
              className="flex items-center gap-1 text-[12px] text-brand-600 hover:text-brand-700"
            >
              <Wand2 className="size-3" /> Suggest for me
            </button>
          </div>
          <div className="space-y-3 rounded-bubble bg-paper-100 p-4">
            {(["title", "body", "mono", "accent"] as FontSlot[]).map((slot) => (
              <FontRow
                key={slot}
                slot={slot}
                value={setup.design.fonts[slot]}
                onChange={(v) => setFont(slot, v)}
              />
            ))}
          </div>
        </div>

        {/* Colours */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className={labelCls}>Colour palette — 3 tones</p>
            <button
              type="button"
              className="flex items-center gap-1 text-[12px] text-brand-600 hover:text-brand-700"
            >
              <Sparkles className="size-3" /> Generate palette
            </button>
          </div>
          <div className="flex justify-around rounded-bubble bg-paper-100 p-6">
            <ColorSwatch
              label="Primary"
              value={setup.design.colors.primary}
              onChange={(v) => setColor("primary", v)}
            />
            <ColorSwatch
              label="Secondary"
              value={setup.design.colors.secondary}
              onChange={(v) => setColor("secondary", v)}
            />
            <ColorSwatch
              label="Accent"
              value={setup.design.colors.accent}
              onChange={(v) => setColor("accent", v)}
            />
          </div>
        </div>

        {/* Style tags */}
        <StyleTagPicker
          value={setup.design.style}
          onChange={(style) => setDesign({ style })}
        />

        {/* Schema */}
        <SchemaPicker
          value={setup.design.schema}
          onChange={(schema) => setDesign({ schema })}
        />
      </SectionAccordion>

      {/* ── Page Sections (EEAT) ─────────────────────────────────────────── */}
      <SectionAccordion
        icon={<LayoutTemplate className="size-5" />}
        title="Page Sections"
        desc="EEAT signals that build trust and drive conversions"
        open={open.sections}
        onToggle={() => toggleSection("sections")}
      >
        <div className="space-y-3">

          {/* WhatsApp */}
          <EeatRow
            icon={<Phone className="size-4" />}
            title="WhatsApp"
            desc="Floating button + link to open a chat directly"
            enabled={setup.sections.whatsapp.enabled}
            onToggle={(v) => setSections({ whatsapp: { ...setup.sections.whatsapp, enabled: v } })}
          >
            <div>
              <label className={cn(labelCls, "text-[13px]")}>WhatsApp number</label>
              <input
                type="tel"
                value={setup.sections.whatsapp.number}
                onChange={(e) => setSections({ whatsapp: { ...setup.sections.whatsapp, number: e.target.value } })}
                placeholder="+62 811 xxxx xxxx (with country code)"
                className={cn(inputCls, "h-12")}
              />
            </div>
          </EeatRow>

          {/* Google Maps */}
          <EeatRow
            icon={<MapPin className="size-4" />}
            title="Google Maps"
            desc="Embed map showing the brand's location"
            enabled={setup.sections.maps.enabled}
            onToggle={(v) => setSections({ maps: { ...setup.sections.maps, enabled: v } })}
          >
            <div>
              <label className={cn(labelCls, "text-[13px]")}>Google Maps embed URL</label>
              <input
                type="url"
                value={setup.sections.maps.url}
                onChange={(e) => setSections({ maps: { ...setup.sections.maps, url: e.target.value } })}
                placeholder="https://maps.google.com/maps?q=…&output=embed"
                className={cn(inputCls, "h-12")}
              />
              <p className="mt-1 text-[12px] text-ink-400">
                Google Maps → Share → Embed a map → copy the src URL
              </p>
            </div>
          </EeatRow>

          {/* FAQ */}
          <EeatRow
            icon={<HelpCircle className="size-4" />}
            title="FAQ"
            desc="Frequently asked questions — improves SEO & GEO"
            enabled={setup.sections.faq.enabled}
            onToggle={(v) => setSections({ faq: { ...setup.sections.faq, enabled: v } })}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-ink-800">FAQ content</p>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-ink-500">Auto-generate from brand info</span>
                  <Toggle
                    checked={setup.sections.faq.autoGenerate}
                    onChange={(v) => setSections({ faq: { ...setup.sections.faq, autoGenerate: v } })}
                    label="Auto-generate FAQ"
                  />
                </div>
              </div>
              {setup.sections.faq.autoGenerate ? (
                <div className="flex items-center gap-3 rounded-field bg-paper-100 px-4 py-3">
                  <Sparkles className="size-4 shrink-0 text-brand-600" />
                  <p className="text-[13px] text-ink-600">
                    Opus will generate relevant FAQ questions and answers from the brand profile and website.
                  </p>
                </div>
              ) : (
                <FaqEditor
                  items={setup.sections.faq.items}
                  onChange={(items) => setSections({ faq: { ...setup.sections.faq, items } })}
                />
              )}
            </div>
          </EeatRow>

          {/* Blog */}
          <EeatRow
            icon={<BookOpen className="size-4" />}
            title="Blog / Articles"
            desc="Content section — becomes a blog feed as articles are uploaded"
            enabled={setup.sections.blog.enabled}
            onToggle={(v) => setSections({ blog: { ...setup.sections.blog, enabled: v } })}
          >
            <div>
              <label className={cn(labelCls, "text-[13px]")}>Section label</label>
              <input
                type="text"
                value={setup.sections.blog.label}
                onChange={(e) => setSections({ blog: { ...setup.sections.blog, label: e.target.value } })}
                placeholder="e.g. Artikel, Insights, Tips & Trik, Our Journal"
                className={cn(inputCls, "h-12")}
              />
            </div>
          </EeatRow>
        </div>
      </SectionAccordion>

      {/* ── Web References ───────────────────────────────────────────────── */}
      <SectionAccordion
        icon={<Globe className="size-5" />}
        title="Web References"
        desc="Up to 3 sites whose style, layout or tone you admire"
        open={open.refs}
        onToggle={() => toggleSection("refs")}
      >
        <p className="text-[13px] leading-[1.6] text-ink-500">
          Opus will analyse these sites — their layout patterns, visual weight, typography hierarchy and tone — then translate that style into your brand&apos;s identity. The content is always 100% yours.
        </p>
        <div className="mt-4 space-y-3">
          {([0, 1, 2] as const).map((i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-paper-100 font-mono text-[12px] font-semibold text-ink-500">
                {i + 1}
              </span>
              <input
                type="url"
                value={setup.refUrls[i]}
                onChange={(e) => setRef(i, e.target.value)}
                placeholder="https://"
                className={cn(inputCls, "h-12 flex-1")}
              />
              {setup.refUrls[i] && (
                <button
                  type="button"
                  onClick={() => setRef(i, "")}
                  className="text-ink-400 hover:text-ink-800"
                  aria-label="Clear URL"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </SectionAccordion>

      {/* ── Build action ─────────────────────────────────────────────────── */}
      <div className={cn(cardCls(), "bg-ink-800 text-paper-0")}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-title text-[17px] font-semibold">Build website</p>
            <p className="mt-1 text-[13px] text-paper-200">
              {setup.refUrls.filter(Boolean).length > 0
                ? `${setup.refUrls.filter(Boolean).length} reference${setup.refUrls.filter(Boolean).length > 1 ? "s" : ""} · `
                : ""}
              Opus plans → Sonnet builds
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-mono text-[13px] text-paper-200">~$0.50 · ~45 sec</p>
              <p className="text-[12px] text-paper-300">per page build</p>
            </div>
            <button
              type="button"
              onClick={onBuild}
              disabled={!canBuild || building}
              className={cn(
                "inline-flex h-12 items-center gap-2 rounded-full px-6 font-semibold",
                motion,
                "bg-brand-500 text-ink-800 hover:bg-brand-600 active:bg-brand-700",
                "disabled:cursor-not-allowed disabled:bg-ink-600 disabled:text-ink-400",
              )}
            >
              {building
                ? <><span className="size-4 animate-spin rounded-full border-2 border-ink-500 border-t-ink-200" /> Building…</>
                : <><Zap className="size-4" /> {lastBuild ? "Rebuild" : "Build"}</>}
            </button>
          </div>
        </div>
        {!canBuild && (
          <p className="mt-4 text-[13px] text-ink-400">
            Select at least one visual style to enable the build.
          </p>
        )}
      </div>

      {/* ── Edit bar (after first build) ─────────────────────────────────── */}
      {lastBuild && (
        <EditBar
          version={lastBuild.version}
          onEdit={onEdit}
          editing={editing}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page wrapper
// ─────────────────────────────────────────────────────────────────────────────

function WebBuilderFor({ project }: { project: Project }) {
  const api = useRoom();
  const [setup, setSetup] = useState<WebSetup>(DEFAULT_SETUP);
  const [building, setBuilding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [lastBuild, setLastBuild] = useState<WebBuild | null>(null);

  if (!project.locked) {
    return (
      <div className={cn("mx-auto max-w-3xl py-10 sm:py-12", pageX)}>
        <PageHeader
          title="Web Builder"
          description={`Website builds for ${project.name}`}
          action={<ProjectSwitcher />}
        />
        <Alert tone="warn">
          Web Builder reads the locked profile. {project.name} is still in intake mode — lock the profile first (<span className="font-mono">/lock</span> in Chat).
        </Alert>
      </div>
    );
  }

  const handleBuild = async () => {
    setBuilding(true);
    try {
      const result = await runWebBuild(project, setup, lastBuild?.version ?? 0);
      if (!result.ok) {
        api.toast(`Build failed: ${result.error}`);
        return;
      }
      setLastBuild(result.build);
      api.toast(`Website v${result.build.version} built for ${project.name}`);
    } finally {
      setBuilding(false);
    }
  };

  const handleEdit = async (prompt: string) => {
    if (!lastBuild) return;
    setEditing(true);
    try {
      const result = await runWebEdit(project, prompt, lastBuild);
      if (!result.ok) {
        api.toast(`Edit failed: ${result.error}`);
        return;
      }
      setLastBuild(result.build);
      api.toast(`Website updated to v${result.build.version}`);
    } finally {
      setEditing(false);
    }
  };

  return (
    <div className={cn("mx-auto max-w-3xl py-10 sm:py-12", pageX)}>
      <PageHeader
        title="Web Builder"
        description={`Design system, sections and references for ${project.name}`}
        action={<ProjectSwitcher />}
      />
      <WebSetupForm
        project={project}
        setup={setup}
        onChange={setSetup}
        onBuild={handleBuild}
        building={building}
        lastBuild={lastBuild}
        onEdit={handleEdit}
        editing={editing}
      />
    </div>
  );
}

export function WebBuilderScreen() {
  const { activeProject } = useRoom();
  if (!activeProject) return <NeedProject what="Web Builder" />;
  return <WebBuilderFor key={activeProject.id} project={activeProject} />;
}
