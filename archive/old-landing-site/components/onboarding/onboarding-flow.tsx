"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CornerDownLeft,
  Sparkles,
  Loader2,
  X,
} from "lucide-react";
import { Logo } from "@/components/landing/logo";
import { cn } from "@/lib/utils";

/* ---------------------------------- schema --------------------------------- */

type TextField = {
  kind: "text";
  key: string;
  label: string;
  placeholder?: string;
  inputType?: "text" | "email" | "tel" | "url";
  prefix?: string;
  required?: boolean;
};

type ChoiceField = {
  kind: "choice";
  key: string;
  label?: string;
  required?: boolean;
  options: { value: string; hint?: string }[];
};

type TextareaField = {
  kind: "textarea";
  key: string;
  label?: string;
  placeholder?: string;
};

type Field = TextField | ChoiceField | TextareaField;

type Step = {
  kicker: string;
  title: string;
  subtitle?: string;
  fields: Field[];
  /** at least one of these keys must be filled */
  anyOf?: string[];
};

const STEPS: Step[] = [
  {
    kicker: "Kenalan dulu",
    title: "Siapa di balik bisnis ini?",
    subtitle: "Biar tim kami tahu harus menghubungi siapa.",
    fields: [
      { kind: "text", key: "name", label: "Nama Anda", placeholder: "Andi Wijaya", required: true },
      { kind: "text", key: "business", label: "Nama bisnis / brand", placeholder: "Kopi Nusantara", required: true },
      { kind: "text", key: "whatsapp", label: "Nomor WhatsApp", placeholder: "812 3456 7890", inputType: "tel", prefix: "+62", required: true },
      { kind: "text", key: "email", label: "Email (opsional)", placeholder: "andi@bisnis.com", inputType: "email" },
    ],
  },
  {
    kicker: "Jejak digital",
    title: "Di mana kami bisa lihat bisnismu?",
    subtitle: "Cukup isi yang ada. Website atau salah satu sosial media sudah cukup untuk kami mulai.",
    anyOf: ["website", "instagram", "tiktok"],
    fields: [
      { kind: "text", key: "website", label: "Website", placeholder: "bisnisanda.com", inputType: "url" },
      { kind: "text", key: "instagram", label: "Instagram", placeholder: "@bisnisanda", prefix: "@" },
      { kind: "text", key: "tiktok", label: "TikTok / lainnya", placeholder: "@bisnisanda", prefix: "@" },
    ],
  },
  {
    kicker: "Peta persaingan",
    title: "Siapa 2 kompetitor utamamu?",
    subtitle: "Kami akan bandingkan posisimu dengan mereka — di web, sosial media, dan AI Search.",
    fields: [
      { kind: "text", key: "competitor1", label: "Kompetitor #1", placeholder: "kompetitor1.com atau @handle" },
      { kind: "text", key: "competitor2", label: "Kompetitor #2 (opsional)", placeholder: "kompetitor2.com atau @handle" },
    ],
  },
  {
    kicker: "Konteks bisnis",
    title: "Ceritakan sedikit soal bisnismu.",
    fields: [
      {
        kind: "choice",
        key: "category",
        label: "Model bisnis",
        required: true,
        options: [
          { value: "E-commerce / Online Shop" },
          { value: "Jasa / Layanan Lokal" },
          { value: "B2B / Korporat" },
          { value: "B2C / Brand Konsumen" },
        ],
      },
      {
        kind: "choice",
        key: "goal",
        label: "Goal utama 6 bulan ke depan",
        required: true,
        options: [
          { value: "Naikkan omzet 2x lipat" },
          { value: "Perbanyak leads & closing" },
          { value: "Rapikan infrastruktur digital" },
          { value: "Bangun brand & awareness" },
        ],
      },
      {
        kind: "choice",
        key: "budget",
        label: "Budget marketing per bulan",
        options: [
          { value: "< Rp 5 juta" },
          { value: "Rp 5 – 20 juta" },
          { value: "Rp 20 – 50 juta" },
          { value: "> Rp 50 juta" },
        ],
      },
    ],
  },
  {
    kicker: "Titik macet",
    title: "Apa tantangan terbesarmu sekarang?",
    fields: [
      {
        kind: "choice",
        key: "bottleneck",
        required: true,
        options: [
          { value: "Traffic ada, tapi sepi closing" },
          { value: "Susah ditemukan calon pembeli online" },
          { value: "Operasional manual & kewalahan" },
          { value: "Iklan mahal, ROI tipis" },
          { value: "Belum punya sistem / tim tech" },
        ],
      },
      {
        kind: "textarea",
        key: "notes",
        label: "Ada hal lain yang ingin kami tahu? (opsional)",
        placeholder: "Ceritakan sebebasnya...",
      },
    ],
  },
];

const TOTAL = STEPS.length;
type FormData = Record<string, string>;

/* --------------------------------- component -------------------------------- */

export function OnboardingFlow() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const current = STEPS[step];
  const set = (key: string, value: string) =>
    setData((d) => ({ ...d, [key]: value }));

  const validate = useCallback((): boolean => {
    const s = STEPS[step];
    for (const f of s.fields) {
      if ("required" in f && f.required && !(data[f.key]?.trim())) {
        setError("Mohon lengkapi bagian yang wajib diisi.");
        return false;
      }
    }
    if (s.anyOf && !s.anyOf.some((k) => data[k]?.trim())) {
      setError("Isi minimal salah satu (website atau sosial media).");
      return false;
    }
    setError(null);
    return true;
  }, [step, data]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    try {
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {
      /* resilient: never block the thank-you */
    } finally {
      setSubmitting(false);
      setDone(true);
    }
  }, [data]);

  const next = useCallback(() => {
    if (!validate()) return;
    if (step < TOTAL - 1) {
      setStep((s) => s + 1);
    } else {
      void submit();
    }
  }, [validate, step, submit]);

  const back = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const progress = useMemo(
    () => (done ? 100 : (step / TOTAL) * 100),
    [step, done],
  );

  if (done) return <ThankYou name={data.name} />;

  return (
    <div className="relative flex min-h-screen flex-col bg-hero-glow">
      <div className="pointer-events-none absolute inset-0 bg-grid-lines [mask-image:radial-gradient(70%_60%_at_50%_30%,#000,transparent)]" />

      {/* top bar */}
      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" aria-label="ScaleUp">
          <Logo />
        </Link>
        <Link
          href="/"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-slate-400 transition-colors hover:text-white"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </Link>
      </header>

      {/* progress */}
      <div className="relative z-10 h-1 w-full bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-coral to-ember transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* body */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
        <div key={step} className="animate-fade-up w-full max-w-2xl">
          <div className="mb-2 flex items-center gap-3">
            <span className="font-mono text-xs font-bold tracking-widest text-coral">
              {String(step + 1).padStart(2, "0")}
              <span className="text-slate-600"> / {String(TOTAL).padStart(2, "0")}</span>
            </span>
            <span className="eyebrow text-slate-500">{current.kicker}</span>
          </div>

          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-mist sm:text-4xl">
            {current.title}
          </h1>
          {current.subtitle && (
            <p className="mt-3 text-base text-slate-400">{current.subtitle}</p>
          )}

          <div className="mt-8 space-y-5">
            {current.fields.map((f) => (
              <FieldRenderer
                key={f.key}
                field={f}
                value={data[f.key] ?? ""}
                onChange={(v) => {
                  set(f.key, v);
                  if (error) setError(null);
                }}
                onEnter={next}
              />
            ))}
          </div>

          {error && (
            <p className="mt-4 text-sm text-bad animate-fade-in">{error}</p>
          )}

          {/* nav */}
          <div className="mt-9 flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={back}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/10 px-5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali
              </button>
            )}
            <button
              onClick={next}
              disabled={submitting}
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-br from-coral-soft via-coral to-sunset px-7 font-display font-semibold text-white glow-coral transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mengirim...
                </>
              ) : step < TOTAL - 1 ? (
                <>
                  Lanjut
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              ) : (
                <>
                  Kirim &amp; Jadwalkan
                  <Sparkles className="h-4 w-4" />
                </>
              )}
            </button>
            <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:inline-flex">
              tekan <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono"><CornerDownLeft className="inline h-3 w-3" /></kbd>
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------- field renderer ----------------------------- */

function FieldRenderer({
  field,
  value,
  onChange,
  onEnter,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
}) {
  if (field.kind === "text") {
    return (
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-300">
          {field.label}
          {field.required && <span className="text-coral"> *</span>}
        </span>
        <div className="flex items-center rounded-2xl border border-white/10 bg-card/50 transition-colors focus-within:border-coral/50 focus-within:ring-2 focus-within:ring-coral/20">
          {field.prefix && (
            <span className="pl-4 font-mono text-sm text-slate-500">
              {field.prefix}
            </span>
          )}
          <input
            type={field.inputType ?? "text"}
            value={value}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEnter();
              }
            }}
            className="w-full bg-transparent px-4 py-3.5 text-base text-mist placeholder:text-slate-600 focus:outline-none"
          />
        </div>
      </label>
    );
  }

  if (field.kind === "textarea") {
    return (
      <label className="block">
        {field.label && (
          <span className="mb-2 block text-sm font-medium text-slate-300">
            {field.label}
          </span>
        )}
        <textarea
          value={value}
          placeholder={field.placeholder}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-none rounded-2xl border border-white/10 bg-card/50 px-4 py-3.5 text-base text-mist placeholder:text-slate-600 transition-colors focus:border-coral/50 focus:outline-none focus:ring-2 focus:ring-coral/20"
        />
      </label>
    );
  }

  // choice
  return (
    <div>
      {field.label && (
        <span className="mb-3 block text-sm font-medium text-slate-300">
          {field.label}
          {field.required && <span className="text-coral"> *</span>}
        </span>
      )}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {field.options.map((opt, i) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "group flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all",
                active
                  ? "border-coral/60 bg-coral/10 ring-1 ring-coral/30"
                  : "border-white/10 bg-card/40 hover:border-coral/30 hover:bg-card/70",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono text-xs transition-colors",
                  active
                    ? "border-coral bg-coral text-white"
                    : "border-white/15 text-slate-500 group-hover:border-coral/40",
                )}
              >
                {active ? <Check className="h-4 w-4" /> : String.fromCharCode(65 + i)}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  active ? "text-mist" : "text-slate-300",
                )}
              >
                {opt.value}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------- thank you -------------------------------- */

function ThankYou({ name }: { name?: string }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-hero-glow px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(50%_50%_at_50%_45%,#000,transparent)] opacity-50" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-coral/20 blur-[120px] animate-pulse-glow" />

      <div className="relative z-10 flex max-w-xl flex-col items-center animate-fade-up">
        <span className="inline-flex h-20 w-20 items-center justify-center rounded-3xl border border-coral/30 bg-coral/10 text-coral glow-coral">
          <Sparkles className="h-9 w-9" />
        </span>

        <h1 className="mt-8 font-display text-4xl font-extrabold tracking-tight text-mist sm:text-5xl">
          Terima kasih{name ? `, ${name.split(" ")[0]}` : ""}! 🎉
        </h1>

        <p className="mt-5 text-lg leading-relaxed text-slate-300">
          Info bisnis Anda sudah kami terima. Tim kami akan segera menghubungi
          Anda untuk langkah selanjutnya.
        </p>

        <p className="mt-6 font-art text-2xl font-semibold text-gradient-coral">
          Something great is brewing.
        </p>
        <p className="mt-1 text-slate-400">
          Jangan lupa untuk scale up bersama kami!
        </p>

        <Link
          href="/"
          className="mt-10 inline-flex h-12 items-center gap-2 rounded-full border border-white/15 px-6 font-display font-semibold text-mist transition-colors hover:bg-white/5"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}
