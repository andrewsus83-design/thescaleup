"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getClientMember } from "@/lib/client/auth";
import { loadBooking, availability } from "./data";

function waHref(whatsapp: string, msg: string): string | null {
  const digits = (whatsapp ?? "").replace(/[^0-9]/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}` : null;
}

export type BookingInput = {
  service: string;
  date: string;
  time: string;
  name: string;
  whatsapp: string;
  email?: string;
  notes?: string;
};

/** PUBLIC — a visitor reserves a slot. Validates against live availability. */
export async function createBooking(
  memberId: string,
  input: BookingInput,
): Promise<{ ok: boolean; error?: string; waHref?: string | null }> {
  const info = await loadBooking(memberId);
  if (!info) return { ok: false, error: "Booking belum tersedia." };

  const name = String(input.name ?? "").trim();
  const whatsapp = String(input.whatsapp ?? "").trim();
  const service = String(input.service ?? "").trim();
  const date = String(input.date ?? "").trim();
  const time = String(input.time ?? "").trim();
  if (!name || !whatsapp) return { ok: false, error: "Nama & WhatsApp wajib diisi." };
  if (!/^\+?[0-9\s-]{7,20}$/.test(whatsapp)) return { ok: false, error: "Nomor WhatsApp tidak valid." };

  // Re-validate the slot against current availability (capacity, window, past).
  const avail = await availability(memberId, info.settings);
  const day = avail.find((a) => a.date === date);
  if (!day || !day.times.includes(time)) {
    return { ok: false, error: "Slot tersebut sudah tidak tersedia. Pilih waktu lain." };
  }
  const validService = info.settings.services.some((s) => s.name === service);

  const db = createSupabaseAdminClient();
  const status = info.settings.confirmation === "request" ? "pending" : "confirmed";
  const { error } = await db.from("bookings").insert({
    member_id: memberId,
    service: validService ? service : info.settings.services[0]?.name ?? "Reservasi",
    date,
    time,
    name,
    whatsapp,
    email: String(input.email ?? "").trim() || null,
    notes: String(input.notes ?? "").trim() || null,
    status,
  });
  if (error) {
    return { ok: false, error: `${error.message} — pastikan migrasi 'bookings' sudah dijalankan.` };
  }

  revalidatePath(`/book/${memberId}`);
  revalidatePath(`/dashboard/app/booking`);
  const msg = `Halo ${info.brand}, saya ${name} sudah booking ${service} pada ${date} jam ${time}.`;
  return { ok: true, waHref: waHref(info.whatsapp, msg) };
}

/** OWNER (internal client) — confirm or cancel a booking from the dashboard. */
export async function setBookingStatus(
  id: string,
  status: string,
): Promise<{ ok: boolean }> {
  const m = await getClientMember();
  if (!m) return { ok: false };
  if (!["confirmed", "cancelled", "pending"].includes(status)) return { ok: false };
  const db = createSupabaseAdminClient();
  await db.from("bookings").update({ status }).eq("id", id).eq("member_id", m.id);
  revalidatePath("/dashboard/app/booking");
  return { ok: true };
}
