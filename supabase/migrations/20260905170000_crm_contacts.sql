-- ============================================================================
-- ScaleUp — CRM contacts (drag-and-drop pipeline board)
-- Stages come from the CRM builder config; contacts move across stages.
-- RLS enabled, no public policies (server-side / owner via service role).
-- ============================================================================
create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.leads(id) on delete cascade,
  name text not null,
  whatsapp text,
  email text,
  source text,
  stage text not null default '',
  value numeric,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists crm_contacts_member_idx on public.crm_contacts (member_id, stage);
alter table public.crm_contacts enable row level security;
