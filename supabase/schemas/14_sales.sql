-- Sales and their line items.

create type public.payment_method as enum ('cash', 'card', 'bank');

create type public.sale_status as enum ('paid', 'unpaid');

-- Invoice numbers come from a sequence so they survive a reload and cannot
-- collide, unlike the old client-side count of the in-memory array.
create sequence public.invoice_number_seq start with 1001;

create table public.sales (
  id             uuid primary key default gen_random_uuid(),
  invoice_no     text not null,
  -- NULL means a walk-in customer.
  customer_id    uuid references public.customers (id) on delete set null,
  subtotal       numeric(12, 2) not null default 0 check (subtotal >= 0),
  discount       numeric(12, 2) not null default 0 check (discount >= 0),
  total          numeric(12, 2) not null default 0 check (total >= 0),
  payment_method public.payment_method not null default 'cash',
  status         public.sale_status not null default 'paid',
  sold_at        timestamptz not null default now(),
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint sales_invoice_no_key unique (invoice_no)
);

comment on table public.sales is 'Completed sales. customer_id is null for walk-ins.';

create index sales_customer_id_idx on public.sales (customer_id);
create index sales_sold_at_idx on public.sales (sold_at desc);

create table public.sale_items (
  id         uuid primary key default gen_random_uuid(),
  sale_id    uuid not null references public.sales (id) on delete cascade,
  -- Nullable so a product can still be hard-deleted; the snapshot below keeps
  -- the invoice readable, which is what the app already assumed.
  product_id uuid references public.products (id) on delete set null,
  name       text not null,
  qty        integer not null check (qty > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) not null check (line_total >= 0)
);

comment on table public.sale_items is 'Line items. name and unit_price are snapshots taken at sale time.';

create index sale_items_sale_id_idx on public.sale_items (sale_id);
create index sale_items_product_id_idx on public.sale_items (product_id);

-- Row Level Security -------------------------------------------------------

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

revoke all on table public.sales from anon, authenticated;
revoke all on table public.sale_items from anon, authenticated;

-- Sales are records: they can be created and their status corrected, but not
-- deleted. Voiding one would have to put the stock back, which is a feature in
-- its own right rather than a policy.
grant select, insert, update on table public.sales to authenticated;
grant select, insert on table public.sale_items to authenticated;

grant select, insert, update, delete on table public.sales to service_role;
grant select, insert, update, delete on table public.sale_items to service_role;

create policy "Read sales with sales.view"
on public.sales for select to authenticated
using ( (select private.has_permission('sales.view')) );

create policy "Create sales with sales.manage"
on public.sales for insert to authenticated
with check ( (select private.has_permission('sales.manage')) );

create policy "Update sales with sales.manage"
on public.sales for update to authenticated
using ( (select private.has_permission('sales.manage')) )
with check ( (select private.has_permission('sales.manage')) );

create policy "Read sale items with sales.view"
on public.sale_items for select to authenticated
using ( (select private.has_permission('sales.view')) );

create policy "Create sale items with sales.manage"
on public.sale_items for insert to authenticated
with check ( (select private.has_permission('sales.manage')) );
