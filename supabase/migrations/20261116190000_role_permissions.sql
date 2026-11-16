-- ============================================================================
-- Per-brand access by role and function (what each role can open and change).
-- Only the changes from the defaults are stored; the defaults live in the app
-- (lib/hub/permissions.ts). Founders and the agency always have full access, so
-- only the other roles are stored. Written and read by the server with the
-- service role: RLS is on with no policies, so the browser cannot touch it.
-- Idempotent.
-- ============================================================================
create table if not exists public.brand_role_permissions (
  brand_id uuid not null references public.brands(id) on delete cascade,
  role text not null check (role in ('staff', 'ops', 'viewer')),
  fn text not null check (fn ~ '^[a-z][a-z0-9_]{0,39}$'),
  level text not null check (level in ('none', 'view', 'edit')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (brand_id, role, fn)
);

alter table public.brand_role_permissions enable row level security;
revoke all on public.brand_role_permissions from anon, authenticated;

drop trigger if exists brand_role_permissions_updated_at on public.brand_role_permissions;
create trigger brand_role_permissions_updated_at before update on public.brand_role_permissions
  for each row execute function public.set_updated_at();
