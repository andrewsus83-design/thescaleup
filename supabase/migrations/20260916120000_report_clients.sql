-- ============================================================================
-- ScaleUp — Multi-client Report platform (report.thescaleup.xyz)
--
--  report_clients          one row per client (profile + brand + connect link)
--  report_client_settings  per-client API keys (each client has their OWN keys
--                          for zernio, dataforseo, apify, perplexity, gemini,
--                          claude, firecrawl, serpapi …) — key/value, scoped.
--  report_snapshots        generated reports (normalized metrics per period)
--
-- Zernio is the per-client data source that replaces Apify for report gen.
-- RLS enabled, no public policies (server-side via service role; client
-- connect/view validated by connect_token in server code).
-- ============================================================================
create table if not exists public.report_clients (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  ig_handle     text,
  logo_url      text,
  brand_color   text default '#2A2870',
  accent_color  text default '#38B6F0',
  theme         text default 'light',
  connect_token text unique,
  status        text not null default 'pending',   -- pending | connected | active | paused
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists report_clients_slug_idx on public.report_clients (slug);
create index if not exists report_clients_token_idx on public.report_clients (connect_token);
alter table public.report_clients enable row level security;

-- Per-client API keys / provider settings (key/value, like app_settings but scoped).
create table if not exists public.report_client_settings (
  client_id  uuid not null references public.report_clients(id) on delete cascade,
  key        text not null,                         -- zernio | dataforseo | apify | ...
  value      text not null,
  updated_at timestamptz not null default now(),
  primary key (client_id, key)
);
alter table public.report_client_settings enable row level security;

-- Generated reports (one row per client per period). data = normalized metrics.
create table if not exists public.report_snapshots (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.report_clients(id) on delete cascade,
  period      text not null,                         -- e.g. '2026-08' or 'last_30d'
  data        jsonb not null default '{}'::jsonb,
  source      text default 'zernio',
  created_at  timestamptz not null default now()
);
create index if not exists report_snapshots_client_idx on public.report_snapshots (client_id, created_at desc);
alter table public.report_snapshots enable row level security;
