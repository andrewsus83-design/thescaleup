-- CRM: the brand's leads (people who may buy) and clients (people who bought), and a running log of notes on each.
-- A lead becomes a client in place (kind changes, the row and its notes stay). Server-only like the other hub tables:
-- RLS is on with no policy, so the browser's keys cannot read or write any of it.

create table if not exists public.crm_people (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  kind text not null default 'lead' check (kind in ('lead', 'client')),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  company text not null default '' check (char_length(company) <= 120),
  email text not null default '' check (char_length(email) <= 254),
  phone text not null default '' check (char_length(phone) <= 40),
  -- Where they came from: a free word or two ("Instagram", "referral", "event").
  source text not null default '' check (char_length(source) <= 60),
  stage text not null default 'new',
  -- What a lead may be worth, or what a client pays: whatever unit the brand uses, shown as a plain number.
  value numeric(16, 2) check (value is null or value >= 0),
  next_follow_up date,
  summary text not null default '' check (char_length(summary) <= 2000),
  converted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_people_stage_ok check (
    (kind = 'lead' and stage in ('new', 'contacted', 'qualified', 'proposal', 'lost'))
    or (kind = 'client' and stage in ('active', 'paused', 'churned'))
  )
);
create index if not exists crm_people_kind_idx on public.crm_people (brand_id, kind, updated_at desc);
create index if not exists crm_people_follow_idx on public.crm_people (brand_id, next_follow_up) where next_follow_up is not null;
drop trigger if exists crm_people_updated_at on public.crm_people;
create trigger crm_people_updated_at before update on public.crm_people for each row execute function public.set_updated_at();

create table if not exists public.crm_notes (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  person_id uuid not null references public.crm_people(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  author_id uuid references auth.users(id) on delete set null,
  -- The author's name as it was when they wrote it, so the log still reads right if they leave.
  author_label text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists crm_notes_person_idx on public.crm_notes (person_id, created_at desc);

alter table public.crm_people enable row level security;
alter table public.crm_notes enable row level security;
revoke all on public.crm_people, public.crm_notes from anon, authenticated;
