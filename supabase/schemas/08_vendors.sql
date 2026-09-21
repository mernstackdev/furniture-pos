-- Vendors. In this market stock is normally bought from local manufacturers
-- and wholesalers, often on credit, so a purchase needs a counterparty record.

create table public.vendors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null,
  city       text not null default '',
  address    text not null default '',
  notes      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.vendors is 'Manufacturers and wholesalers the shop buys stock from.';

create unique index vendors_name_key on public.vendors (lower (name));

create trigger touch_vendors_updated_at
  before update on public.vendors
  for each row execute function private.touch_updated_at();

alter table public.vendors enable row level security;

revoke all on table public.vendors from anon, authenticated;
grant select, insert, update, delete on table public.vendors to authenticated;
grant select, insert, update, delete on table public.vendors to service_role;

create policy "Read vendors with inventory.view"
on public.vendors for select to authenticated
using ( (select private.has_permission('inventory.view')) );

create policy "Create vendors with inventory.manage"
on public.vendors for insert to authenticated
with check ( (select private.has_permission('inventory.manage')) );

create policy "Update vendors with inventory.manage"
on public.vendors for update to authenticated
using ( (select private.has_permission('inventory.manage')) )
with check ( (select private.has_permission('inventory.manage')) );

create policy "Delete vendors with inventory.manage"
on public.vendors for delete to authenticated
using ( (select private.has_permission('inventory.manage')) );
