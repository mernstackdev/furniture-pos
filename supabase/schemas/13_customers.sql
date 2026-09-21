-- Customers. Deliberately light: this is a counter-sales shop, not a CRM.
-- A sale with no customer attached is a walk-in.

create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null,
  address    text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customers is 'Shop customers. Sales with a null customer_id are walk-ins.';

-- No unique constraint on phone: families share a number.
create index customers_name_idx on public.customers (lower (name));

create trigger touch_customers_updated_at
  before update on public.customers
  for each row execute function private.touch_updated_at();

alter table public.customers enable row level security;

revoke all on table public.customers from anon, authenticated;
grant select, insert, update, delete on table public.customers to authenticated;
grant select, insert, update, delete on table public.customers to service_role;

create policy "Read customers with sales.view"
on public.customers for select to authenticated
using ( (select private.has_permission('sales.view')) );

create policy "Create customers with customers.manage"
on public.customers for insert to authenticated
with check ( (select private.has_permission('customers.manage')) );

create policy "Update customers with customers.manage"
on public.customers for update to authenticated
using ( (select private.has_permission('customers.manage')) )
with check ( (select private.has_permission('customers.manage')) );

create policy "Delete customers with customers.manage"
on public.customers for delete to authenticated
using ( (select private.has_permission('customers.manage')) );
