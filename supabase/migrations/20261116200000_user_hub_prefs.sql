-- ============================================================================
-- Per-person app preferences (for now: which four menus sit on the phone's
-- bottom bar). Written and read by the server with the service role: RLS is on
-- with no policies, so the browser cannot touch it. Idempotent.
-- ============================================================================
create table if not exists public.hub_user_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone_tabs text[] not null default '{}' check (cardinality(phone_tabs) <= 4),
  updated_at timestamptz not null default now()
);

alter table public.hub_user_prefs enable row level security;
revoke all on public.hub_user_prefs from anon, authenticated;

drop trigger if exists hub_user_prefs_updated_at on public.hub_user_prefs;
create trigger hub_user_prefs_updated_at before update on public.hub_user_prefs
  for each row execute function public.set_updated_at();
