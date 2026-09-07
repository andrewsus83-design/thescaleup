-- ============================================================================
-- ScaleUp — Booking System (Calendly-style reservations for clinic/salon/jasa)
-- Public booking page writes here via the service-role server action.
-- RLS enabled, no public policies (all access is server-side).
-- ============================================================================
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.leads(id) on delete cascade,
  service text,
  date date not null,
  time text not null,                       -- "HH:MM"
  name text not null,
  whatsapp text,
  email text,
  notes text,
  status text not null default 'confirmed', -- confirmed | pending | cancelled
  created_at timestamptz not null default now()
);
create index if not exists bookings_member_date_idx on public.bookings (member_id, date);
alter table public.bookings enable row level security;
