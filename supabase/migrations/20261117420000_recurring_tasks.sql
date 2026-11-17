-- Repeating tasks: a recipe ("every Monday: send the weekly report") that makes a normal task whenever a day it names comes round.
-- Server-only like the other hub tables: RLS is on with no policy, so the browser's keys cannot read or write any of it; the app checks the
-- person's role first. Safe to run twice.

create table if not exists public.task_recurrences (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 8000),
  assignee_id uuid references auth.users(id) on delete set null,
  priority text not null default 'normal' check (priority in ('urgent', 'high', 'normal', 'low')),
  tags text[] not null default '{}',
  -- Checklist lines copied into every task it makes.
  items text[] not null default '{}' check (cardinality(items) <= 30),
  freq text not null check (freq in ('daily', 'weekly', 'monthly')),
  every smallint not null default 1 check (every between 1 and 12),
  -- Weekly: the days it lands on, 1 = Monday … 7 = Sunday.
  weekdays smallint[] not null default '{}' check (cardinality(weekdays) <= 7 and weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  -- Monthly: the day of the month; a shorter month uses its last day.
  month_day smallint check (month_day is null or month_day between 1 and 31),
  -- A task made on day D is due on D + due_in_days.
  due_in_days smallint not null default 0 check (due_in_days between 0 and 60),
  starts_on date not null,
  ends_on date,
  active boolean not null default true,
  -- The day of the latest task it made. It never makes one for a day at or before this, so a task someone deleted stays deleted.
  last_made_on date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on),
  check (freq <> 'weekly' or cardinality(weekdays) >= 1),
  check (freq <> 'monthly' or month_day is not null)
);
create index if not exists task_recurrences_brand_idx on public.task_recurrences (brand_id, active);
alter table public.task_recurrences enable row level security;
revoke all on public.task_recurrences from anon, authenticated;

-- Which recipe made a task, and for which day. The pair is unique, so two requests racing to make the same day's task make it once.
alter table public.tasks add column if not exists recurrence_id uuid references public.task_recurrences(id) on delete set null;
alter table public.tasks add column if not exists occurs_on date;
create unique index if not exists tasks_recurrence_day_key on public.tasks (recurrence_id, occurs_on);

drop trigger if exists task_recurrences_updated_at on public.task_recurrences;
create trigger task_recurrences_updated_at before update on public.task_recurrences
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
