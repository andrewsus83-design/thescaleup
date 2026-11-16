-- ============================================================================
-- Workspace-level encrypted secrets (the agency's default API keys).
-- Same shape as brand_secrets: ciphertext only, written and read by the server
-- with the service role. No policies, so the browser can never read this table.
-- Idempotent.
-- ============================================================================
create table if not exists public.workspace_secrets (
  provider text primary key check (provider ~ '^[a-z][a-z0-9_]{0,39}$'),
  ciphertext text not null,                         -- base64(nonce || AES-256-GCM ciphertext || tag), encrypted in the app
  key_version int not null default 1,
  last4 text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspace_secrets enable row level security;
revoke all on public.workspace_secrets from anon, authenticated;

drop trigger if exists workspace_secrets_updated_at on public.workspace_secrets;
create trigger workspace_secrets_updated_at before update on public.workspace_secrets
  for each row execute function public.set_updated_at();
