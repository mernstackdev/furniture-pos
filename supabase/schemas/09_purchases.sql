-- Purchases. Stock normally arrives by receiving a purchase order rather than
-- by hand-adjusting quantities, which is what makes cost and provenance
-- traceable.

create type public.purchase_status as enum ('draft', 'ordered', 'received', 'cancelled');

create table public.purchase_orders (
  id          uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  -- The vendor's own bill / invoice number, for reconciliation.
  reference   text not null default '',
  status      public.purchase_status not null default 'draft',
  notes       text not null default '',
  ordered_at  timestamptz,
  received_at timestamptz,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.purchase_orders is 'Stock purchases from a vendor. Receiving one increases stock and writes movements.';

create index purchase_orders_vendor_id_idx on public.purchase_orders (vendor_id);
create index purchase_orders_status_idx on public.purchase_orders (status);
create index purchase_orders_created_at_idx on public.purchase_orders (created_at desc);

create table public.purchase_order_items (
  id                uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  product_id        uuid not null references public.products (id) on delete restrict,
  qty_ordered       integer not null check (qty_ordered > 0),
  qty_received      integer not null default 0 check (qty_received >= 0),
  unit_cost         numeric(12, 2) not null default 0 check (unit_cost >= 0),
  constraint purchase_order_items_unique unique (purchase_order_id, product_id)
);

create index purchase_order_items_order_idx on public.purchase_order_items (purchase_order_id);
create index purchase_order_items_product_idx on public.purchase_order_items (product_id);

create trigger touch_purchase_orders_updated_at
  before update on public.purchase_orders
  for each row execute function private.touch_updated_at();

-- Row Level Security -------------------------------------------------------

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

revoke all on table public.purchase_orders from anon, authenticated;
revoke all on table public.purchase_order_items from anon, authenticated;

grant select, insert, update, delete on table public.purchase_orders to authenticated;
grant select, insert, update, delete on table public.purchase_order_items to authenticated;

grant select, insert, update, delete on table public.purchase_orders to service_role;
grant select, insert, update, delete on table public.purchase_order_items to service_role;

create policy "Read purchase orders with inventory.view"
on public.purchase_orders for select to authenticated
using ( (select private.has_permission('inventory.view')) );

create policy "Create purchase orders with inventory.manage"
on public.purchase_orders for insert to authenticated
with check ( (select private.has_permission('inventory.manage')) );

create policy "Update purchase orders with inventory.manage"
on public.purchase_orders for update to authenticated
using ( (select private.has_permission('inventory.manage')) )
with check ( (select private.has_permission('inventory.manage')) );

create policy "Delete purchase orders with inventory.manage"
on public.purchase_orders for delete to authenticated
using ( (select private.has_permission('inventory.manage')) );

create policy "Read purchase items with inventory.view"
on public.purchase_order_items for select to authenticated
using ( (select private.has_permission('inventory.view')) );

create policy "Create purchase items with inventory.manage"
on public.purchase_order_items for insert to authenticated
with check ( (select private.has_permission('inventory.manage')) );

create policy "Update purchase items with inventory.manage"
on public.purchase_order_items for update to authenticated
using ( (select private.has_permission('inventory.manage')) )
with check ( (select private.has_permission('inventory.manage')) );

create policy "Delete purchase items with inventory.manage"
on public.purchase_order_items for delete to authenticated
using ( (select private.has_permission('inventory.manage')) );
