-- Rename the suppliers domain to vendors.
--
-- Hand-written rather than generated: the declarative diff cannot tell a rename
-- from a drop-and-recreate, and emitted DROP TABLE "suppliers" + CREATE TABLE
-- "vendors". That is harmless only because the table happened to be empty; it
-- would discard every vendor in any environment that had one.

-- RENAME TO takes an unqualified name, unlike the rest of the statement.
alter table public.suppliers rename to vendors;
alter table public.purchase_orders rename column supplier_id to vendor_id;

alter index public.suppliers_pkey rename to vendors_pkey;
alter index public.suppliers_name_key rename to vendors_name_key;
alter index public.purchase_orders_supplier_id_idx rename to purchase_orders_vendor_id_idx;

alter table public.purchase_orders
  rename constraint purchase_orders_supplier_id_fkey to purchase_orders_vendor_id_fkey;

alter trigger touch_suppliers_updated_at on public.vendors rename to touch_vendors_updated_at;

-- Postgres has no ALTER POLICY ... RENAME, so the policies are recreated.
drop policy "Read suppliers with inventory.view" on public.vendors;
drop policy "Create suppliers with inventory.manage" on public.vendors;
drop policy "Update suppliers with inventory.manage" on public.vendors;
drop policy "Delete suppliers with inventory.manage" on public.vendors;

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

-- The rename would otherwise carry over the default table privileges that
-- auto_expose_new_tables leaves on new tables.
revoke all on table public.vendors from anon;
