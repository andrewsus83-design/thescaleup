-- ============================================================================
-- ScaleUp — Brand foundation (multi-tenant)
--
-- A brand is a tenant: it has its own subdomain (slug.thescaleup.xyz), its own
-- people (founder, ops, agency staff), workflow, custom fields, goals, tasks and
-- encrypted keys. Every brand-owned row carries brand_id and is isolated by RLS.
--
-- Roles
--   platform owner  platform_admins row: sees and manages every brand.
--   founder         brand_members.role = 'founder': manages their brand and team.
--   staff           agency staff assigned to the brand: operates it, no team/keys.
--   ops             the brand's own team: works approved tasks only.
--   viewer          read-only (approved tasks and later).
--
-- The Next.js server keeps using the service_role key (bypasses RLS). These
-- policies are defense in depth and the contract for user-scoped clients.
-- Idempotent: safe to re-run in the Supabase SQL Editor.
-- ============================================================================

-- ── helpers ─────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── platform owners ─────────────────────────────────────────────────────────
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (email = lower(email)),
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now()
);

-- ── brands (tenants) ────────────────────────────────────────────────────────
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  website text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  profile jsonb not null default '{}'::jsonb,       -- brand, handles, who / what / when / where / why
  profile_version int not null default 1,
  lead_id uuid references public.leads(id) on delete set null,  -- optional link to the client row
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brands_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' and slug !~ '--'),
  constraint brands_slug_reserved check (slug not in (
    'www', 'app', 'admin', 'api', 'report', 'staging', 'mail', 'email', 'smtp', 'ftp', 'dev', 'test',
    'static', 'assets', 'cdn', 'docs', 'help', 'support', 'status', 'blog', 'billing', 'dashboard',
    'login', 'auth', 'room', 'hub', 'scaleup', 'thescaleup'
  ))
);

-- ── people ──────────────────────────────────────────────────────────────────
create table if not exists public.brand_members (
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('founder', 'staff', 'ops', 'viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (brand_id, user_id)
);
create index if not exists brand_members_user_idx on public.brand_members (user_id);

create table if not exists public.brand_invites (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('founder', 'staff', 'ops', 'viewer')),
  token_hash text not null unique,                  -- sha256 of the invite token; the token itself is sent once
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists brand_invites_open_idx
  on public.brand_invites (brand_id, email) where accepted_at is null;

-- ── role helpers (used by the policies) ─────────────────────────────────────
create or replace function public.is_platform_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

create or replace function public.brand_role(p_brand uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.brand_members where brand_id = p_brand and user_id = auth.uid()
$$;

create or replace function public.has_brand_access(p_brand uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_owner() or public.brand_role(p_brand) is not null
$$;

revoke all on function public.is_platform_owner() from public, anon;
revoke all on function public.brand_role(uuid) from public, anon;
revoke all on function public.has_brand_access(uuid) from public, anon;
grant execute on function public.is_platform_owner() to authenticated, service_role;
grant execute on function public.brand_role(uuid) to authenticated, service_role;
grant execute on function public.has_brand_access(uuid) to authenticated, service_role;

-- ── workflow: the statuses a brand's tasks move through ────────────────────
-- statuses = [{ "key", "label", "stage" }]. stage drives behaviour and visibility:
--   proposed (waiting for approval) · active · review · closed · rejected
create or replace function public.valid_workflow_statuses(s jsonb)
returns boolean language sql immutable as $$
  select case
    when s is null or jsonb_typeof(s) <> 'array' then false
    when jsonb_array_length(s) not between 1 and 20 then false
    else not exists (
           select 1 from jsonb_array_elements(s) e
           where jsonb_typeof(e) <> 'object'
              or coalesce(e->>'key', '') !~ '^[a-z][a-z0-9_]{0,39}$'
              or coalesce(e->>'label', '') = ''
              or coalesce(e->>'stage', '') not in ('proposed', 'active', 'review', 'closed', 'rejected')
         )
         and (select count(distinct e->>'key') = count(*) from jsonb_array_elements(s) e)
  end
$$;

create table if not exists public.brand_workflows (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  statuses jsonb not null default '[
    {"key":"proposed","label":"Proposed","stage":"proposed"},
    {"key":"approved","label":"Approved","stage":"active"},
    {"key":"in_progress","label":"In progress","stage":"active"},
    {"key":"review","label":"Review","stage":"review"},
    {"key":"done","label":"Done","stage":"closed"},
    {"key":"rejected","label":"Rejected","stage":"rejected"}
  ]'::jsonb check (public.valid_workflow_statuses(statuses)),
  approval_required boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ── custom fields: each brand defines its own task / goal schema ───────────
-- Values live in tasks.fields / goals.fields (jsonb), keyed by brand_fields.key.
create table if not exists public.brand_fields (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  entity text not null check (entity in ('task', 'goal')),
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  label text not null,
  type text not null check (type in ('text', 'long_text', 'number', 'date', 'select', 'multi_select', 'checkbox', 'url', 'person')),
  options jsonb not null default '[]'::jsonb,       -- select types: [{ "key", "label" }]
  required boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, entity, key)
);

-- ── goals ───────────────────────────────────────────────────────────────────
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  title text not null,
  description text,
  metric text,                                      -- e.g. followers, leads, revenue
  unit text,
  target numeric,
  current numeric not null default 0,
  start_date date,
  due_date date,
  status text not null default 'active' check (status in ('active', 'achieved', 'paused', 'dropped')),
  owner_id uuid references auth.users(id) on delete set null,
  fields jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists goals_brand_idx on public.goals (brand_id, status);

-- ── tasks ───────────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  title text not null,
  description text,
  status text not null,                             -- a key from brand_workflows.statuses
  stage text not null,                              -- copied from the workflow by trigger; never set by clients
  source text not null default 'manual' check (source in ('manual', 'agent', 'audit', 'automation')),
  agent text check (agent in ('cmo', 'cbo', 'ceo')),
  horizon text check (horizon in ('week1', 'd30', 'd90', 'manual')),
  check_key text,                                   -- the audit check this task fixes
  tip text,
  service text,
  assignee_id uuid references auth.users(id) on delete set null,
  due_date date,
  position double precision not null default 0,
  fields jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, brand_id)
);
create index if not exists tasks_brand_stage_idx on public.tasks (brand_id, stage);
create index if not exists tasks_assignee_idx on public.tasks (brand_id, assignee_id);
create index if not exists tasks_goal_idx on public.tasks (goal_id);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  brand_id uuid not null references public.brands(id) on delete cascade,
  author_id uuid default auth.uid() references auth.users(id) on delete set null,
  author_label text,                                -- display name for agents ("CMO")
  body text not null,
  created_at timestamptz not null default now(),
  foreign key (task_id, brand_id) references public.tasks (id, brand_id) on delete cascade
);
create index if not exists task_comments_task_idx on public.task_comments (task_id, created_at);

-- ── per-brand secrets (encrypted by the app; never readable from the browser) ─
create table if not exists public.brand_secrets (
  brand_id uuid not null references public.brands(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z][a-z0-9_]{0,39}$'),
  ciphertext text not null,                         -- base64(nonce || AES-256-GCM ciphertext || tag), encrypted in the app
  key_version int not null default 1,
  last4 text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (brand_id, provider)
);

-- ── audit log (append-only; no FKs so history survives deletions) ──────────
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  brand_id uuid,
  action text not null,
  target text,
  meta jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_brand_idx on public.audit_log (brand_id, at desc);

-- ── triggers ────────────────────────────────────────────────────────────────
-- Every brand gets a default workflow.
create or replace function public.brands_create_workflow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.brand_workflows (brand_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists brands_after_insert on public.brands;
create trigger brands_after_insert after insert on public.brands
  for each row execute function public.brands_create_workflow();

-- A brand founder can edit the profile, but not the slug (the subdomain), status or client link.
create or replace function public.brands_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_setting('role', true) = 'authenticated'
     and not public.is_platform_owner()
     and (new.slug is distinct from old.slug
          or new.status is distinct from old.status
          or new.lead_id is distinct from old.lead_id) then
    raise exception 'only a platform owner can change the slug, status or client link' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists brands_before_update on public.brands;
create trigger brands_before_update before update on public.brands
  for each row execute function public.brands_guard();

-- Tasks: the status must exist in the brand's workflow; stage is copied from it; the goal must be the same
-- brand's; brand_id never changes; approval fields are stamped by the database, not by the client.
create or replace function public.tasks_sync_stage()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_stage text;
begin
  if tg_op = 'UPDATE' and new.brand_id is distinct from old.brand_id then
    raise exception 'a task cannot move to another brand' using errcode = '23514';
  end if;

  select e->>'stage' into v_stage
  from public.brand_workflows w, jsonb_array_elements(w.statuses) e
  where w.brand_id = new.brand_id and e->>'key' = new.status
  limit 1;
  if v_stage is null then
    raise exception 'status "%" is not part of this brand''s workflow', new.status using errcode = '23514';
  end if;
  new.stage := v_stage;

  if new.goal_id is not null
     and not exists (select 1 from public.goals g where g.id = new.goal_id and g.brand_id = new.brand_id) then
    raise exception 'the goal belongs to a different brand' using errcode = '23514';
  end if;

  -- Browser sessions cannot forge approvals. The server (service role) may set them explicitly.
  if current_setting('role', true) = 'authenticated' then
    if tg_op = 'INSERT' then
      if v_stage in ('proposed', 'rejected') then
        new.approved_by := null; new.approved_at := null;
      else
        new.approved_by := auth.uid(); new.approved_at := now();
      end if;
    elsif old.stage = 'proposed' and v_stage = 'active' then
      new.approved_by := auth.uid(); new.approved_at := now();
    else
      new.approved_by := old.approved_by; new.approved_at := old.approved_at;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists tasks_before_write on public.tasks;
create trigger tasks_before_write before insert or update on public.tasks
  for each row execute function public.tasks_sync_stage();

-- Workflow edits: a status that tasks still use cannot be removed; stages are re-synced.
create or replace function public.brand_workflows_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.tasks t
    where t.brand_id = new.brand_id
      and not exists (select 1 from jsonb_array_elements(new.statuses) e where e->>'key' = t.status)
  ) then
    raise exception 'a status that tasks still use cannot be removed or renamed' using errcode = '23514';
  end if;
  update public.tasks t
     set stage = e->>'stage'
    from jsonb_array_elements(new.statuses) e
   where t.brand_id = new.brand_id and e->>'key' = t.status and t.stage is distinct from e->>'stage';
  return new;
end $$;

drop trigger if exists brand_workflows_after_update on public.brand_workflows;
create trigger brand_workflows_after_update after update of statuses on public.brand_workflows
  for each row execute function public.brand_workflows_after_update();

-- Audit log is append-only.
create or replace function public.audit_log_immutable()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'audit_log is append-only' using errcode = '42501';
end $$;

drop trigger if exists audit_log_no_change on public.audit_log;
create trigger audit_log_no_change before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();

-- updated_at
drop trigger if exists brands_updated_at on public.brands;
create trigger brands_updated_at before update on public.brands for each row execute function public.set_updated_at();
drop trigger if exists brand_workflows_updated_at on public.brand_workflows;
create trigger brand_workflows_updated_at before update on public.brand_workflows for each row execute function public.set_updated_at();
drop trigger if exists brand_fields_updated_at on public.brand_fields;
create trigger brand_fields_updated_at before update on public.brand_fields for each row execute function public.set_updated_at();
drop trigger if exists goals_updated_at on public.goals;
create trigger goals_updated_at before update on public.goals for each row execute function public.set_updated_at();
drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
drop trigger if exists brand_secrets_updated_at on public.brand_secrets;
create trigger brand_secrets_updated_at before update on public.brand_secrets for each row execute function public.set_updated_at();

-- ── row level security ──────────────────────────────────────────────────────
alter table public.platform_admins enable row level security;
alter table public.brands enable row level security;
alter table public.brand_members enable row level security;
alter table public.brand_invites enable row level security;
alter table public.brand_workflows enable row level security;
alter table public.brand_fields enable row level security;
alter table public.goals enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.brand_secrets enable row level security;
alter table public.audit_log enable row level security;

-- The public (anon) key never touches these tables; brand_secrets has no policies at all (service role only).
revoke all on public.platform_admins, public.brands, public.brand_members, public.brand_invites,
  public.brand_workflows, public.brand_fields, public.goals, public.tasks, public.task_comments,
  public.brand_secrets, public.audit_log from anon;
revoke all on public.brand_secrets from authenticated;

-- platform_admins: you can see your own row; writes are service role only.
drop policy if exists platform_admins_select on public.platform_admins;
create policy platform_admins_select on public.platform_admins for select to authenticated
  using (user_id = auth.uid());

-- brands
drop policy if exists brands_select on public.brands;
create policy brands_select on public.brands for select to authenticated
  using (public.has_brand_access(id));
drop policy if exists brands_insert on public.brands;
create policy brands_insert on public.brands for insert to authenticated
  with check (public.is_platform_owner());
drop policy if exists brands_update on public.brands;
create policy brands_update on public.brands for update to authenticated
  using (public.is_platform_owner() or public.brand_role(id) = 'founder')
  with check (public.is_platform_owner() or public.brand_role(id) = 'founder');
drop policy if exists brands_delete on public.brands;
create policy brands_delete on public.brands for delete to authenticated
  using (public.is_platform_owner());

-- brand_members: everyone in the brand sees the roster; founders and platform owners manage it.
drop policy if exists brand_members_select on public.brand_members;
create policy brand_members_select on public.brand_members for select to authenticated
  using (public.has_brand_access(brand_id));
drop policy if exists brand_members_write on public.brand_members;
create policy brand_members_write on public.brand_members for all to authenticated
  using (public.is_platform_owner() or public.brand_role(brand_id) = 'founder')
  with check (public.is_platform_owner() or public.brand_role(brand_id) = 'founder');

-- brand_invites: founders and platform owners only
drop policy if exists brand_invites_all on public.brand_invites;
create policy brand_invites_all on public.brand_invites for all to authenticated
  using (public.is_platform_owner() or public.brand_role(brand_id) = 'founder')
  with check (public.is_platform_owner() or public.brand_role(brand_id) = 'founder');

-- workflow and fields: members read; founders and platform owners edit
drop policy if exists brand_workflows_select on public.brand_workflows;
create policy brand_workflows_select on public.brand_workflows for select to authenticated
  using (public.has_brand_access(brand_id));
drop policy if exists brand_workflows_update on public.brand_workflows;
create policy brand_workflows_update on public.brand_workflows for update to authenticated
  using (public.is_platform_owner() or public.brand_role(brand_id) = 'founder')
  with check (public.is_platform_owner() or public.brand_role(brand_id) = 'founder');

drop policy if exists brand_fields_select on public.brand_fields;
create policy brand_fields_select on public.brand_fields for select to authenticated
  using (public.has_brand_access(brand_id));
drop policy if exists brand_fields_write on public.brand_fields;
create policy brand_fields_write on public.brand_fields for all to authenticated
  using (public.is_platform_owner() or public.brand_role(brand_id) = 'founder')
  with check (public.is_platform_owner() or public.brand_role(brand_id) = 'founder');

-- goals: members read; founders and staff write
drop policy if exists goals_select on public.goals;
create policy goals_select on public.goals for select to authenticated
  using (public.has_brand_access(brand_id));
drop policy if exists goals_write on public.goals;
create policy goals_write on public.goals for all to authenticated
  using (public.is_platform_owner() or public.brand_role(brand_id) in ('founder', 'staff'))
  with check (public.is_platform_owner() or public.brand_role(brand_id) in ('founder', 'staff'));

-- tasks: founders and staff see everything; ops and viewers never see proposed or rejected tasks.
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (
    public.is_platform_owner()
    or public.brand_role(brand_id) in ('founder', 'staff')
    or (public.brand_role(brand_id) in ('ops', 'viewer') and stage not in ('proposed', 'rejected'))
  );
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.is_platform_owner() or public.brand_role(brand_id) in ('founder', 'staff'));
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (
    public.is_platform_owner()
    or public.brand_role(brand_id) in ('founder', 'staff')
    or (public.brand_role(brand_id) = 'ops' and assignee_id = auth.uid() and stage in ('active', 'review'))
  )
  with check (
    public.is_platform_owner()
    or public.brand_role(brand_id) in ('founder', 'staff')
    or (public.brand_role(brand_id) = 'ops' and assignee_id = auth.uid() and stage in ('active', 'review'))
  );
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.is_platform_owner() or public.brand_role(brand_id) in ('founder', 'staff'));

-- task_comments: visible exactly when the task is visible; viewers cannot write.
drop policy if exists task_comments_select on public.task_comments;
create policy task_comments_select on public.task_comments for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_comments.task_id and t.brand_id = task_comments.brand_id));
drop policy if exists task_comments_insert on public.task_comments;
create policy task_comments_insert on public.task_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and (public.is_platform_owner() or public.brand_role(brand_id) in ('founder', 'staff', 'ops'))
    and exists (select 1 from public.tasks t where t.id = task_comments.task_id and t.brand_id = task_comments.brand_id)
  );
drop policy if exists task_comments_update on public.task_comments;
create policy task_comments_update on public.task_comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists task_comments_delete on public.task_comments;
create policy task_comments_delete on public.task_comments for delete to authenticated
  using (author_id = auth.uid() or public.is_platform_owner() or public.brand_role(brand_id) = 'founder');

-- audit_log: founders and platform owners can read; nobody writes from the browser.
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated
  using (public.is_platform_owner() or (brand_id is not null and public.brand_role(brand_id) = 'founder'));
