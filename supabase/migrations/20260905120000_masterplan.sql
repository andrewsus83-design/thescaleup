-- ============================================================================
-- ScaleUp — Master Plan pipeline + Client Dashboard (Platform 3)
-- Onboarding → Approve → Report → Master Plan → Invoice → Paid → Client portal.
-- All server-side via service_role; RLS enabled, no public policies.
-- ============================================================================

-- ── Members: approval + client access ───────────────────────────────────────
alter table public.leads add column if not exists approved_at timestamptz;
alter table public.leads add column if not exists access_token text;
alter table public.leads add column if not exists paid_at timestamptz;

-- ── Master plans (one per report iteration) ─────────────────────────────────
create table if not exists public.master_plans (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.leads(id) on delete cascade,
  report_id uuid references public.reports(id) on delete set null,
  title text not null,
  version int not null default 1,
  status text not null default 'active',        -- active | archived | recycled
  created_at timestamptz not null default now()
);
create index if not exists master_plans_member_idx on public.master_plans(member_id);

-- ── Plan items (kanban) ─────────────────────────────────────────────────────
create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(),
  master_plan_id uuid references public.master_plans(id) on delete cascade,
  member_id uuid references public.leads(id) on delete cascade,
  title text not null,
  detail text,
  category text default 'general',              -- cmo | cbo | cto | creative | general
  phase text,                                   -- phase_1 | phase_2 | phase_3
  priority text not null default 'medium',      -- low | medium | high
  status text not null default 'backlog',       -- approval | pending | backlog | on_progress | in_review | implemented | done
  due_date date,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists plan_items_plan_idx on public.plan_items(master_plan_id);
create index if not exists plan_items_member_idx on public.plan_items(member_id);

-- ── Invoices ────────────────────────────────────────────────────────────────
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.leads(id) on delete cascade,
  master_plan_id uuid references public.master_plans(id) on delete set null,
  number text not null,
  currency text not null default 'IDR',
  amount numeric not null default 0,
  items jsonb not null default '[]'::jsonb,      -- [{desc, qty, price}]
  status text not null default 'draft',          -- draft | sent | paid | void
  issued_at timestamptz not null default now(),
  due_date date,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invoices_member_idx on public.invoices(member_id);

-- ── Reminders / Todos ───────────────────────────────────────────────────────
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.leads(id) on delete cascade,
  title text not null,
  detail text,
  done boolean not null default false,
  due_date date,
  audience text not null default 'client',       -- client | admin
  created_at timestamptz not null default now()
);
create index if not exists reminders_member_idx on public.reminders(member_id);

alter table public.master_plans enable row level security;
alter table public.plan_items   enable row level security;
alter table public.invoices     enable row level security;
alter table public.reminders    enable row level security;
