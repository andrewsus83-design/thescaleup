-- People side of Team: people records, leave, attendance settings, pay and payslips.
-- Everything here is service role only: the app checks the person's role and the Team / Salary and payroll access before every read or write.
-- Pay, payslips, private notes and leave notes are stored encrypted by the app (the *_sealed columns), so the database and its backups
-- never hold a readable salary.

-- ── settings: one row per brand ─────────────────────────────────────────────
create table if not exists public.hr_settings (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  currency text not null default 'IDR' check (currency ~ '^[A-Z]{3}$'),
  work_start text not null default '09:00' check (work_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  late_after_min integer not null default 15 check (late_after_min between 0 and 240),
  workdays smallint not null default 5 check (workdays in (5, 6, 7)),
  leave_days integer not null default 12 check (leave_days between 0 and 365),
  rules_sealed text not null default '' check (char_length(rules_sealed) <= 40000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- ── people: anyone the brand employs, with or without a sign-in to the hub ──
create table if not exists public.hr_people (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null check (char_length(full_name) between 1 and 120),
  job_title text not null default '' check (char_length(job_title) <= 120),
  employment text not null default 'full_time' check (employment in ('full_time', 'part_time', 'contract', 'intern', 'freelance')),
  start_date date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'left')),
  leave_days integer check (leave_days is null or leave_days between 0 and 365),
  private_sealed text not null default '' check (char_length(private_sealed) <= 4000),
  pay_sealed text not null default '' check (char_length(pay_sealed) <= 40000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  check (end_date is null or start_date is null or end_date >= start_date)
);
-- One record per sign-in per brand, so "my leave" and "my payslips" always mean one person.
create unique index if not exists hr_people_one_per_user on public.hr_people (brand_id, user_id) where user_id is not null;
create index if not exists hr_people_brand_idx on public.hr_people (brand_id, status, full_name);

-- ── leave requests ──────────────────────────────────────────────────────────
create table if not exists public.hr_leave (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  person_id uuid not null references public.hr_people(id) on delete cascade,
  kind text not null check (kind in ('annual', 'sick', 'unpaid', 'other')),
  start_date date not null,
  end_date date not null,
  days integer not null check (days between 1 and 366),
  note_sealed text not null default '' check (char_length(note_sealed) <= 4000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists hr_leave_brand_idx on public.hr_leave (brand_id, start_date desc);
create index if not exists hr_leave_person_idx on public.hr_leave (person_id, start_date desc);

-- ── payroll: one run per brand per month, one payslip per person per run ────
create table if not exists public.hr_payroll_runs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'draft' check (status in ('draft', 'final')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  finalized_by uuid references auth.users(id) on delete set null,
  finalized_at timestamptz,
  unique (brand_id, month)
);

create table if not exists public.hr_payslips (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.hr_payroll_runs(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  person_id uuid not null references public.hr_people(id) on delete cascade,
  body_sealed text not null check (char_length(body_sealed) between 1 and 60000),
  updated_at timestamptz not null default now(),
  unique (run_id, person_id)
);
create index if not exists hr_payslips_person_idx on public.hr_payslips (brand_id, person_id);

-- ── service role only ───────────────────────────────────────────────────────
alter table public.hr_settings enable row level security;
alter table public.hr_people enable row level security;
alter table public.hr_leave enable row level security;
alter table public.hr_payroll_runs enable row level security;
alter table public.hr_payslips enable row level security;
revoke all on public.hr_settings, public.hr_people, public.hr_leave, public.hr_payroll_runs, public.hr_payslips from anon, authenticated;
