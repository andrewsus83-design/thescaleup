import {
  AlertTriangle,
  TrendingUp,
  Calendar,
  LayoutTemplate,
  Workflow,
  PenLine,
  Video,
  FileText,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

const leaks = [
  "Landing page tanpa skrip penangkap leads WhatsApp otomatis — perkiraan 40% potensi chat hilang.",
  "Brand tidak muncul di ChatGPT / Perplexity saat calon pembeli cari solusi di kategori Anda.",
  "Repeat order masih manual tanpa pengingat otomatis — LTV pelanggan tertahan.",
];

const levers = [
  { label: "Perbaikan CTA + WA funnel", value: "+35%" },
  { label: "Wireframe landing baru (CR 1.1% → 2.8%)", value: "+Rp 45jt" },
  { label: "GEO / AI Search citation campaign", value: "+Rp 35jt" },
];

const roadmap = [
  {
    phase: "Fase 1",
    window: "Hari 1–14",
    title: "Quick Wins",
    tone: "coral" as const,
    items: ["Pasang WA funnel + CTA baru", "Perbaikan headline & social proof", "Fix on-page SEO kritis"],
    impact: "High",
    effort: "Low",
  },
  {
    phase: "Fase 2",
    window: "Hari 15–45",
    title: "Growth Engine",
    tone: "ember" as const,
    items: ["Eksekusi kalender konten 30 hari", "GEO optimization + schema", "Setup otomatisasi Zernio"],
    impact: "High",
    effort: "Medium",
  },
  {
    phase: "Fase 3",
    window: "Hari 45+",
    title: "Custom Infrastructure",
    tone: "slate" as const,
    items: ["Custom dashboard & CRM", "Auto-affiliate portal", "Integrasi WhatsApp end-to-end"],
    impact: "Very High",
    effort: "High",
  },
];

const deliverables = [
  { icon: Calendar, label: "Kalender konten 30 hari" },
  { icon: LayoutTemplate, label: "Wireframe landing page" },
  { icon: Workflow, label: "Workflow n8n / Zernio" },
  { icon: PenLine, label: "Ad copy Meta & Google" },
  { icon: Video, label: "Script Reels / TikTok" },
  { icon: FileText, label: "Report PDF eksekutif" },
];

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-obsidian/60 px-2 py-0.5 font-mono text-[0.62rem] text-slate-400">
      {label}: <span className="ml-1 text-coral-soft">{value}</span>
    </span>
  );
}

export function SampleReport() {
  return (
    <section id="report" className="relative py-24 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Contoh Report"
          title={
            <>
              Bukan sekadar data. Sebuah{" "}
              <span className="text-gradient-coral">peta eksekusi</span>.
            </>
          }
          subtitle="Setiap report fokus pada tiga hal: apa yang hilang, berapa omzet yang bisa direbut, dan langkah terukur untuk merebutnya."
        />

        <div className="mt-16 grid gap-5 lg:grid-cols-2">
          {/* What's missing */}
          <div className="rounded-3xl border border-bad/20 bg-card/40 p-7">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-bad/25 bg-bad/10 text-bad">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <h3 className="font-display text-xl font-bold text-mist">
                Yang Hilang &amp; Bocor
              </h3>
            </div>
            <ul className="mt-6 space-y-4">
              {leaks.map((l, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-bad/25 bg-bad/10 font-mono text-xs text-bad">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-slate-300">{l}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Revenue booster */}
          <div className="relative overflow-hidden rounded-3xl border border-coral/20 bg-gradient-to-br from-coral/10 via-card/50 to-card/50 p-7">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-coral/25 bg-coral/10 text-coral">
                <TrendingUp className="h-5 w-5" />
              </span>
              <h3 className="font-display text-xl font-bold text-mist">
                Revenue Booster
              </h3>
            </div>
            <div className="mt-6 flex items-end gap-4">
              <div>
                <p className="text-xs text-slate-500">Sekarang</p>
                <p className="font-mono text-lg text-slate-400 line-through">
                  Rp 75jt
                </p>
              </div>
              <div className="pb-1 text-coral">→</div>
              <div>
                <p className="text-xs text-slate-500">Proyeksi</p>
                <p className="font-display text-3xl font-extrabold text-gradient-coral">
                  Rp 180jt
                </p>
              </div>
              <span className="mb-1 ml-auto rounded-full border border-good/30 bg-good/10 px-2.5 py-1 font-mono text-xs text-good">
                +140%
              </span>
            </div>
            <ul className="mt-6 space-y-3">
              {levers.map((lv) => (
                <li
                  key={lv.label}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-obsidian/50 px-4 py-3"
                >
                  <span className="text-sm text-slate-300">{lv.label}</span>
                  <span className="shrink-0 font-mono text-sm font-bold text-coral-soft">
                    {lv.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Roadmap */}
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          {roadmap.map((p) => (
            <div
              key={p.phase}
              className="flex flex-col rounded-3xl border border-white/8 bg-card/40 p-6"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold tracking-widest text-coral">
                  {p.phase}
                </span>
                <span className="font-mono text-[0.68rem] text-slate-500">
                  {p.window}
                </span>
              </div>
              <h4 className="mt-2 font-display text-lg font-bold text-mist">
                {p.title}
              </h4>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <MetricPill label="Impact" value={p.impact} />
                <MetricPill label="Effort" value={p.effort} />
              </div>
              <ul className="mt-5 space-y-2.5">
                {p.items.map((it) => (
                  <li
                    key={it}
                    className="flex items-start gap-2.5 text-sm text-slate-300"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Deliverables */}
        <div className="mt-12 rounded-3xl border border-white/8 bg-surface/40 p-7">
          <p className="eyebrow mb-5 text-center text-slate-500">
            Aset done-for-you di setiap Growth Pro report
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {deliverables.map((d) => {
              const Icon = d.icon;
              return (
                <div
                  key={d.label}
                  className="flex flex-col items-center gap-2.5 rounded-2xl border border-white/5 bg-card/40 p-4 text-center transition-colors hover:border-coral/25"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-coral/10 text-coral">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs leading-tight text-slate-400">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}
