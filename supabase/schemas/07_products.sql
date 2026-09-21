-- Products. Stock movements live in 10_stock_movements.sql so that they can
-- reference purchase orders, which are defined after this file.

-- Shared by products, vendors and purchase orders (all later in apply order).
create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function private.touch_updated_at() from public, anon, authenticated;

create type public.stock_status as enum ('out', 'low', 'ok');

create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  category_id         uuid not null references public.categories (id) on delete restrict,
  name                text not null,
  sku                 text not null,
  unit                text not null default 'pc',
  cost_price          numeric(12, 2) not null default 0 check (cost_price >= 0),
  sell_price          numeric(12, 2) not null default 0 check (sell_price >= 0),
  stock_qty           integer not null default 0 check (stock_qty >= 0),
  low_stock_threshold integer not null default 3 check (low_stock_threshold >= 0),
  -- Restock worklist trigger. Kept separate from low_stock_threshold because a
  -- shop may tolerate "low" for a while but still want to reorder at a
  -- different point.
  reorder_point       integer not null default 0 check (reorder_point >= 0),
  -- Derived, and stored so the inventory screen can FILTER on it server-side:
  -- "low" compares stock_qty against low_stock_threshold, which is a row-to-row
  -- comparison PostgREST cannot express as a filter. Display reads this column
  -- too, so the badge and the filter can never disagree.
  stock_status        public.stock_status generated always as (
                        case
                          when stock_qty = 0 then 'out'::public.stock_status
                          when stock_qty <= low_stock_threshold then 'low'::public.stock_status
                          else 'ok'::public.stock_status
                        end
                      ) stored,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint products_sku_key unique (sku)
);

comment on table public.products is 'Furniture catalogue. category_id restricts, so a category in use cannot be deleted.';

-- Postgres does not index FK columns automatically.
create index products_category_id_idx on public.products (category_id);

create trigger touch_products_updated_at
  before update on public.products
  for each row execute function private.touch_updated_at();

alter table public.products enable row level security;

revoke all on table public.products from anon, authenticated;
grant select, insert, update, delete on table public.products to authenticated;
grant select, insert, update, delete on table public.products to service_role;

create policy "Read products with inventory.view"
on public.products for select to authenticated
using ( (select private.has_permission('inventory.view')) );

create policy "Create products with inventory.manage"
on public.products for insert to authenticated
with check ( (select private.has_permission('inventory.manage')) );

create policy "Update products with inventory.manage"
on public.products for update to authenticated
using ( (select private.has_permission('inventory.manage')) )
with check ( (select private.has_permission('inventory.manage')) );

create policy "Delete products with inventory.manage"
on public.products for delete to authenticated
using ( (select private.has_permission('inventory.manage')) );
