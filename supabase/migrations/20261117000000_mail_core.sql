-- Mail: the brand's own domains and addresses, and the mail sent and received through them (Resend does the delivery).
-- Server-only: every table has RLS on and no policy, so the browser's keys cannot read or write any of it. The app reads and
-- writes with the service role after checking the person's role and the Mail access level, like time_entries does.

create table if not exists public.mail_domains (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null check (name = lower(name) and char_length(name) between 4 and 253),
  resend_id text not null,
  status text not null default 'not_started' check (status in ('not_started', 'pending', 'verified', 'failed', 'temporary_failure')),
  receiving boolean not null default false,
  records jsonb not null default '[]'::jsonb,
  verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists mail_domains_name_uidx on public.mail_domains (name);
create index if not exists mail_domains_brand_idx on public.mail_domains (brand_id);

create table if not exists public.mail_addresses (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  domain_id uuid not null references public.mail_domains(id) on delete cascade,
  local_part text not null check (local_part ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  display_name text check (display_name is null or char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  unique (domain_id, local_part)
);
create index if not exists mail_addresses_brand_idx on public.mail_addresses (brand_id);

create table if not exists public.mail_threads (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  -- The address the conversation belongs to. Kept as text too, so the history survives removing the address.
  address_id uuid references public.mail_addresses(id) on delete set null,
  mailbox text not null,
  subject text not null default '' check (char_length(subject) <= 300),
  status text not null default 'open' check (status in ('open', 'done')),
  unread boolean not null default false,
  message_count integer not null default 0,
  last_message_at timestamptz not null default now(),
  last_snippet text not null default '',
  last_from text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists mail_threads_list_idx on public.mail_threads (brand_id, status, last_message_at desc);

create table if not exists public.mail_messages (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  thread_id uuid not null references public.mail_threads(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  rfc_message_id text,
  in_reply_to text,
  refs text[] not null default '{}',
  resend_id text,
  from_email text not null,
  from_name text,
  to_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  subject text not null default '',
  text_body text not null default '',
  html_body text,
  snippet text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'received' check (status in ('received', 'sent', 'delivered', 'bounced', 'complained', 'failed')),
  error text,
  sent_by uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- Resend delivers webhooks at least once, so the Resend id is what keeps a message from being stored twice.
create unique index if not exists mail_messages_resend_uidx on public.mail_messages (resend_id) where resend_id is not null;
create index if not exists mail_messages_thread_idx on public.mail_messages (thread_id, occurred_at);
create index if not exists mail_messages_rfc_idx on public.mail_messages (brand_id, rfc_message_id) where rfc_message_id is not null;

alter table public.mail_domains enable row level security;
alter table public.mail_addresses enable row level security;
alter table public.mail_threads enable row level security;
alter table public.mail_messages enable row level security;
revoke all on public.mail_domains, public.mail_addresses, public.mail_threads, public.mail_messages from anon, authenticated;
