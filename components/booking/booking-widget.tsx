"use client";

import { useState, useTransition } from "react";
import { Check, Clock, CalendarDays, Loader2, ArrowLeft, MessageCircle } from "lucide-react";
import { createBooking, type BookingInput } from "@/lib/booking/actions";

type Service = { name: string; duration: number };
type Day = { date: string; label: string; times: string[] };

export function BookingWidget({
  memberId,
  brand,
  primary = "#0EA5A4",
  services,
  availability,
}: {
  memberId: string;
  brand: string;
  primary?: string;
  services: Service[];
  availability: Day[];
}) {
  const [step, setStep] = useState<"service" | "time" | "form" | "done">(
    services.length > 1 ? "service" : "time",
  );
  const [service, setService] = useState<Service | null>(services.length === 1 ? services[0] : null);
  const [date, setDate] = useState<Day | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", whatsapp: "", email: "", notes: "" });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [waHref, setWaHref] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = () => {
    setError(null);
    if (!service || !date || !time) return;
    const input: BookingInput = { service: service.name, date: date.date, time, ...form };
    start(async () => {
      const r = await createBooking(memberId, input);
      if (r.ok) {
        setWaHref(r.waHref ?? null);
        setStep("done");
      } else {
        setError(r.error ?? "Gagal membuat booking.");
      }
    });
  };

  const chip = (active: boolean) =>
    active
      ? { backgroundColor: primary, color: "#fff", borderColor: primary }
      : { borderColor: "#e2e8f0", color: "#334155" };

  if (availability.length === 0 && step !== "done") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Belum ada slot tersedia saat ini. Silakan hubungi kami langsung.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* progress header */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 text-xs font-medium text-slate-400">
        <span style={{ color: step === "service" ? primary : undefined }}>1. Layanan</span>
        <span>›</span>
        <span style={{ color: step === "time" ? primary : undefined }}>2. Jadwal</span>
        <span>›</span>
        <span style={{ color: step === "form" || step === "done" ? primary : undefined }}>3. Data</span>
      </div>

      <div className="p-5">
        {step === "service" && (
          <div className="space-y-2">
            <p className="mb-3 font-display text-lg font-bold text-slate-900">Pilih layanan</p>
            {services.map((s) => (
              <button
                key={s.name}
                onClick={() => { setService(s); setStep("time"); }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-slate-300"
              >
                <span className="font-medium text-slate-800">{s.name}</span>
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="h-3.5 w-3.5" /> {s.duration} mnt
                </span>
              </button>
            ))}
          </div>
        )}

        {step === "time" && (
          <div>
            {services.length > 1 && (
              <button onClick={() => setStep("service")} className="mb-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700">
                <ArrowLeft className="h-3.5 w-3.5" /> Ganti layanan{service ? ` (${service.name})` : ""}
              </button>
            )}
            <p className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-slate-900">
              <CalendarDays className="h-5 w-5" style={{ color: primary }} /> Pilih tanggal
            </p>
            <div className="flex flex-wrap gap-2">
              {availability.map((d) => (
                <button
                  key={d.date}
                  onClick={() => { setDate(d); setTime(null); }}
                  className="rounded-xl border px-3 py-2 text-sm font-medium transition-colors"
                  style={chip(date?.date === d.date)}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {date && (
              <>
                <p className="mb-2 mt-5 flex items-center gap-2 font-display text-lg font-bold text-slate-900">
                  <Clock className="h-5 w-5" style={{ color: primary }} /> Pilih jam
                </p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {date.times.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTime(t)}
                      className="rounded-lg border px-2 py-2 text-sm font-medium transition-colors"
                      style={chip(time === t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}

            {date && time && (
              <button
                onClick={() => setStep("form")}
                className="mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
                style={{ backgroundColor: primary }}
              >
                Lanjut — {date.label}, {time}
              </button>
            )}
          </div>
        )}

        {step === "form" && service && date && time && (
          <div className="space-y-3">
            <button onClick={() => setStep("time")} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700">
              <ArrowLeft className="h-3.5 w-3.5" /> Ganti jadwal
            </button>
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              <b className="text-slate-900">{service.name}</b> · {date.label} · {time}
            </div>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nama lengkap *" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none" />
            <input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="No. WhatsApp *" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none" />
            <input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="Email (opsional)" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none" />
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Catatan (opsional)" className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none" />
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <button
              onClick={submit}
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: primary }}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Konfirmasi Booking
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: `${primary}22`, color: primary }}>
              <Check className="h-7 w-7" />
            </div>
            <p className="mt-4 font-display text-xl font-bold text-slate-900">Booking Terkirim!</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
              Terima kasih. {brand} akan mengonfirmasi jadwal Anda. Simpan detail booking Anda.
            </p>
            {waHref && (
              <a href={waHref} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white" style={{ backgroundColor: primary }}>
                <MessageCircle className="h-4 w-4" /> Konfirmasi via WhatsApp
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
