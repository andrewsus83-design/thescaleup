-- CRM funnel: each brand sets its own stages (and, later, its own automations), and every stage change is logged
-- so the funnel can say how many people reached each stage and how long they stayed.
-- Server-only like the other hub tables: RLS is on with no policy, so the browser's keys cannot read or write any of it.

-- One row per brand. `stages` is an ordered list of {key, label, kind, open}; an empty list means "use the standard stages".
-- `rules` is for the automations that come next.
create table if not exists public.crm_workflows (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  stages jsonb not null default '[]'::jsonb check (jsonb_typeof(stages) = 'array'),
  rules jsonb not null default '[]'::jsonb check (jsonb_typeof(rules) = 'array'),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Stages are the brand's own words now, so the fixed list on a person goes. The app checks a stage against the brand's list.
alter table public.crm_people drop constraint if exists crm_people_stage_ok;
alter table public.crm_people drop constraint if exists crm_people_stage_len;
alter table public.crm_people add constraint crm_people_stage_len check (char_length(stage) between 1 and 40);

-- Every time someone enters a stage. `kind` is the kind of `to_stage`; `converted` marks a lead who became a client.
create table if not exists public.crm_stage_log (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  person_id uuid not null references public.crm_people(id) on delete cascade,
  kind text not null check (kind in ('lead', 'client')),
  from_stage text,
  to_stage text not null check (char_length(to_stage) between 1 and 40),
  converted boolean not null default false,
  changed_by uuid references auth.users(id) on delete set null,
  at timestamptz not null default now()
);
create index if not exists crm_stage_log_brand_idx on public.crm_stage_log (brand_id, at desc);
create index if not exists crm_stage_log_person_idx on public.crm_stage_log (person_id, at);

alter table public.crm_workflows enable row level security;
alter table public.crm_stage_log enable row level security;
revoke all on public.crm_workflows, public.crm_stage_log from anon, authenticated;

-- People added before the log existed: they entered their current stage when they were added.
insert into public.crm_stage_log (brand_id, person_id, kind, from_stage, to_stage, at)
select p.brand_id, p.id, p.kind, null, p.stage, p.created_at
from public.crm_people p
where not exists (select 1 from public.crm_stage_log l where l.person_id = p.id);
