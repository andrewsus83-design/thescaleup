// Booking engine — plain module (settings parsing + slot generation). Safe for
// server & client. The settings are derived from the Booking builder wizard
// data saved in builder_projects (builder="booking").

export type BookingService = { name: string; duration: number };

export type BookingSettings = {
  services: BookingService[];
  days: number[]; // JS weekday numbers (0=Sun..6=Sat) that are open
  startMin: number; // minutes from midnight
  endMin: number;
  interval: number; // minutes between slot starts (duration + buffer)
  duration: number; // session length
  capacity: number; // max bookings per slot
  maxPerDay: number | null;
  windowDays: number; // how far ahead bookings are allowed
  confirmation: "instant" | "request";
};

const DAY_MAP: Record<string, number> = {
  min: 0, sen: 1, sel: 2, rab: 3, kam: 4, jum: 5, sab: 6,
};

function num(v: unknown, fallback: number): number {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function parseTime(s: string): number | null {
  const m = String(s).match(/(\d{1,2})[.:](\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseHours(s: unknown): [number, number] {
  const str = String(s ?? "");
  const all = str.match(/\d{1,2}[.:]\d{2}/g);
  if (all && all.length >= 2) {
    const a = parseTime(all[0]);
    const b = parseTime(all[1]);
    if (a != null && b != null && b > a) return [a, b];
  }
  return [540, 1020]; // 09:00 - 17:00
}

const CAPACITY: Record<string, number> = { "1": 1, "2_3": 3, "4_plus": 6, custom: 2 };

/** Build BookingSettings from raw Booking-builder wizard data. */
export function parseSettings(data: Record<string, unknown> | null | undefined): BookingSettings {
  const d = data ?? {};
  const rawServices = Array.isArray(d.booking_services) ? (d.booking_services as unknown[]) : [];
  const durRaw = String(d.session_duration ?? "60");
  const duration = durRaw === "custom" ? 60 : num(durRaw, 60);
  const buffer = num(d.buffer_time, 0);
  const services: BookingService[] = rawServices
    .map((s) => String(s).trim())
    .filter(Boolean)
    .map((name) => ({ name, duration }));
  if (services.length === 0) services.push({ name: "Reservasi", duration });

  const daysRaw = Array.isArray(d.operating_days) ? (d.operating_days as string[]) : [];
  const days = daysRaw.map((x) => DAY_MAP[x]).filter((n) => n != null);
  const [startMin, endMin] = parseHours(d.operating_hours);

  return {
    services,
    days: days.length ? days : [1, 2, 3, 4, 5, 6], // default Mon–Sat
    startMin,
    endMin,
    interval: duration + buffer,
    duration,
    capacity: CAPACITY[String(d.slot_capacity ?? "1")] ?? 1,
    maxPerDay: d.max_per_day ? num(d.max_per_day, 0) || null : null,
    windowDays: 14,
    confirmation: String(d.confirmation_mode ?? "instant") === "request" ? "request" : "instant",
  };
}

/** All slot start-times (HH:MM) in a day, regardless of bookings. */
export function daySlots(s: BookingSettings): string[] {
  const out: string[] = [];
  for (let m = s.startMin; m + s.duration <= s.endMin; m += s.interval) out.push(fmtTime(m));
  return out;
}

const ID_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const ID_DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export function labelDate(dateStr: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return `${ID_DAYS[dow]}, ${d} ${ID_MONTHS[mo - 1]}`;
}
