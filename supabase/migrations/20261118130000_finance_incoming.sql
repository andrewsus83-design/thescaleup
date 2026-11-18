-- Finance, money sources: payments read from a payment gateway (Xendit first) wait here until a person says what each one is.
-- The hub only reads from the gateway. Nothing about the payer is stored: no name, no account number.
-- Service role only, like the rest of Finance.

create table if not exists public.fin_incoming (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  source text not null check (source in ('xendit')),
  external_id text not null check (char_length(external_id) between 1 and 120),
  occurred_at timestamptz not null,
  day date not null,
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000000),
  fee_cents bigint not null default 0 check (fee_cents >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  channel text not null default '' check (char_length(channel) <= 40),
  reference text not null default '' check (char_length(reference) <= 120),
  status text not null default 'new' check (status in ('new', 'recorded', 'ignored')),
  entry_id uuid references public.fin_entries(id) on delete set null,
  fee_entry_id uuid references public.fin_entries(id) on delete set null,
  invoice_id uuid references public.fin_invoices(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (fee_cents <= amount_cents)
);
-- A payment is stored once, however often it is read again.
create unique index if not exists fin_incoming_once on public.fin_incoming (brand_id, source, external_id);
create index if not exists fin_incoming_brand_idx on public.fin_incoming (brand_id, status, occurred_at desc);

-- Where each source's reading has got to, so the next press carries on from there.
create table if not exists public.fin_source_state (
  brand_id uuid not null references public.brands(id) on delete cascade,
  source text not null check (source in ('xendit')),
  last_synced_at timestamptz,
  pending_until timestamptz,
  pending_started timestamptz,
  updated_at timestamptz not null default now(),
  primary key (brand_id, source)
);

-- Records one waiting payment in the books, in one step:
--   with p_invoice: that invoice becomes paid on the payment's day (only if it is unpaid and for exactly the same amount);
--   without: one money-in entry in p_category.
-- Either way the gateway's fee becomes one money-out entry. Answers 'ok', or why not.
create or replace function public.fin_record_incoming(p_brand uuid, p_incoming uuid, p_category text, p_invoice uuid, p_user uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  inc public.fin_incoming%rowtype;
  inv public.fin_invoices%rowtype;
  v_entry uuid;
  v_fee uuid;
  v_note text;
begin
  select * into inc from public.fin_incoming where id = p_incoming and brand_id = p_brand for update;
  if not found then return 'missing'; end if;
  if inc.status <> 'new' then return inc.status; end if;
  v_note := left(concat_ws(', ', initcap(inc.source), nullif(inc.channel, ''), nullif(inc.reference, '')), 300);

  if p_invoice is not null then
    select * into inv from public.fin_invoices where id = p_invoice and brand_id = p_brand for update;
    if not found then return 'no_invoice'; end if;
    if inv.status <> 'unpaid' then return 'invoice_' || inv.status; end if;
    if inv.amount_cents <> inc.amount_cents then return 'amount_differs'; end if;
    update public.fin_invoices set status = 'paid', paid_on = inc.day where id = inv.id;
    insert into public.fin_entries (brand_id, kind, day, amount_cents, category, note, invoice_id, created_by)
    values (p_brand, 'in', inc.day, inv.amount_cents, 'Sales', left('Invoice ' || inv.number || ', ' || inv.client || ' (' || v_note || ')', 300), inv.id, p_user)
    returning id into v_entry;
  else
    if p_category is null or char_length(btrim(p_category)) not between 1 and 40 then return 'no_category'; end if;
    insert into public.fin_entries (brand_id, kind, day, amount_cents, category, note, created_by)
    values (p_brand, 'in', inc.day, inc.amount_cents, btrim(p_category), v_note, p_user)
    returning id into v_entry;
  end if;

  if inc.fee_cents > 0 then
    insert into public.fin_entries (brand_id, kind, day, amount_cents, category, note, created_by)
    values (p_brand, 'out', inc.day, inc.fee_cents, 'Payment fees', left('Fee for ' || v_note, 300), p_user)
    returning id into v_fee;
  end if;

  update public.fin_incoming
  set status = 'recorded', entry_id = v_entry, fee_entry_id = v_fee, invoice_id = p_invoice, decided_by = p_user, decided_at = now()
  where id = inc.id;
  return 'ok';
end;
$$;

alter table public.fin_incoming enable row level security;
alter table public.fin_source_state enable row level security;
revoke all on public.fin_incoming, public.fin_source_state from anon, authenticated;
revoke all on function public.fin_record_incoming(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.fin_record_incoming(uuid, uuid, text, uuid, uuid) to service_role;
