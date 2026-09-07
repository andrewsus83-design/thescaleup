"use client";

import { useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Check,
  Loader2,
  Sparkles,
  Save,
  Lock,
  Plus,
  Trash2,
  Link2,
} from "lucide-react";
import type { BuilderConfig, BuilderField } from "@/lib/builders/wizard-types";
import { saveBuilderProject } from "@/lib/admin/builder-actions";
import { cn } from "@/lib/utils";

type Data = Record<string, unknown>;

function keyOf(f: BuilderField, i: number, step: number) {
  return f.key || `f_${step}_${i}`;
}

function FieldView({
  field,
  fkey,
  value,
  set,
}: {
  field: BuilderField;
  fkey: string;
  value: unknown;
  set: (v: unknown) => void;
}) {
  const label = (
    <span className="mb-1.5 block text-sm font-medium text-slate-300">
      {field.label}
    </span>
  );
  const hint = field.hint ? (
    <p className="mt-1 text-xs text-slate-500">{field.hint}</p>
  ) : null;
  const inputCls =
    "w-full rounded-xl border border-white/10 bg-obsidian/50 px-3.5 py-2.5 text-sm text-mist placeholder:text-slate-600 focus:border-coral/50 focus:outline-none";

  switch (field.type) {
    case "info":
      return (
        <div className="rounded-xl border border-coral/15 bg-coral/5 p-4">
          <p className="text-sm font-medium text-slate-200">{field.label}</p>
          {field.hint && (
            <p className="mt-1 text-sm leading-relaxed text-slate-400">
              {field.hint}
            </p>
          )}
        </div>
      );
    case "textarea":
      return (
        <label className="block">
          {label}
          <textarea
            rows={3}
            value={String(value ?? "")}
            placeholder={field.placeholder}
            onChange={(e) => set(e.target.value)}
            className={cn(inputCls, "resize-none")}
          />
          {hint}
        </label>
      );
    case "color":
      return (
        <label className="block">
          {label}
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={String(value || "#FF5733")}
              onChange={(e) => set(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded-lg border border-white/10 bg-transparent"
            />
            <input
              type="text"
              value={String(value ?? "")}
              placeholder="#FF5733"
              onChange={(e) => set(e.target.value)}
              className={cn(inputCls, "font-mono")}
            />
          </div>
          {hint}
        </label>
      );
    case "image":
      return (
        <label className="block">
          {label}
          <input
            type="url"
            value={String(value ?? "")}
            placeholder={field.placeholder || "https://…/logo.png"}
            onChange={(e) => set(e.target.value)}
            className={inputCls}
          />
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={String(value)}
              alt=""
              className="mt-2 h-16 rounded-lg border border-white/10 object-contain"
            />
          ) : null}
          {hint}
        </label>
      );
    case "select":
      return (
        <label className="block">
          {label}
          <select
            value={String(value ?? "")}
            onChange={(e) => set(e.target.value)}
            className={inputCls}
          >
            <option value="">— pilih —</option>
            {(field.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {hint}
        </label>
      );
    case "toggle":
      return (
        <button
          type="button"
          onClick={() => set(!value)}
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-obsidian/50 px-4 py-3 text-left"
        >
          <span>
            <span className="text-sm font-medium text-slate-200">
              {field.label}
            </span>
            {field.hint && (
              <span className="mt-0.5 block text-xs text-slate-500">
                {field.hint}
              </span>
            )}
          </span>
          <span
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              value ? "bg-coral" : "bg-white/15",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                value ? "translate-x-5" : "translate-x-0.5",
              )}
            />
          </span>
        </button>
      );
    case "radio":
    case "cards":
    case "multiselect": {
      const multi = field.type === "multiselect";
      const arr = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (v: string) => {
        if (multi) {
          set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
        } else set(v);
      };
      const active = (v: string) => (multi ? arr.includes(v) : value === v);
      return (
        <div>
          {label}
          <div className="grid gap-2.5 sm:grid-cols-2">
            {(field.options ?? []).map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                  active(o.value)
                    ? "border-coral/60 bg-coral/10 ring-1 ring-coral/30"
                    : "border-white/10 bg-card/40 hover:border-coral/30",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                    active(o.value)
                      ? "border-coral bg-coral text-white"
                      : "border-white/15",
                  )}
                >
                  {active(o.value) && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className="text-sm font-medium text-slate-200">
                    {o.label}
                  </span>
                  {o.desc && (
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {o.desc}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
          {hint}
        </div>
      );
    }
    case "stages": {
      const arr: string[] =
        Array.isArray(value) && value.length
          ? (value as string[])
          : (field.options ?? []).map((o) => o.label);
      const commit = (next: string[]) => set(next);
      const rename = (i: number, v: string) => {
        const n = [...arr];
        n[i] = v;
        commit(n);
      };
      const move = (i: number, dir: number) => {
        const j = i + dir;
        if (j < 0 || j >= arr.length) return;
        const n = [...arr];
        [n[i], n[j]] = [n[j], n[i]];
        commit(n);
      };
      const iconBtn =
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:bg-white/5 disabled:opacity-30";
      return (
        <div>
          {label}
          <div className="space-y-2">
            {arr.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-obsidian/50 px-2.5 py-2"
              >
                <span className="w-14 shrink-0 font-mono text-[0.66rem] uppercase text-coral">
                  Step {i + 1}
                </span>
                <input
                  value={s}
                  onChange={(e) => rename(i, e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm text-mist focus:outline-none"
                />
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={iconBtn}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === arr.length - 1} className={iconBtn}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => commit(arr.filter((_, x) => x !== i))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-bad/20 text-bad hover:bg-bad/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => commit([...arr, "Tahap baru"])}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
          >
            <Plus className="h-3.5 w-3.5" /> Tambah tahap
          </button>
          {hint}
        </div>
      );
    }
    case "sourcelinks": {
      const val =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, string>)
          : {};
      const on = (v: string) => Object.prototype.hasOwnProperty.call(val, v);
      const toggle = (v: string) => {
        const n = { ...val };
        if (on(v)) delete n[v];
        else n[v] = "";
        set(n);
      };
      return (
        <div>
          {label}
          <div className="space-y-2">
            {(field.options ?? []).map((o) => (
              <div
                key={o.value}
                className="rounded-xl border border-white/10 bg-obsidian/50 p-2.5"
              >
                <button
                  type="button"
                  onClick={() => toggle(o.value)}
                  className="flex w-full items-center gap-2.5 text-left"
                >
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                      on(o.value) ? "border-coral bg-coral text-white" : "border-white/15",
                    )}
                  >
                    {on(o.value) && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="text-sm font-medium text-slate-200">{o.label}</span>
                </button>
                {on(o.value) && (
                  <div className="mt-2 flex items-center gap-2 pl-7">
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <input
                      type="url"
                      value={val[o.value] ?? ""}
                      onChange={(e) => set({ ...val, [o.value]: e.target.value })}
                      placeholder="Link akun / halaman / integrasi (opsional)"
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-obsidian/70 px-3 py-1.5 text-xs text-mist placeholder:text-slate-600 focus:border-coral/50 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          {hint}
        </div>
      );
    }
    default:
      return (
        <label className="block">
          {label}
          <input
            type={field.type === "url" ? "url" : "text"}
            value={String(value ?? "")}
            placeholder={field.placeholder}
            onChange={(e) => set(e.target.value)}
            className={inputCls}
          />
          {hint}
        </label>
      );
  }
}

export function BuilderWizard({
  memberId,
  memberName,
  config,
  initialData,
  onSave,
}: {
  memberId: string;
  memberName: string;
  config: BuilderConfig;
  initialData: Data;
  onSave?: (
    memberId: string,
    builder: string,
    data: Data,
    status?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Data>(initialData ?? {});
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const total = config.steps.length;
  const current = config.steps[step];
  const set = (k: string, v: unknown) => setData((d) => ({ ...d, [k]: v }));
  const doSave = onSave ?? saveBuilderProject;

  const save = (status: string) =>
    start(async () => {
      const r = await doSave(memberId, config.slug, data, status);
      if (!r.ok && r.error) window.alert(r.error);
      else setSavedAt(new Date().toLocaleTimeString("id-ID"));
    });

  return (
    <div>
      {/* stepper */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {config.steps.map((s, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              i === step
                ? "border-coral/50 bg-coral/10 text-coral"
                : i < step
                  ? "border-good/25 bg-good/5 text-good"
                  : "border-white/10 text-slate-400 hover:bg-white/5",
            )}
          >
            <span className="font-mono">{i + 1}</span>
            {s.title}
            {s.auto && <Lock className="h-3 w-3" />}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/8 bg-card/40 p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-mist">
              {current.title}
            </h2>
            {current.subtitle && (
              <p className="mt-1 text-sm text-slate-400">{current.subtitle}</p>
            )}
          </div>
          {current.auto && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-coral/25 bg-coral/10 px-2.5 py-1 text-xs text-coral-soft">
              <Sparkles className="h-3.5 w-3.5" /> Otomatis
            </span>
          )}
        </div>

        {current.auto && (
          <p className="mb-5 rounded-xl border border-coral/15 bg-coral/5 px-4 py-3 text-sm text-slate-300">
            Langkah ini dikerjakan otomatis oleh ScaleUp — klien tidak perlu
            mengisi apa pun.
          </p>
        )}

        <div className="space-y-5">
          {current.fields.map((f, i) => {
            const k = keyOf(f, i, step);
            return (
              <FieldView
                key={k}
                field={f}
                fkey={k}
                value={data[k]}
                set={(v) => set(k, v)}
              />
            );
          })}
        </div>
      </div>

      {/* nav */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 px-5 text-sm font-medium text-slate-300 hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali
          </button>
        )}
        <button
          onClick={() => save("draft")}
          disabled={pending}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 px-5 text-sm font-medium text-slate-300 hover:bg-white/5 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan draft
        </button>
        {step < total - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            className="group inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-br from-coral to-sunset px-6 font-display font-semibold text-white hover:brightness-110"
          >
            Lanjut <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : (
          <button
            onClick={() => save("submitted")}
            disabled={pending}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-br from-coral to-sunset px-6 font-display font-semibold text-white hover:brightness-110 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Simpan &amp; Selesai
          </button>
        )}
        {savedAt && (
          <span className="text-xs text-good">Tersimpan {savedAt}</span>
        )}
      </div>
    </div>
  );
}
