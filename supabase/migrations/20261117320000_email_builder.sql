-- Email builder: templates, campaigns, who each campaign went to, and the people who must not be emailed again.
-- Server-only like the other hub tables: RLS is on with no policy. Safe to run twice.

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  -- subject, preheader, accent colour, footer and the blocks (see lib/hub/email/model.ts)
  doc jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists email_templates_brand_idx on public.email_templates (brand_id, updated_at desc);
drop trigger if exists email_templates_updated_at on public.email_templates;
create trigger email_templates_updated_at before update on public.email_templates for each row execute function public.set_updated_at();

create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  doc jsonb not null,
  address_id uuid references public.mail_addresses(id) on delete set null,
  -- who gets it: { kinds: ["lead","client"], stages: [...] } (empty stages = every stage)
  audience jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent')),
  total integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  -- The person who confirmed that everyone on the list agreed to receive this brand's email.
  consent_by uuid references auth.users(id) on delete set null,
  consent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists email_campaigns_brand_idx on public.email_campaigns (brand_id, created_at desc);
drop trigger if exists email_campaigns_updated_at on public.email_campaigns;
create trigger email_campaigns_updated_at before update on public.email_campaigns for each row execute function public.set_updated_at();

create table if not exists public.email_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  person_id uuid references public.crm_people(id) on delete set null,
  email text not null check (char_length(email) between 3 and 254 and email = lower(email)),
  -- what the merge tags need ({ name, company }), kept so a queued send does not depend on the CRM row staying as it was
  vars jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'bounced', 'complained')),
  resend_id text,
  error text check (error is null or char_length(error) <= 300),
  sent_at timestamptz,
  unique (campaign_id, email)
);
create index if not exists email_sends_queue_idx on public.email_sends (campaign_id, status);
create index if not exists email_sends_resend_idx on public.email_sends (resend_id) where resend_id is not null;

create table if not exists public.email_suppressions (
  brand_id uuid not null references public.brands(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254 and email = lower(email)),
  reason text not null check (reason in ('unsubscribed', 'bounced', 'complained', 'manual')),
  created_at timestamptz not null default now(),
  primary key (brand_id, email)
);

alter table public.email_templates enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_sends enable row level security;
alter table public.email_suppressions enable row level security;
revoke all on public.email_templates, public.email_campaigns, public.email_sends, public.email_suppressions from anon, authenticated;
