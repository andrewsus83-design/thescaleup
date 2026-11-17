-- AI leads finder: each search the AI ran for a brand, and the businesses it found. Server-only like the other hub tables.
-- Nothing here is a lead yet. A business becomes one only when a person ticks it and adds it to the CRM. Safe to run twice.

create table if not exists public.lead_searches (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  -- what the person asked for: { what, where, offer, count }
  brief jsonb not null default '{}'::jsonb,
  found integer not null default 0 check (found >= 0),
  -- businesses the AI named that were left out: already found before, already in the CRM, not a business site, or not reachable
  left_out jsonb not null default '{}'::jsonb,
  searches_used integer not null default 0,
  tokens jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists lead_searches_brand_idx on public.lead_searches (brand_id, created_at desc);

create table if not exists public.lead_candidates (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.lead_searches(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  company text not null check (char_length(btrim(company)) between 1 and 120),
  website text not null check (char_length(website) between 4 and 300),
  -- the website's host without "www.": one business is shown once per brand, never again after it was added or skipped
  host text not null check (char_length(host) between 3 and 253 and host = lower(host)),
  location text not null default '' check (char_length(location) <= 100),
  why text not null default '' check (char_length(why) <= 400),
  -- the page the AI found it on
  source_url text not null default '' check (char_length(source_url) <= 300),
  -- read from the business's own website by the app, never written by the AI
  -- ok: their site opened and carries the name. unreadable: it refused or was slow. mismatch: it opened but the name is not on it.
  site text not null default 'ok' check (site in ('ok', 'unreadable', 'mismatch')),
  emails text[] not null default '{}' check (cardinality(emails) <= 3),
  phones text[] not null default '{}' check (cardinality(phones) <= 3),
  status text not null default 'new' check (status in ('new', 'added', 'skipped')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  import_id uuid references public.crm_imports(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (brand_id, host)
);
create index if not exists lead_candidates_search_idx on public.lead_candidates (search_id, status, created_at);

alter table public.lead_searches enable row level security;
alter table public.lead_candidates enable row level security;
revoke all on public.lead_searches, public.lead_candidates from anon, authenticated;
