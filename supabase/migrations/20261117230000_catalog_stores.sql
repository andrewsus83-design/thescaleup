-- Products catalog and Stores: one row per product (SKU) for a brand, and how many of it each store has.
-- A store is a place that sells (a Desty account, a Shopify shop, a POS outlet, a marketplace shop). Stock is summed across stores in the app.
-- Server-only like the other hub tables: RLS is on with no policy, so the browser's keys cannot read or write any of it.

create table if not exists public.catalog_stores (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null default 'other' check (kind in ('desty', 'shopify', 'pos', 'marketplace', 'other')),
  last_import_at timestamptz,
  last_import_rows integer check (last_import_rows is null or last_import_rows >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists catalog_stores_name_uidx on public.catalog_stores (brand_id, lower(name));

create table if not exists public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  -- As the person writes it, and the same trimmed and lower-cased: "ABC-1" and "abc-1 " are one product.
  sku text not null check (char_length(sku) between 1 and 64),
  sku_key text not null check (char_length(sku_key) between 1 and 64),
  name text not null default '' check (char_length(name) <= 200),
  price numeric(14, 2) check (price is null or price >= 0),
  -- A product counts as low when its total stock is at or below this; the app uses 5 when it is empty.
  low_stock integer check (low_stock is null or low_stock between 0 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists catalog_products_sku_uidx on public.catalog_products (brand_id, sku_key);
drop trigger if exists catalog_products_updated_at on public.catalog_products;
create trigger catalog_products_updated_at before update on public.catalog_products for each row execute function public.set_updated_at();

create table if not exists public.catalog_stock (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  store_id uuid not null references public.catalog_stores(id) on delete cascade,
  product_id uuid not null references public.catalog_products(id) on delete cascade,
  -- Can be below zero: a store that sold more than it had says so.
  stock integer not null check (stock between -1000000 and 100000000),
  price numeric(14, 2) check (price is null or price >= 0),
  synced_at timestamptz not null default now(),
  unique (store_id, product_id)
);
create index if not exists catalog_stock_product_idx on public.catalog_stock (brand_id, product_id);

alter table public.catalog_stores enable row level security;
alter table public.catalog_products enable row level security;
alter table public.catalog_stock enable row level security;
revoke all on public.catalog_stores, public.catalog_products, public.catalog_stock from anon, authenticated;

-- The rows of an import chunk as a table: SKU tidied, one row per SKU (stock added up if a chunk repeats one).
create or replace function public.catalog_import_src(p_rows jsonb)
returns table (sku text, sku_key text, name text, price numeric, stock integer)
language sql
immutable
set search_path = public
as $$
  select min(s.sku), lower(s.sku), min(s.name), min(s.price), sum(s.stock)::integer
  from (
    select btrim(regexp_replace(r ->> 'sku', '\s+', ' ', 'g')) as sku,
           btrim(coalesce(r ->> 'name', '')) as name,
           nullif(r ->> 'price', '')::numeric as price,
           (r ->> 'stock')::integer as stock
    from jsonb_array_elements(p_rows) r
  ) s
  where s.sku <> ''
  group by lower(s.sku);
$$;

-- One chunk of an import: creates the products that are new, fills in a name or price that was empty, and sets this store's stock.
-- Returns how many products were new and how many already existed. All or nothing, so a failed chunk leaves nothing half done.
create or replace function public.catalog_import_chunk(p_brand uuid, p_store uuid, p_rows jsonb)
returns table (created integer, existing integer)
language plpgsql
set search_path = public
as $$
declare
  v_total integer;
  v_created integer;
begin
  if not exists (select 1 from catalog_stores where id = p_store and brand_id = p_brand) then
    raise exception 'That store does not belong to this brand.' using errcode = '42501';
  end if;

  select count(*) into v_total from catalog_import_src(p_rows);

  insert into catalog_products (brand_id, sku, sku_key, name, price)
  select p_brand, s.sku, s.sku_key, s.name, s.price from catalog_import_src(p_rows) s
  on conflict (brand_id, sku_key) do nothing;
  get diagnostics v_created = row_count;

  update catalog_products p
     set name = case when p.name = '' then s.name else p.name end,
         price = coalesce(p.price, s.price)
    from catalog_import_src(p_rows) s
   where p.brand_id = p_brand and p.sku_key = s.sku_key
     and ((p.name = '' and s.name <> '') or (p.price is null and s.price is not null));

  insert into catalog_stock (brand_id, store_id, product_id, stock, price, synced_at)
  select p_brand, p_store, p.id, s.stock, s.price, now()
    from catalog_import_src(p_rows) s
    join catalog_products p on p.brand_id = p_brand and p.sku_key = s.sku_key
  on conflict (store_id, product_id) do update
    set stock = excluded.stock, price = excluded.price, synced_at = excluded.synced_at;

  return query select v_created, v_total - v_created;
end;
$$;

-- The catalog for the Products page in one piece: each product with its stock in every store. Done here because the API returns
-- at most 1,000 rows per request, and one product can have many stores.
create or replace function public.catalog_list(p_brand uuid, p_limit integer default 3000)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'total', (select count(*) from catalog_products where brand_id = p_brand),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'sku', q.sku, 'name', q.name, 'price', q.price, 'low', q.low_stock,
        'stores', coalesce((
          select jsonb_agg(jsonb_build_object('storeId', s.store_id, 'stock', s.stock, 'price', s.price, 'at', s.synced_at))
          from catalog_stock s where s.product_id = q.id
        ), '[]'::jsonb)
      ) order by q.rn)
      from (
        select p.*, row_number() over (order by lower(coalesce(nullif(p.name, ''), p.sku)), p.id) as rn
        from catalog_products p where p.brand_id = p_brand
        order by rn limit p_limit
      ) q
    ), '[]'::jsonb)
  );
$$;

-- Only the server (service role) may call these.
revoke all on function public.catalog_import_src(jsonb) from public, anon, authenticated;
revoke all on function public.catalog_import_chunk(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.catalog_list(uuid, integer) from public, anon, authenticated;
grant execute on function public.catalog_import_src(jsonb) to service_role;
grant execute on function public.catalog_import_chunk(uuid, uuid, jsonb) to service_role;
grant execute on function public.catalog_list(uuid, integer) to service_role;
