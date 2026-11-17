-- Checklists inside tasks: small steps with a tick box. Server-only like the other hub tables: RLS is on with no policy, so the
-- browser's keys cannot read or write any of it; the app checks the person's role first. Safe to run twice.
create table if not exists public.task_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  brand_id uuid not null references public.brands(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 300),
  done boolean not null default false,
  done_by uuid references auth.users(id) on delete set null,
  done_at timestamptz,
  position double precision not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (task_id, brand_id) references public.tasks (id, brand_id) on delete cascade
);
create index if not exists task_items_task_idx on public.task_items (task_id, position);
create index if not exists task_items_brand_idx on public.task_items (brand_id, task_id) include (done);
alter table public.task_items enable row level security;
