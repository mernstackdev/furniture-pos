-- The stock ledger. Defined after purchase orders so a movement can point at
-- the purchase it came from.

create type public.stock_movement_type as enum ('in', 'out', 'adjustment');

create table public.stock_movements (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products (id) on delete cascade,
  movement_type     public.stock_movement_type not null,
  -- SIGNED. Replaces the old client convention where `qty` meant an absolute
  -- value for in/out but a signed one for adjustments.
  qty_change        integer not null check (qty_change <> 0),
  reason            text not null default '',
  -- Set when the movement came from receiving a purchase, so the ledger is
  -- traceable back to its source.
  purchase_order_id uuid references public.purchase_orders (id) on delete set null,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now()
);

comment on table public.stock_movements is 'Append-only stock ledger. qty_change is signed.';

create index stock_movements_product_id_idx on public.stock_movements (product_id);
create index stock_movements_created_at_idx on public.stock_movements (created_at desc);
create index stock_movements_purchase_order_idx on public.stock_movements (purchase_order_id);

alter table public.stock_movements enable row level security;

revoke all on table public.stock_movements from anon, authenticated;
-- Movements are immutable: no UPDATE or DELETE is granted or policied.
grant select, insert on table public.stock_movements to authenticated;
grant select, insert, update, delete on table public.stock_movements to service_role;

create policy "Read movements with inventory.view"
on public.stock_movements for select to authenticated
using ( (select private.has_permission('inventory.view')) );

create policy "Record movements with inventory.manage"
on public.stock_movements for insert to authenticated
with check ( (select private.has_permission('inventory.manage')) );
