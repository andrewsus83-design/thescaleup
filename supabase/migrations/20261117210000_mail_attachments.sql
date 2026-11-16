-- Files attached to outgoing mail. The file itself is in the private R2 bucket; this row says whose it is and which message carries it.
-- A row with no message_id is an upload that was never sent (the person closed the page): a cleanup removes those later.
-- Server-only like the other Mail tables: RLS is on with no policy, so the browser's keys cannot read or write any of it.

create table if not exists public.mail_attachments (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  message_id uuid references public.mail_messages(id) on delete set null,
  filename text not null check (char_length(filename) between 1 and 200),
  content_type text not null default 'application/octet-stream' check (char_length(content_type) <= 120),
  size bigint not null check (size > 0 and size <= 26214400),
  storage_key text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists mail_attachments_message_idx on public.mail_attachments (message_id) where message_id is not null;
create index if not exists mail_attachments_loose_idx on public.mail_attachments (created_at) where message_id is null;
create index if not exists mail_attachments_brand_idx on public.mail_attachments (brand_id);

alter table public.mail_attachments enable row level security;
revoke all on public.mail_attachments from anon, authenticated;
