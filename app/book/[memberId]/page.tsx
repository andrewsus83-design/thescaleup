import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadBooking, availability } from "@/lib/booking/data";
import { BookingWidget } from "@/components/booking/booking-widget";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ memberId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { memberId } = await params;
  const info = await loadBooking(memberId);
  return {
    title: info ? `Booking — ${info.brand}` : "Booking",
    robots: { index: false, follow: false },
  };
}

export default async function BookPage({ params }: Params) {
  const { memberId } = await params;
  const info = await loadBooking(memberId);
  if (!info) notFound();
  const avail = await availability(memberId, info.settings);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-5 text-center">
          <h1 className="font-display text-2xl font-extrabold text-slate-900">{info.brand}</h1>
          <p className="mt-1 text-sm text-slate-500">Pilih layanan &amp; jadwal untuk reservasi Anda.</p>
        </div>
        <BookingWidget
          memberId={memberId}
          brand={info.brand}
          services={info.settings.services}
          availability={avail}
        />
        <p className="mt-4 text-center text-xs text-slate-400">Ditenagai ScaleUp</p>
      </div>
    </main>
  );
}
