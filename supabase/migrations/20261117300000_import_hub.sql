-- Settings, Import: any source can be added later, and a brand can ask for one.
--  - import_refs.source no longer has to be 'clickup': any short lower-case word (a new importer needs no database change).
--  - import_requests: what a brand asked to be able to import from. Server-only like the other hub tables.
-- Safe to run twice.

alter table public.import_refs drop constraint if exists import_refs_source_check;
alter table public.import_refs add constraint import_refs_source_check check (source ~ '^[a-z0-9_]{1,30}$');

create table if not exists public.import_requests (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  source text not null check (char_length(btrim(source)) between 1 and 80),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'planned', 'done', 'declined')),
  created_at timestamptz not null default now()
);
create index if not exists import_requests_brand_idx on public.import_requests (brand_id, created_at desc);

alter table public.import_requests enable row level security;
revoke all on public.import_requests from anon, authenticated;
