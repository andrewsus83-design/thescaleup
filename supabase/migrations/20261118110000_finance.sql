-- Finance, simple books: money in and money out, invoices, and monthly totals.
-- Service role only: the app checks the person's role and the Finance access before every read or write.
-- Amounts are whole numbers in hundredths of the currency unit, so sums never drift.

create table if not exists public.fin_settings (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  currency text not null default 'IDR' check (currency ~ '^[A-Z]{3}$'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.fin_invoices (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  number text not null check (char_length(number) between 1 and 40),
  client text not null check (char_length(client) between 1 and 120),
  issued date not null,
  due date not null,
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000000),
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'void')),
  paid_on date,
  note text not null default '' check (char_length(note) <= 300),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (due >= issued),
  check ((status = 'paid') = (paid_on is not null))
);
-- An invoice number is used once per brand.
create unique index if not exists fin_invoices_number_idx on public.fin_invoices (brand_id, lower(number));
create index if not exists fin_invoices_brand_idx on public.fin_invoices (brand_id, status, due);

create table if not exists public.fin_entries (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  kind text not null check (kind in ('in', 'out')),
  day date not null,
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000000),
  category text not null check (char_length(category) between 1 and 40),
  note text not null default '' check (char_length(note) <= 300),
  invoice_id uuid references public.fin_invoices(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists fin_entries_brand_day_idx on public.fin_entries (brand_id, day desc, created_at desc);
-- A paid invoice has exactly one payment, so marking it paid twice cannot count the money twice.
create unique index if not exists fin_entries_one_per_invoice on public.fin_entries (invoice_id) where invoice_id is not null;

-- Totals per month, kind and category, added up in the database so they are right however many entries there are.
create or replace function public.fin_month_totals(p_brand uuid, p_from date, p_to date)
returns table (month text, kind text, category text, total numeric, entries bigint)
language sql stable
set search_path = ''
as $$
  select to_char(e.day, 'YYYY-MM'), e.kind, e.category, sum(e.amount_cents), count(*)
  from public.fin_entries e
  where e.brand_id = p_brand and e.day >= p_from and e.day <= p_to
  group by 1, 2, 3
$$;

-- Paying an invoice changes two things at once (the invoice, and one money-in entry). These two functions do both in one step,
-- so the invoice and the books can never disagree, and a double click cannot count the money twice.
-- They answer 'ok', 'missing', or the status the invoice was found in.
create or replace function public.fin_pay_invoice(p_brand uuid, p_invoice uuid, p_paid_on date, p_user uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  inv public.fin_invoices%rowtype;
begin
  select * into inv from public.fin_invoices where id = p_invoice and brand_id = p_brand for update;
  if not found then return 'missing'; end if;
  if inv.status <> 'unpaid' then return inv.status; end if;
  update public.fin_invoices set status = 'paid', paid_on = p_paid_on where id = inv.id;
  insert into public.fin_entries (brand_id, kind, day, amount_cents, category, note, invoice_id, created_by)
  values (p_brand, 'in', p_paid_on, inv.amount_cents, 'Sales', left('Invoice ' || inv.number || ', ' || inv.client, 300), inv.id, p_user);
  return 'ok';
end;
$$;

create or replace function public.fin_unpay_invoice(p_brand uuid, p_invoice uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  inv public.fin_invoices%rowtype;
begin
  select * into inv from public.fin_invoices where id = p_invoice and brand_id = p_brand for update;
  if not found then return 'missing'; end if;
  delete from public.fin_entries where invoice_id = inv.id and brand_id = p_brand;
  update public.fin_invoices set status = 'unpaid', paid_on = null where id = inv.id;
  return 'ok';
end;
$$;

alter table public.fin_settings enable row level security;
alter table public.fin_invoices enable row level security;
alter table public.fin_entries enable row level security;
revoke all on public.fin_settings, public.fin_invoices, public.fin_entries from anon, authenticated;
revoke all on function public.fin_month_totals(uuid, date, date) from public, anon, authenticated;
revoke all on function public.fin_pay_invoice(uuid, uuid, date, uuid) from public, anon, authenticated;
revoke all on function public.fin_unpay_invoice(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fin_month_totals(uuid, date, date) to service_role;
grant execute on function public.fin_pay_invoice(uuid, uuid, date, uuid) to service_role;
grant execute on function public.fin_unpay_invoice(uuid, uuid) to service_role;
