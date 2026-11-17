-- Data protection for the CRM.
--  1. Notes and "about" text can be stored wrapped (encrypted by the app), which is longer than the plain text: more room.
--  2. The search can leave email and phone out, for people who may not see them.
--  3. A batch step that wraps the text that is already there, without making anyone look "recently touched".
-- Safe to run more than once.

-- 1. Room for wrapped text. 2,000 characters of text wrap to at most about 10,800; 12,000 leaves a margin.
alter table public.crm_people drop constraint if exists crm_people_summary_check;
alter table public.crm_people add constraint crm_people_summary_check check (char_length(summary) <= 12000);
alter table public.crm_notes drop constraint if exists crm_notes_body_check;
alter table public.crm_notes add constraint crm_notes_body_check check (char_length(btrim(body)) between 1 and 12000);

-- 2. updated_at moves on every change, except one made only to protect existing text (it must not reorder the list, or make an
-- imported person look worked on, which would stop "undo this import" from removing them).
create or replace function public.crm_people_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('app.keep_updated_at', true), '') <> 'on' then
    new.updated_at = now();
  end if;
  return new;
end;
$$;
drop trigger if exists crm_people_updated_at on public.crm_people;
create trigger crm_people_updated_at before update on public.crm_people for each row execute function public.crm_people_touch();

-- 3. The search. p_contacts = false leaves email and phone out of what is matched: someone who cannot see an address must not be
-- able to find it by typing pieces of it and watching who shows up. Everything else is as before.
drop function if exists public.crm_find(uuid, text, text, text, boolean, text, uuid, date, text[]);
create or replace function public.crm_find(
  p_brand uuid, p_kind text, p_q text default '', p_stage text default '', p_due boolean default false,
  p_tag text default '', p_import uuid default null, p_today date default null, p_closed text[] default '{}',
  p_contacts boolean default true
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
     -- every word typed must appear somewhere in the name, company, source and (when allowed) email or phone
     and (btrim(p_q) = '' or not exists (
           select 1 from unnest(string_to_array(lower(btrim(p_q)), ' ')) as w
            where w <> '' and strpos(lower(concat_ws(' ', p.name, p.company, case when p_contacts then p.email end, case when p_contacts then p.phone end, p.source)), w) = 0))
     and (p_stage = '' or (p_stage = 'open' and not (p.stage = any(p_closed))) or p.stage = p_stage)
     and (not p_due or (p.next_follow_up is not null and p.next_follow_up <= p_today and not (p.stage = any(p_closed))))
     and (p_tag = '' or p_tag = any(p.tags))
     and (p_import is null or p.import_id = p_import)
$$;

-- 4. Wraps text that is already stored. The app does the encrypting and sends each row's old and new text; a row is only changed
-- while it still holds the old text, so an edit made in the meantime is never overwritten.
create or replace function public.crm_seal_chunk(p_brand uuid, p_people jsonb, p_notes jsonb)
returns table (people integer, notes integer)
language plpgsql
set search_path = public
as $$
declare
  v_people integer := 0;
  v_notes integer := 0;
begin
  perform set_config('app.keep_updated_at', 'on', true);
  with r as (select * from jsonb_to_recordset(coalesce(p_people, '[]'::jsonb)) as x(id uuid, old text, new text)),
       u as (
         update crm_people p set summary = r.new from r
          where p.id = r.id and p.brand_id = p_brand and p.summary = r.old and p.summary not like 'enc:v1:%'
          returning 1)
  select count(*)::integer into v_people from u;
  with r as (select * from jsonb_to_recordset(coalesce(p_notes, '[]'::jsonb)) as x(id uuid, old text, new text)),
       u as (
         update crm_notes n set body = r.new from r
          where n.id = r.id and n.brand_id = p_brand and n.body = r.old and n.body not like 'enc:v1:%'
          returning 1)
  select count(*)::integer into v_notes from u;
  return query select v_people, v_notes;
end;
$$;

revoke all on function public.crm_find(uuid, text, text, text, boolean, text, uuid, date, text[], boolean) from public, anon, authenticated;
revoke all on function public.crm_seal_chunk(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.crm_find(uuid, text, text, text, boolean, text, uuid, date, text[], boolean) to service_role;
grant execute on function public.crm_seal_chunk(uuid, jsonb, jsonb) to service_role;
