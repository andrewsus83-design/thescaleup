-- CRM at scale: tags on people, a record of each import (so one can be undone), and the searching, counting and bulk changes
-- done by the database. The API returns at most 1,000 rows per request, so a list of thousands has to be searched, counted
-- and paged here, not in the app.

alter table public.crm_people add column if not exists tags text[] not null default '{}';
alter table public.crm_people drop constraint if exists crm_people_tags_len;
alter table public.crm_people add constraint crm_people_tags_len check (cardinality(tags) <= 20);
create index if not exists crm_people_tags_idx on public.crm_people using gin (tags);

-- One row per file imported: what it was called, which tags it added, how many people it added and skipped.
create table if not exists public.crm_imports (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  kind text not null check (kind in ('lead', 'client')),
  file_name text not null default '' check (char_length(file_name) <= 200),
  tags text[] not null default '{}',
  created_count integer not null default 0,
  skipped_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  undone_at timestamptz
);
create index if not exists crm_imports_brand_idx on public.crm_imports (brand_id, created_at desc);
alter table public.crm_imports enable row level security;
revoke all on public.crm_imports from anon, authenticated;

alter table public.crm_people add column if not exists import_id uuid references public.crm_imports(id) on delete set null;
create index if not exists crm_people_import_idx on public.crm_people (import_id) where import_id is not null;

-- ---------------------------------------------------------------------------------------------- import (now with tags and a record)
drop function if exists public.crm_import_chunk(uuid, text, uuid, jsonb);
create or replace function public.crm_import_chunk(p_brand uuid, p_kind text, p_by uuid, p_rows jsonb, p_import uuid default null, p_tags text[] default '{}')
returns table (created integer, skipped integer)
language plpgsql
set search_path = public
as $$
declare
  v_total integer;
  v_created integer;
begin
  if p_kind not in ('lead', 'client') then
    raise exception 'Kind must be lead or client.' using errcode = '22023';
  end if;
  if not exists (select 1 from brands where id = p_brand) then
    raise exception 'Unknown brand.' using errcode = '42501';
  end if;
  if p_import is not null and not exists (select 1 from crm_imports where id = p_import and brand_id = p_brand) then
    raise exception 'Unknown import.' using errcode = '42501';
  end if;
  v_total := jsonb_array_length(p_rows);

  with src as (
    select btrim(r.name) as name,
           coalesce(btrim(r.company), '') as company,
           lower(coalesce(btrim(r.email), '')) as email,
           coalesce(btrim(r.phone), '') as phone,
           coalesce(btrim(r.source), '') as source,
           r.value, r.next_follow_up,
           coalesce(r.summary, '') as summary,
           r.stage
    from jsonb_to_recordset(p_rows) as r(name text, company text, email text, phone text, source text, value numeric, next_follow_up date, summary text, stage text)
  ),
  fresh as (
    select s.* from src s
    where s.name <> ''
      and not (
        (s.email <> '' and exists (select 1 from crm_people p where p.brand_id = p_brand and p.email <> '' and lower(p.email) = s.email))
        or (crm_phone_key(s.phone) is not null and exists (select 1 from crm_people p where p.brand_id = p_brand and p.phone <> '' and crm_phone_key(p.phone) = crm_phone_key(s.phone)))
        or (s.email = '' and crm_phone_key(s.phone) is null and exists (select 1 from crm_people p where p.brand_id = p_brand and lower(p.name) = lower(s.name) and lower(p.company) = lower(s.company)))
      )
  ),
  ins as (
    insert into crm_people (brand_id, kind, name, company, email, phone, source, stage, value, next_follow_up, summary, created_by, tags, import_id)
    select p_brand, p_kind, f.name, f.company, f.email, f.phone, f.source, f.stage, f.value, f.next_follow_up, f.summary, p_by, coalesce(p_tags, '{}'), p_import from fresh f
    returning id, kind, stage
  ),
  logged as (
    insert into crm_stage_log (brand_id, person_id, kind, from_stage, to_stage, changed_by)
    select p_brand, i.id, i.kind, null, i.stage, p_by from ins i
    returning 1
  )
  select count(*)::integer into v_created from ins;

  if p_import is not null then
    update crm_imports set created_count = created_count + v_created, skipped_count = skipped_count + (v_total - v_created) where id = p_import;
  end if;
  return query select v_created, v_total - v_created;
end;
$$;

-- Takes an import back: removes the people it added that nobody has touched since (still in the stage they started in, no note, no change).
create or replace function public.crm_undo_import(p_brand uuid, p_import uuid)
returns table (removed integer, kept integer)
language plpgsql
set search_path = public
as $$
declare
  v_removed integer;
  v_kept integer;
begin
  if not exists (select 1 from crm_imports where id = p_import and brand_id = p_brand and undone_at is null) then
    raise exception 'That import is not there or was already undone.' using errcode = '42501';
  end if;
  with gone as (
    delete from crm_people where brand_id = p_brand and import_id = p_import and updated_at = created_at returning 1
  )
  select count(*)::integer into v_removed from gone;
  select count(*)::integer into v_kept from crm_people where brand_id = p_brand and import_id = p_import;
  update crm_imports set undone_at = now() where id = p_import;
  return query select v_removed, v_kept;
end;
$$;

-- ---------------------------------------------------------------------------------------------- finding people
-- The one place that decides who matches a search and a set of filters, for the list, the counts, the export and the bulk changes.
-- p_stage: '' for any, 'open' for people still being worked, or a stage key. p_closed: the keys of the stages that end the story.
-- sort_due is the follow-up date of someone still open (null for a closed stage), so people to follow up come first.
create or replace function public.crm_find(
  p_brand uuid, p_kind text, p_q text default '', p_stage text default '', p_due boolean default false,
  p_tag text default '', p_import uuid default null, p_today date default null, p_closed text[] default '{}'
)
returns table (
  id uuid, kind text, name text, company text, email text, phone text, source text, stage text, value numeric,
  next_follow_up date, summary text, converted_at timestamptz, created_at timestamptz, updated_at timestamptz,
  tags text[], import_id uuid, sort_due date
)
language sql
stable
set search_path = public
as $$
  select p.id, p.kind, p.name, p.company, p.email, p.phone, p.source, p.stage, p.value, p.next_follow_up, p.summary,
         p.converted_at, p.created_at, p.updated_at, p.tags, p.import_id,
         case when p.stage = any(p_closed) then null else p.next_follow_up end
    from crm_people p
   where p.brand_id = p_brand
     and p.kind = p_kind
     -- every word typed must appear somewhere in the name, company, email, phone or source
     and (btrim(p_q) = '' or not exists (
           select 1 from unnest(string_to_array(lower(btrim(p_q)), ' ')) as w
            where w <> '' and strpos(lower(concat_ws(' ', p.name, p.company, p.email, p.phone, p.source)), w) = 0))
     and (p_stage = '' or (p_stage = 'open' and not (p.stage = any(p_closed))) or p.stage = p_stage)
     and (not p_due or (p.next_follow_up is not null and p.next_follow_up <= p_today and not (p.stage = any(p_closed))))
     and (p_tag = '' or p_tag = any(p.tags))
     and (p_import is null or p.import_id = p_import)
$$;

-- Counts for the header tiles and the stage pills, over everyone of a kind (not just the page on screen).
create or replace function public.crm_summary(p_brand uuid, p_kind text, p_closed text[] default '{}', p_today date default null)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'total', count(*),
    'byStage', coalesce((select jsonb_object_agg(s.stage, s.n) from (select stage, count(*) as n from crm_people where brand_id = p_brand and kind = p_kind group by stage) s), '{}'::jsonb),
    'byStageValue', coalesce((select jsonb_object_agg(s.stage, s.v) from (select stage, coalesce(sum(value), 0) as v from crm_people where brand_id = p_brand and kind = p_kind group by stage) s), '{}'::jsonb),
    'open', count(*) filter (where not (stage = any(p_closed))),
    'openValue', coalesce(sum(value) filter (where not (stage = any(p_closed))), 0),
    'due', count(*) filter (where next_follow_up is not null and next_follow_up <= p_today and not (stage = any(p_closed)))
  )
  from crm_people where brand_id = p_brand and kind = p_kind
$$;

-- Every tag the brand uses, most used first.
create or replace function public.crm_tags(p_brand uuid)
returns table (tag text, n bigint)
language sql
stable
set search_path = public
as $$
  select t.tag, count(*) as n from crm_people p, unnest(p.tags) as t(tag) where p.brand_id = p_brand group by t.tag order by n desc, t.tag limit 200
$$;

-- ---------------------------------------------------------------------------------------------- changing many at once
-- p_op: stage (p_arg = stage key), follow (p_arg = a date, or '' to clear), tag_add, tag_remove (p_tags), delete.
-- Only people of p_kind in p_brand are touched. Returns how many changed. A move is written to the stage log.
create or replace function public.crm_bulk(p_brand uuid, p_kind text, p_ids uuid[], p_op text, p_arg text default '', p_tags text[] default '{}', p_by uuid default null)
returns integer
language plpgsql
set search_path = public
as $$
declare
  n integer := 0;
begin
  if p_kind not in ('lead', 'client') then
    raise exception 'Kind must be lead or client.' using errcode = '22023';
  end if;
  if p_op = 'stage' then
    with old as (select id, stage from crm_people where brand_id = p_brand and kind = p_kind and id = any(p_ids) and stage <> p_arg),
    upd as (update crm_people p set stage = p_arg from old where p.id = old.id returning p.id, old.stage as from_stage),
    logged as (insert into crm_stage_log (brand_id, person_id, kind, from_stage, to_stage, changed_by) select p_brand, id, p_kind, from_stage, p_arg, p_by from upd returning 1)
    select count(*)::integer into n from upd;
  elsif p_op = 'follow' then
    update crm_people set next_follow_up = nullif(p_arg, '')::date where brand_id = p_brand and kind = p_kind and id = any(p_ids);
    get diagnostics n = row_count;
  elsif p_op = 'tag_add' then
    update crm_people set tags = array(select x.t from (select distinct t from unnest(tags || p_tags) as t order by t limit 20) x)
     where brand_id = p_brand and kind = p_kind and id = any(p_ids);
    get diagnostics n = row_count;
  elsif p_op = 'tag_remove' then
    update crm_people set tags = array(select t from unnest(tags) as t where t <> all(p_tags))
     where brand_id = p_brand and kind = p_kind and id = any(p_ids) and tags && p_tags;
    get diagnostics n = row_count;
  elsif p_op = 'delete' then
    delete from crm_people where brand_id = p_brand and kind = p_kind and id = any(p_ids);
    get diagnostics n = row_count;
  else
    raise exception 'Unknown change.' using errcode = '22023';
  end if;
  return n;
end;
$$;

revoke all on function public.crm_import_chunk(uuid, text, uuid, jsonb, uuid, text[]) from public, anon, authenticated;
revoke all on function public.crm_undo_import(uuid, uuid) from public, anon, authenticated;
revoke all on function public.crm_find(uuid, text, text, text, boolean, text, uuid, date, text[]) from public, anon, authenticated;
revoke all on function public.crm_summary(uuid, text, text[], date) from public, anon, authenticated;
revoke all on function public.crm_tags(uuid) from public, anon, authenticated;
revoke all on function public.crm_bulk(uuid, text, uuid[], text, text, text[], uuid) from public, anon, authenticated;
grant execute on function public.crm_import_chunk(uuid, text, uuid, jsonb, uuid, text[]) to service_role;
grant execute on function public.crm_undo_import(uuid, uuid) to service_role;
grant execute on function public.crm_find(uuid, text, text, text, boolean, text, uuid, date, text[]) to service_role;
grant execute on function public.crm_summary(uuid, text, text[], date) to service_role;
grant execute on function public.crm_tags(uuid) to service_role;
grant execute on function public.crm_bulk(uuid, text, uuid[], text, text, text[], uuid) to service_role;
