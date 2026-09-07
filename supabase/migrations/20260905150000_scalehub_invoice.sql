-- ============================================================================
-- ScaleUp — ScaleHub (content hub) + Invoice Scope/Terms
-- Run in Supabase SQL Editor. RLS enabled, no public policies (server uses
-- the service-role key; public ScaleHub pages read via server components).
-- ============================================================================

-- ── ScaleHub articles (ScaleUp editorial + client-authored) ─────────────────
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text not null default '',
  category text not null default 'Insight',
  cover_url text,
  content jsonb not null default '[]'::jsonb,      -- Block[] (p | h2 | ul)
  author_type text not null default 'client',       -- 'scaleup' | 'client'
  author_name text not null default '',              -- brand/business shown as author
  member_id uuid references public.leads(id) on delete set null,
  read_minutes int not null default 4,
  status text not null default 'draft',              -- 'draft' | 'published'
  featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists articles_status_pub_idx on public.articles (status, published_at desc);
create index if not exists articles_member_idx on public.articles (member_id);
alter table public.articles enable row level security;

-- ── Invoice: Scope of Work + Terms & Conditions ─────────────────────────────
alter table public.invoices add column if not exists scope jsonb not null default '[]'::jsonb;
alter table public.invoices add column if not exists terms text;
