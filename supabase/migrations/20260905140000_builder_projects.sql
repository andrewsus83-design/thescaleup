-- Stores each builder's wizard data per member (one row per member+builder).
create table if not exists public.builder_projects (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.leads(id) on delete cascade,
  builder text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (member_id, builder)
);
alter table public.builder_projects enable row level security;
