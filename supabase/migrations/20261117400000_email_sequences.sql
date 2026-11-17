-- Email sequences: a short series of emails that go to each person on their own schedule (day 0, then 2 days later, then 5 more...).
-- Server-only like the other hub tables: RLS is on with no policy. Safe to run twice.

create table if not exists public.email_sequences (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  address_id uuid references public.mail_addresses(id) on delete set null,
  -- The emails in order: [{ "delay_days": 0, "doc": { subject, preheader, accent, footer, blocks } }, ...].
  -- delay_days is the wait after the previous email (for the first one: after the person joins).
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 10),
  -- Who may join: { kinds: ["lead"], stages: [...], tags: [...] } (the same shape a campaign uses)
  audience jsonb not null default '{}'::jsonb,
  -- Someone who reaches one of these CRM stages leaves the sequence (for example "lost" or "active").
  stop_stages text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  -- When on, people created after auto_since who match the audience join by themselves, once a day.
  auto_enroll boolean not null default false,
  auto_since timestamptz,
  -- The last person who confirmed that everyone added agreed to get this brand's email.
  consent_by uuid references auth.users(id) on delete set null,
  consent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_sequences_auto_since check (not auto_enroll or auto_since is not null)
);
create index if not exists email_sequences_brand_idx on public.email_sequences (brand_id, created_at desc);
create index if not exists email_sequences_active_idx on public.email_sequences (status) where status = 'active';
drop trigger if exists email_sequences_updated_at on public.email_sequences;
create trigger email_sequences_updated_at before update on public.email_sequences for each row execute function public.set_updated_at();

-- One row per person in a sequence. sent_count is how many of the emails they have had; the next one is steps[sent_count], due on next_on
-- (a calendar day in the hub's time zone, so "2 days later" means the same morning, not a few seconds short of it).
create table if not exists public.email_enrollments (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.email_sequences(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  person_id uuid references public.crm_people(id) on delete set null,
  email text not null check (char_length(email) between 3 and 254 and email = lower(email)),
  -- what the merge tags need ({ name, company }), kept so a queued email does not depend on the CRM row staying as it was
  vars jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'done', 'stopped')),
  stop_reason text check (stop_reason is null or stop_reason in ('completed', 'unsubscribed', 'bounced', 'complained', 'replied', 'removed', 'email_changed', 'stage', 'failed', 'manual')),
  sent_count integer not null default 0 check (sent_count >= 0),
  next_on date,
  enrolled_at timestamptz not null default now(),
  enrolled_by uuid references auth.users(id) on delete set null,
  last_sent_at timestamptz,
  unique (sequence_id, email),
  constraint email_enrollments_next_on check (status <> 'active' or next_on is not null)
);
create index if not exists email_enrollments_due_idx on public.email_enrollments (sequence_id, next_on) where status = 'active';
create index if not exists email_enrollments_list_idx on public.email_enrollments (sequence_id, status, enrolled_at desc);

-- Every email a sequence sent. One per person and step: it is what keeps an email from going out twice.
create table if not exists public.email_step_sends (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.email_enrollments(id) on delete cascade,
  sequence_id uuid not null references public.email_sequences(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  step integer not null check (step >= 0),
  email text not null,
  status text not null check (status in ('sent', 'failed', 'bounced', 'complained')),
  resend_id text,
  error text check (error is null or char_length(error) <= 300),
  sent_at timestamptz not null default now(),
  unique (enrollment_id, step)
);
create index if not exists email_step_sends_resend_idx on public.email_step_sends (resend_id) where resend_id is not null;
create index if not exists email_step_sends_seq_idx on public.email_step_sends (sequence_id, step, status);

-- "Did this person write back?" is asked for every email a sequence is about to send.
create index if not exists mail_messages_in_from_idx on public.mail_messages (brand_id, from_email) where direction = 'in';

alter table public.email_sequences enable row level security;
alter table public.email_enrollments enable row level security;
alter table public.email_step_sends enable row level security;
revoke all on public.email_sequences, public.email_enrollments, public.email_step_sends from anon, authenticated;

-- Who could join right now: people in the audience who have a real address, have not unsubscribed or bounced, are not in a stage that
-- stops the sequence, and are not in it already (by address or by person). One row per address. p_since keeps only people created after that moment.
create or replace function public.email_sequence_candidates(p_sequence uuid, p_since timestamptz default null)
returns table (person_id uuid, email text, name text, company text, created_at timestamptz)
language sql
stable
set search_path = public
as $$
  with s as (select * from email_sequences where id = p_sequence),
       a as (
         select s.brand_id, s.stop_stages,
                array(select jsonb_array_elements_text(case when jsonb_typeof(s.audience -> 'kinds') = 'array' then s.audience -> 'kinds' else '[]'::jsonb end)) as kinds,
                array(select jsonb_array_elements_text(case when jsonb_typeof(s.audience -> 'stages') = 'array' then s.audience -> 'stages' else '[]'::jsonb end)) as stages,
                array(select jsonb_array_elements_text(case when jsonb_typeof(s.audience -> 'tags') = 'array' then s.audience -> 'tags' else '[]'::jsonb end)) as tags
           from s)
  select distinct on (lower(btrim(p.email))) p.id, lower(btrim(p.email)), left(p.name, 120), left(p.company, 120), p.created_at
    from a
    join crm_people p on p.brand_id = a.brand_id
   where cardinality(a.kinds) > 0
     and p.kind = any(a.kinds)
     and (cardinality(a.stages) = 0 or p.stage = any(a.stages))
     and (cardinality(a.tags) = 0 or p.tags && a.tags)
     and not (p.stage = any(a.stop_stages))
     and (p_since is null or p.created_at >= p_since)
     and char_length(btrim(p.email)) between 3 and 254
     and lower(btrim(p.email)) ~ '^[^[:space:]@<>(),;:"\\]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
     and not exists (select 1 from email_suppressions x where x.brand_id = a.brand_id and x.email = lower(btrim(p.email)))
     and not exists (select 1 from email_enrollments e where e.sequence_id = p_sequence and e.email = lower(btrim(p.email)))
     -- one person goes through a sequence once, even if their address changed after they joined
     and not exists (select 1 from email_enrollments e where e.sequence_id = p_sequence and e.person_id = p.id)
   order by lower(btrim(p.email)), p.created_at, p.id
$$;

-- Counts who could join (p_dry) or adds them, oldest first, at most p_limit. People already in the sequence are never added twice.
create or replace function public.email_sequence_enroll(
  p_sequence uuid, p_today date, p_since timestamptz default null, p_limit integer default 1000, p_dry boolean default false, p_by uuid default null
)
returns table (matching integer, added integer)
language plpgsql
set search_path = public
as $$
declare
  s email_sequences%rowtype;
  v_first integer;
  v_matching integer := 0;
  v_added integer := 0;
begin
  select * into s from email_sequences where id = p_sequence;
  if not found then
    return query select 0, 0;
    return;
  end if;
  v_first := coalesce(nullif(s.steps -> 0 ->> 'delay_days', '')::integer, 0);
  select count(*)::integer into v_matching from email_sequence_candidates(p_sequence, p_since);
  if not p_dry and jsonb_array_length(s.steps) > 0 then
    with c as (
           select * from email_sequence_candidates(p_sequence, p_since) order by created_at, person_id limit greatest(p_limit, 0)),
         ins as (
           insert into email_enrollments (sequence_id, brand_id, person_id, email, vars, next_on, enrolled_by)
           select p_sequence, s.brand_id, c.person_id, c.email, jsonb_build_object('name', c.name, 'company', c.company), p_today + v_first, p_by
             from c
           on conflict (sequence_id, email) do nothing
           returning 1)
    select count(*)::integer into v_added from ins;
  end if;
  return query select v_matching, v_added;
end;
$$;

-- What a sequence page shows: who is where, why people left, and how each email did.
create or replace function public.email_sequence_stats(p_sequence uuid, p_today date)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'active', count(*) filter (where status = 'active'),
    'due', count(*) filter (where status = 'active' and next_on <= p_today),
    'done', count(*) filter (where status = 'done'),
    'stopped', count(*) filter (where status = 'stopped'),
    'reasons', coalesce((select jsonb_object_agg(r.stop_reason, r.n)
                           from (select stop_reason, count(*) as n from email_enrollments where sequence_id = p_sequence and status = 'stopped' and stop_reason is not null group by stop_reason) r), '{}'::jsonb),
    'steps', coalesce((select jsonb_agg(jsonb_build_object('step', t.step, 'sent', t.sent, 'failed', t.failed, 'bounced', t.bounced) order by t.step)
                         from (select step,
                                      count(*) filter (where status <> 'failed') as sent,
                                      count(*) filter (where status = 'failed') as failed,
                                      count(*) filter (where status in ('bounced', 'complained')) as bounced
                                 from email_step_sends where sequence_id = p_sequence group by step) t), '[]'::jsonb)
  )
  from email_enrollments where sequence_id = p_sequence
$$;

revoke all on function public.email_sequence_candidates(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.email_sequence_enroll(uuid, date, timestamptz, integer, boolean, uuid) from public, anon, authenticated;
revoke all on function public.email_sequence_stats(uuid, date) from public, anon, authenticated;
grant execute on function public.email_sequence_candidates(uuid, timestamptz) to service_role;
grant execute on function public.email_sequence_enroll(uuid, date, timestamptz, integer, boolean, uuid) to service_role;
grant execute on function public.email_sequence_stats(uuid, date) to service_role;
