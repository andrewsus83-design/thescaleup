import "server-only";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";
import {
  parseSettings,
  daySlots,
  parseTime,
  labelDate,
  type BookingSettings,
} from "./config";

const pad = (n: number) => String(n).padStart(2, "0");

export type BookingInfo = {
  brand: string;
  whatsapp: string;
  settings: BookingSettings;
};

/** Load a member's booking config (from the Booking builder). null if absent. */
export async function loadBooking(memberId: string): Promise<BookingInfo | null> {
  if (!isSupabaseAdminConfigured()) return null;
  try {
    const db = createSupabaseAdminClient();
    const [{ data: member }, { data: project }] = await Promise.all([
      db.from("leads").select("business, name, whatsapp").eq("id", memberId).maybeSingle(),
      db.from("builder_projects").select("data").eq("member_id", memberId).eq("builder", "booking").maybeSingle(),
    ]);
    if (!member || !project?.data) return null;
    return {
      brand: (member.business as string) || (member.name as string) || "Booking",
      whatsapp: (member.whatsapp as string) || "",
      settings: parseSettings(project.data as Record<string, unknown>),
    };
  } catch {
    return null;
  }
}

export type DayAvailability = { date: string; label: string; times: string[] };

/** Compute available dates+times for the booking window (Asia/Jakarta). */
export async function availability(
  memberId: string,
  settings: BookingSettings,
): Promise<DayAvailability[]> {
  const nowWib = new Date(Date.now() + 7 * 3600 * 1000);
  const y = nowWib.getUTCFullYear();
  const mo = nowWib.getUTCMonth();
  const d = nowWib.getUTCDate();
  const nowMin = nowWib.getUTCHours() * 60 + nowWib.getUTCMinutes();
  const todayStr = `${y}-${pad(mo + 1)}-${pad(d)}`;

  const candidates: { date: string }[] = [];
  for (let i = 0; i <= settings.windowDays; i++) {
    const dt = new Date(Date.UTC(y, mo, d + i));
    if (settings.days.includes(dt.getUTCDay())) {
      candidates.push({ date: `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}` });
    }
  }
  if (candidates.length === 0) return [];

  // Booked counts across the window.
  const counts = new Map<string, number>();
  const perDay = new Map<string, number>();
  if (isSupabaseAdminConfigured()) {
    try {
      const db = createSupabaseAdminClient();
      const last = candidates[candidates.length - 1].date;
      const { data } = await db
        .from("bookings")
        .select("date, time, status")
        .eq("member_id", memberId)
        .gte("date", todayStr)
        .lte("date", last)
        .neq("status", "cancelled");
      for (const b of data ?? []) {
        const key = `${b.date} ${b.time}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
        perDay.set(b.date as string, (perDay.get(b.date as string) ?? 0) + 1);
      }
    } catch {
      /* treat as empty */
    }
  }

  const slots = daySlots(settings);
  const out: DayAvailability[] = [];
  for (const c of candidates) {
    if (settings.maxPerDay && (perDay.get(c.date) ?? 0) >= settings.maxPerDay) continue;
    const times = slots.filter((t) => {
      if ((counts.get(`${c.date} ${t}`) ?? 0) >= settings.capacity) return false;
      if (c.date === todayStr) {
        const tm = parseTime(t);
        if (tm != null && tm <= nowMin) return false;
      }
      return true;
    });
    if (times.length) out.push({ date: c.date, label: labelDate(c.date), times });
  }
  return out;
}

export type BookingRow = {
  id: string;
  service: string | null;
  date: string;
  time: string;
  name: string;
  whatsapp: string | null;
  status: string;
};

/** A member's bookings for the owner dashboard (today onward, soonest first). */
export async function memberBookings(memberId: string): Promise<BookingRow[]> {
  if (!isSupabaseAdminConfigured()) return [];
  try {
    const nowWib = new Date(Date.now() + 7 * 3600 * 1000);
    const todayStr = `${nowWib.getUTCFullYear()}-${pad(nowWib.getUTCMonth() + 1)}-${pad(nowWib.getUTCDate())}`;
    const db = createSupabaseAdminClient();
    const { data } = await db
      .from("bookings")
      .select("id, service, date, time, name, whatsapp, status")
      .eq("member_id", memberId)
      .gte("date", todayStr)
      .order("date", { ascending: true })
      .order("time", { ascending: true })
      .limit(100);
    return (data ?? []) as BookingRow[];
  } catch {
    return [];
  }
}
