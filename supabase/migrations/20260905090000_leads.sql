-- Lead capture table for the landing onboarding form.
-- RLS is enabled with NO public policies: the anon/public key cannot read or
-- write. Inserts happen server-side in /api/lead using the service_role key,
-- which bypasses RLS. This keeps leads private and blocks public spam via the
-- exposed anon key.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  business text,
  whatsapp text,
  email text,
  website text,
  instagram text,
  tiktok text,
  competitor1 text,
  competitor2 text,
  category text,
  goal text,
  budget text,
  bottleneck text,
  notes text,
  source text default 'landing_onboarding',
  user_agent text,
  status text default 'new',
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;

comment on table public.leads is 'Leads captured from the public landing onboarding form.';

create index if not exists leads_created_at_idx on public.leads (created_at desc);
