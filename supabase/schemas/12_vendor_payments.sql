-- Payments made to a vendor.
--
-- In this market stock is usually bought on credit and settled in instalments,
-- so what the shop owes a vendor is purchases received minus money paid. A
-- payment may settle a specific bill or just go "on account".

create type public.vendor_payment_method as enum ('cash', 'bank', 'cheque', 'online');

create table public.vendor_payments (
  id                uuid primary key default gen_random_uuid(),
  vendor_id         uuid not null references public.vendors (id) on delete restrict,
  -- Optional: which bill this settles. Empty means paid on account.
  purchase_order_id uuid references public.purchase_orders (id) on delete set null,
  amount            numeric(12, 2) not null check (amount > 0),
  method            public.vendor_payment_method not null default 'cash',
  reference         text not null default '',
  note              text not null default '',
  paid_at           timestamptz not null default now(),
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now()
);

comment on table public.vendor_payments is 'Money paid to a vendor, optionally against a specific purchase order.';

create index vendor_payments_vendor_id_idx on public.vendor_payments (vendor_id);
create index vendor_payments_purchase_order_idx on public.vendor_payments (purchase_order_id);
create index vendor_payments_paid_at_idx on public.vendor_payments (paid_at desc);

-- What is owed per vendor: what was received, less what has been paid.
--
-- security_invoker so the view obeys the caller's RLS on the underlying tables
-- rather than the view owner's privileges.
create view public.vendor_balances
with (security_invoker = true)
as
with purchased as (
  select po.vendor_id, sum(i.qty_received * i.unit_cost) as total
  from public.purchase_orders po
  join public.purchase_order_items i on i.purchase_order_id = po.id
  where po.status = 'received'
  group by po.vendor_id
),
paid as (
  select vendor_id, sum(amount) as total
  from public.vendor_payments
  group by vendor_id
)
select
  v.id    as vendor_id,
  v.name  as vendor_name,
  -- Contact details are carried here so the vendors list can search and page
  -- over one relation instead of joining a view to its own base table.
  v.phone as phone,
  v.city  as city,
  coalesce(pu.total, 0)::numeric(14, 2) as purchased_total,
  coalesce(pd.total, 0)::numeric(14, 2) as paid_total,
  (coalesce(pu.total, 0) - coalesce(pd.total, 0))::numeric(14, 2) as outstanding
from public.vendors v
left join purchased pu on pu.vendor_id = v.id
left join paid pd on pd.vendor_id = v.id;

comment on view public.vendor_balances is 'Purchases received minus payments made, per vendor.';

-- Row Level Security -------------------------------------------------------

alter table public.vendor_payments enable row level security;

revoke all on table public.vendor_payments from anon, authenticated;
grant select, insert, update, delete on table public.vendor_payments to authenticated;
grant select, insert, update, delete on table public.vendor_payments to service_role;

revoke all on public.vendor_balances from anon, authenticated;
grant select on public.vendor_balances to authenticated;
grant select on public.vendor_balances to service_role;

create policy "Read vendor payments with inventory.view"
on public.vendor_payments for select to authenticated
using ( (select private.has_permission('inventory.view')) );

create policy "Record vendor payments with inventory.manage"
on public.vendor_payments for insert to authenticated
with check ( (select private.has_permission('inventory.manage')) );

create policy "Correct vendor payments with inventory.manage"
on public.vendor_payments for update to authenticated
using ( (select private.has_permission('inventory.manage')) )
with check ( (select private.has_permission('inventory.manage')) );

create policy "Delete vendor payments with inventory.manage"
on public.vendor_payments for delete to authenticated
using ( (select private.has_permission('inventory.manage')) );
