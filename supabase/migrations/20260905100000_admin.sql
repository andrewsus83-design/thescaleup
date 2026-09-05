-- ============================================================================
-- ScaleUp Admin Backend schema
-- All admin data is accessed server-side via the service_role key (bypasses
-- RLS) AFTER an admin session is verified. RLS is enabled with no public
-- policies, so the anon/public key can neither read nor write these tables.
-- ============================================================================

-- ── Members (the leads pipeline) ────────────────────────────────────────────
alter table public.leads alter column status set default 'pending';
update public.leads set status = 'pending' where status = 'new' or status is null;
alter table public.leads add column if not exists admin_notes text;
alter table public.leads add column if not exists processed_at timestamptz;
alter table public.leads add column if not exists joined_at timestamptz;
alter table public.leads add column if not exists report_sent_at timestamptz;

-- ── Reports ─────────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.leads(id) on delete cascade,
  title text not null,
  summary text,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft',   -- draft | final | sent
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reports_member_idx on public.reports(member_id);
create index if not exists reports_created_idx on public.reports(created_at desc);

-- ── Plans (Calendar) ────────────────────────────────────────────────────────
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.leads(id) on delete set null,
  title text not null,
  detail text,
  phase text,                              -- Phase 1 / 2 / 3
  status text not null default 'planned',  -- planned | in_progress | done
  start_date date,
  due_date date,
  created_at timestamptz not null default now()
);
create index if not exists plans_member_idx on public.plans(member_id);
create index if not exists plans_due_idx on public.plans(due_date);

-- ── Assets (gallery) ────────────────────────────────────────────────────────
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.leads(id) on delete set null,
  brand text,
  name text not null,
  kind text,                               -- image | video | audio | document | pdf | other
  mime_type text,
  size_bytes bigint,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index if not exists assets_member_idx on public.assets(member_id);
create index if not exists assets_brand_idx on public.assets(brand);

-- ── App settings (API keys, MCP config) ─────────────────────────────────────
create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

-- ── Admin users (roles / CRUD) ──────────────────────────────────────────────
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  role text not null default 'staff',      -- owner | admin | staff | viewer
  can_create boolean not null default false,
  can_read boolean not null default true,
  can_update boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now()
);
insert into public.admin_users (email, name, role, can_create, can_read, can_update, can_delete)
values ('andrewsus83@gmail.com', 'Owner', 'owner', true, true, true, true)
on conflict (email) do nothing;

-- ── RLS (locked; server uses service_role) ──────────────────────────────────
alter table public.reports       enable row level security;
alter table public.plans         enable row level security;
alter table public.assets        enable row level security;
alter table public.app_settings  enable row level security;
alter table public.admin_users   enable row level security;

-- ── Storage bucket for assets (private; served via signed URLs) ─────────────
insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do nothing;
