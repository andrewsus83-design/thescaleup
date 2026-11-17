-- CRM import from a file: adds leads or clients in batches, leaving out anyone already in the brand's CRM.
-- A person counts as already there when the email matches (any capitals), or the phone number matches (spaces, dashes and a
-- leading 0 or +62 do not matter), or, for a row with neither, the name and company match.
-- Each batch is written in one go together with its stage log, so a failed batch leaves nothing half-done.

-- A phone number reduced to its digits, with a leading 0 read as Indonesia's 62. null when it is too short to compare.
create or replace function public.crm_phone_key(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) < 6 then null
    when regexp_replace(p, '\D', '', 'g') like '0%' then '62' || substr(regexp_replace(p, '\D', '', 'g'), 2)
    else regexp_replace(p, '\D', '', 'g')
  end
$$;

create index if not exists crm_people_email_key_idx on public.crm_people (brand_id, lower(email)) where email <> '';
create index if not exists crm_people_phone_key_idx on public.crm_people (brand_id, public.crm_phone_key(phone)) where phone <> '';
create index if not exists crm_people_name_key_idx on public.crm_people (brand_id, lower(name));

create or replace function public.crm_import_chunk(p_brand uuid, p_kind text, p_by uuid, p_rows jsonb)
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
    insert into crm_people (brand_id, kind, name, company, email, phone, source, stage, value, next_follow_up, summary, created_by)
    select p_brand, p_kind, f.name, f.company, f.email, f.phone, f.source, f.stage, f.value, f.next_follow_up, f.summary, p_by from fresh f
    returning id, kind, stage
  ),
  logged as (
    insert into crm_stage_log (brand_id, person_id, kind, from_stage, to_stage, changed_by)
    select p_brand, i.id, i.kind, null, i.stage, p_by from ins i
    returning 1
  )
  select count(*)::integer into v_created from ins;

  return query select v_created, v_total - v_created;
end;
$$;

revoke all on function public.crm_phone_key(text) from public, anon, authenticated;
revoke all on function public.crm_import_chunk(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.crm_phone_key(text) to service_role;
grant execute on function public.crm_import_chunk(uuid, text, uuid, jsonb) to service_role;
