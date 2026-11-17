-- Public lead capture forms. A manager makes a form in CRM > Forms and shares its link (or embeds it); whoever fills it in becomes
-- a lead at the brand's first lead stage, with the form's tags and source. Server-only like the rest of the hub: RLS on, no policy.

create table if not exists public.crm_forms (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  -- The public address is /f/<token>. Random, so a form cannot be found by counting up.
  token text not null unique check (token ~ '^[a-z0-9]{12}$'),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  title text not null default '' check (char_length(title) <= 120),
  intro text not null default '' check (char_length(intro) <= 600),
  thanks text not null default '' check (char_length(thanks) <= 300),
  email_mode text not null default 'required' check (email_mode in ('off', 'optional', 'required')),
  phone_mode text not null default 'optional' check (phone_mode in ('off', 'optional', 'required')),
  ask_company boolean not null default false,
  ask_message boolean not null default true,
  -- The sentence next to the tick box. Empty means no tick box.
  consent_text text not null default '' check (char_length(consent_text) <= 300),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  source text not null default '' check (char_length(source) <= 60),
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_forms_contact check (email_mode <> 'off' or phone_mode <> 'off')
);
create index if not exists crm_forms_brand_idx on public.crm_forms (brand_id, created_at desc);
drop trigger if exists crm_forms_updated_at on public.crm_forms;
create trigger crm_forms_updated_at before update on public.crm_forms for each row execute function public.set_updated_at();

-- One row per answer: for the counts on the form list and to stop one connection flooding a form. The connection is kept as a
-- one-way hash, never as an address.
create table if not exists public.crm_form_entries (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.crm_forms(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  person_id uuid references public.crm_people(id) on delete set null,
  created boolean not null,
  ip_hash text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists crm_form_entries_form_idx on public.crm_form_entries (form_id, created_at desc);
create index if not exists crm_form_entries_ip_idx on public.crm_form_entries (form_id, ip_hash, created_at desc);

alter table public.crm_forms enable row level security;
alter table public.crm_form_entries enable row level security;
revoke all on public.crm_forms, public.crm_form_entries from anon, authenticated;

-- Saves one answer. Someone already in the CRM (same email, or same phone number) is not added twice and is not changed by what a
-- stranger typed into a public form: they get a note and move to the top of the list. The notes are written by the app.
create or replace function public.crm_capture(
  p_brand uuid, p_form uuid, p_name text, p_company text, p_email text, p_phone text,
  p_source text, p_stage text, p_tags text[], p_note_new text, p_note_again text, p_ip text default ''
)
returns table (res_id uuid, res_created boolean)
language plpgsql
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_key text := crm_phone_key(p_phone);
  v_id uuid;
  v_label text;
  v_created boolean;
begin
  select f.name into v_label from crm_forms f where f.id = p_form and f.brand_id = p_brand and f.enabled;
  if v_label is null then
    raise exception 'This form is not available.' using errcode = '42501';
  end if;
  -- One answer at a time per person, so two quick submissions do not make two people.
  perform pg_advisory_xact_lock(hashtextextended(p_brand::text || ':' || coalesce(nullif(v_email, ''), v_key, lower(btrim(p_name))), 0));

  select p.id into v_id from crm_people p
   where p.brand_id = p_brand
     and ((v_email <> '' and p.email <> '' and lower(p.email) = v_email)
          or (v_key is not null and p.phone <> '' and crm_phone_key(p.phone) = v_key))
   order by p.created_at limit 1;

  if v_id is null then
    insert into crm_people (brand_id, kind, name, company, email, phone, source, stage, tags)
    values (p_brand, 'lead', btrim(p_name), coalesce(btrim(p_company), ''), v_email, coalesce(btrim(p_phone), ''), coalesce(p_source, ''), p_stage, coalesce(p_tags, '{}'))
    returning id into v_id;
    insert into crm_stage_log (brand_id, person_id, kind, from_stage, to_stage) values (p_brand, v_id, 'lead', null, p_stage);
    if btrim(coalesce(p_note_new, '')) <> '' then
      insert into crm_notes (brand_id, person_id, body, author_label) values (p_brand, v_id, p_note_new, 'Form: ' || v_label);
    end if;
    v_created := true;
  else
    update crm_people set updated_at = now() where id = v_id;
    if btrim(coalesce(p_note_again, '')) <> '' then
      insert into crm_notes (brand_id, person_id, body, author_label) values (p_brand, v_id, p_note_again, 'Form: ' || v_label);
    end if;
    v_created := false;
  end if;

  insert into crm_form_entries (form_id, brand_id, person_id, created, ip_hash) values (p_form, p_brand, v_id, v_created, coalesce(p_ip, ''));
  return query select v_id, v_created;
end;
$$;

revoke all on function public.crm_capture(uuid, uuid, text, text, text, text, text, text, text[], text, text, text) from public, anon, authenticated;
grant execute on function public.crm_capture(uuid, uuid, text, text, text, text, text, text, text[], text, text, text) to service_role;
