"use client";

import { useState, useTransition } from "react";
import { Check, X, ExternalLink, Copy, CheckCheck } from "lucide-react";
import { setBookingStatus } from "@/lib/booking/actions";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  service: string | null;
  date: string;
  time: string;
  name: string;
  whatsapp: string | null;
  status: string;
};

function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
    pending: "border-amber-200 bg-amber-50 text-amber-700",
    cancelled: "border-red-200 bg-red-50 text-red-600 line-through",
  };
  const label: Record<string, string> = { confirmed: "Terkonfirmasi", pending: "Menunggu", cancelled: "Batal" };
  return (
    <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", map[status] ?? "border-slate-200 text-slate-500")}>
      {label[status] ?? status}
    </span>
  );
}

export function BookingDashboard({ rows, shareUrl }: { rows: Row[]; shareUrl: string }) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [list, setList] = useState(rows);

  const act = (id: string, status: string) => {
    setList((l) => l.map((r) => (r.id === id ? { ...r, status } : r)));
    start(async () => {
      await setBookingStatus(id, status);
    });
  };
  const copy = () => {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="space-y-4">
      {/* share link */}
      <div className="rounded-2xl border border-coral/15 bg-gradient-to-br from-coral/10 via-card/40 to-card/40 p-5">
        <p className="mb-2 font-mono text-xs uppercase tracking-wider text-slate-500">Link booking publik</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 truncate rounded-lg border border-white/10 bg-obsidian/50 px-3 py-2 text-xs text-slate-300">{shareUrl}</code>
          <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10">
            {copied ? <CheckCheck className="h-3.5 w-3.5 text-good" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Tersalin" : "Salin"}
          </button>
          <a href={shareUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-coral to-sunset px-3 py-2 text-xs font-semibold text-white hover:brightness-110">
            <ExternalLink className="h-3.5 w-3.5" /> Buka
          </a>
        </div>
        <p className="mt-2 text-xs text-slate-500">Bagikan link ini di bio Instagram, WhatsApp, atau website Anda agar pelanggan bisa booking sendiri.</p>
      </div>

      {/* bookings */}
      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-wider text-slate-500">Reservasi masuk ({list.length})</p>
        {list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-card/20 px-6 py-12 text-center text-sm text-slate-500">
            Belum ada reservasi. Bagikan link booking Anda di atas.
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((r) => (
              <div key={r.id} className={cn("flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-card/40 px-4 py-3", pending && "opacity-70")}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100">
                    {r.name} <span className="text-slate-500">· {r.service}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {r.date} · {r.time}{r.whatsapp ? ` · ${r.whatsapp}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge status={r.status} />
                  {r.status !== "confirmed" && (
                    <button onClick={() => act(r.id, "confirmed")} className="inline-flex items-center rounded-lg border border-good/25 bg-good/10 px-2 py-1.5 text-xs text-good hover:bg-good/20" title="Konfirmasi">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {r.status !== "cancelled" && (
                    <button onClick={() => act(r.id, "cancelled")} className="inline-flex items-center rounded-lg border border-bad/25 bg-bad/10 px-2 py-1.5 text-xs text-bad hover:bg-bad/20" title="Batalkan">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
