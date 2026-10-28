-- Cost tracking per brand per provider per month
-- Apply via Supabase dashboard SQL editor or: supabase db push
create table if not exists public.brand_usage (
  id          uuid          primary key default gen_random_uuid(),
  client_id   uuid          not null references public.report_clients(id) on delete cascade,
  provider_id text          not null,   -- e.g. 'claude', 'dataforseo'
  month       text          not null,   -- 'YYYY-MM'
  cost_usd    numeric(10,4) not null default 0,
  calls       integer       not null default 0,
  tokens_in   bigint        not null default 0,
  tokens_out  bigint        not null default 0,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now(),
  unique(client_id, provider_id, month)
);

alter table public.brand_usage enable row level security;
-- Only the Supabase service role (admin client) can read/write this table
create policy "service role only" on public.brand_usage using (false);
