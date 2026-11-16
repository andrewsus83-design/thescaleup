-- ============================================================================
-- ScaleUp — Tasks core, calendar and team time
--
--   tasks        + priority, start_date, tags, completed_at; sources 'import' and 'ai'
--   time_entries clock in / clock out per person (service role only, like the key tables)
--
-- completed_at is stamped by the database when a task enters a "closed" stage, so the
-- KPI index (on time vs late) cannot be shaped by the browser.
-- Idempotent: safe to re-run in the Supabase SQL Editor.
-- ============================================================================

-- ── tasks: new columns ──────────────────────────────────────────────────────
alter table public.tasks add column if not exists priority text not null default 'normal';
alter table public.tasks add column if not exists start_date date;
alter table public.tasks add column if not exists tags text[] not null default '{}';
alter table public.tasks add column if not exists completed_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_priority_check' and conrelid = 'public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_priority_check check (priority in ('urgent', 'high', 'normal', 'low'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_tags_check' and conrelid = 'public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_tags_check check (coalesce(array_length(tags, 1), 0) <= 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_title_len' and conrelid = 'public.tasks'::regclass) then
    -- NOT VALID: enforced for every new or changed row without scanning old ones.
    alter table public.tasks add constraint tasks_title_len check (char_length(title) between 1 and 300) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_dates_order' and conrelid = 'public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_dates_order check (start_date is null or due_date is null or start_date <= due_date) not valid;
  end if;
end $$;

-- 'import' (ClickUp, CSV, WhatsApp) and 'ai' (drafted by Claude from pasted notes) join the existing sources.
alter table public.tasks drop constraint if exists tasks_source_check;
alter table public.tasks add constraint tasks_source_check
  check (source in ('manual', 'agent', 'audit', 'automation', 'import', 'ai'));

create index if not exists tasks_due_idx on public.tasks (brand_id, due_date) where due_date is not null;
create index if not exists tasks_completed_idx on public.tasks (brand_id, completed_at) where completed_at is not null;

-- ── completed_at ────────────────────────────────────────────────────────────
-- Runs after tasks_before_write (triggers fire in name order), so `stage` is already synced from the workflow.
create or replace function public.tasks_stamp_completed()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.stage = 'closed' then
    if tg_op = 'UPDATE' and old.stage is distinct from 'closed' then
      new.completed_at := now();                              -- just closed
    else
      new.completed_at := coalesce(new.completed_at, now());  -- already closed, or created closed (an import may bring its own time)
    end if;
  else
    new.completed_at := null;                                 -- re-opened
  end if;
  return new;
end $$;

drop trigger if exists tasks_stamp_completed on public.tasks;
create trigger tasks_stamp_completed before insert or update on public.tasks
  for each row execute function public.tasks_stamp_completed();

-- Tasks that were closed before this migration keep their last change as the best available time.
update public.tasks set completed_at = updated_at where stage = 'closed' and completed_at is null;

-- ── time entries (clock in / clock out) ─────────────────────────────────────
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  note text check (note is null or char_length(note) <= 280),
  created_at timestamptz not null default now(),
  check (clock_out is null or clock_out >= clock_in)
);
-- One open entry per person per brand: clocking in twice is impossible, not just discouraged.
create unique index if not exists time_entries_one_open on public.time_entries (brand_id, user_id) where clock_out is null;
create index if not exists time_entries_person_idx on public.time_entries (brand_id, user_id, clock_in desc);

-- Service role only (the app checks the role and the Team access before every read or write).
alter table public.time_entries enable row level security;
revoke all on public.time_entries from anon, authenticated;
