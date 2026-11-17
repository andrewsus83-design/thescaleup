-- Chat audit: a batch of conversations (WhatsApp, Telegram, social media comments and DMs) read by the AI, with the numbers
-- computed from them. The chat text itself is NOT stored: only the numbers and what the AI found. Server-only like the other
-- hub tables: RLS is on with no policy. Safe to run twice.

create table if not exists public.chat_audits (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists chat_audits_brand_idx on public.chat_audits (brand_id, created_at desc);

create table if not exists public.chat_audit_items (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.chat_audits(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  platform text not null check (platform in ('whatsapp', 'telegram', 'social')),
  channel text not null default '' check (char_length(channel) <= 60),
  kind text not null check (kind in ('client', 'internal', 'system')),
  ours text[] not null default '{}',
  -- Hash of what the AI read, so the same chat uploaded again is not paid for twice.
  fingerprint text check (fingerprint is null or char_length(fingerprint) = 64),
  metrics jsonb not null default '{}'::jsonb,
  findings jsonb not null default '{}'::jsonb,
  -- The CRM lead or client this conversation belongs to, once someone links it.
  person_id uuid references public.crm_people(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists chat_audit_items_audit_idx on public.chat_audit_items (audit_id, created_at);
create index if not exists chat_audit_items_fp_idx on public.chat_audit_items (brand_id, fingerprint) where fingerprint is not null;
create index if not exists chat_audit_items_person_idx on public.chat_audit_items (person_id) where person_id is not null;

-- What was done from a finding, so pressing a button twice never makes two of anything.
-- slot: "open:2" (the third open item), "crm", "lead", "idea:0". task_id is set only for tasks; deleting the task frees the slot.
create table if not exists public.chat_audit_links (
  item_id uuid not null references public.chat_audit_items(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  kind text not null check (kind in ('task', 'crm', 'lead', 'content')),
  slot text not null check (char_length(slot) between 1 and 20),
  task_id uuid references public.tasks(id) on delete cascade,
  content_id uuid references public.content_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, kind, slot)
);

alter table public.chat_audits enable row level security;
alter table public.chat_audit_items enable row level security;
alter table public.chat_audit_links enable row level security;
revoke all on public.chat_audits, public.chat_audit_items, public.chat_audit_links from anon, authenticated;
