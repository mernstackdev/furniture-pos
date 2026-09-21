-- RLS tests for the inventory domain: categories, products, stock movements and
-- the permission gate.
--   run: supabase test db
--
-- The point of these is the middle section: a cashier holding only
-- inventory.view must be unable to write, and must become able to write after
-- inventory.manage is granted. Hiding buttons in the UI proves nothing.
begin;
select plan(14);

-- Seed ---------------------------------------------------------------------
-- Rolled back at the end, so clearing the catalogue is safe and keeps these
-- assertions independent of the sample data.
-- Children first. purchase_order_items restricts product deletion and
-- vendor_payments restricts vendor deletion, so deleting products alone fails
-- as soon as any real purchase order exists.
delete from public.vendor_payments;
delete from public.stock_movements;
delete from public.purchase_order_items;
delete from public.purchase_orders;
delete from public.vendors;
delete from public.products;
delete from public.categories;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@inv.test'),
  ('22222222-2222-2222-2222-222222222222', 'cashier@inv.test');

update public.profiles set role = 'admin'
 where id = '11111111-1111-1111-1111-111111111111';
-- cashier keeps the default role, and the seeded cashier role has inventory.view only.

insert into public.categories (id, name)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'TestCat');

insert into public.products (id, category_id, name, sku, stock_qty)
values ('bbbbbbbb-0000-4000-8000-000000000001',
        'aaaaaaaa-0000-4000-8000-000000000001',
        'Test Product', 'TEST-1', 5);

-- anon ---------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '';

select throws_ok(
  $$select * from public.products$$,
  '42501', null,
  'anon cannot read products (no grant)'
);

select throws_ok(
  $$select * from public.categories$$,
  '42501', null,
  'anon cannot read categories (no grant)'
);

-- cashier with inventory.view only -----------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"cashier","role":"authenticated","aud":"authenticated"}';

select results_eq(
  $$select count(*)::int from public.products$$,
  array[1],
  'cashier with inventory.view can read products'
);

select throws_ok(
  $$insert into public.products (category_id, name, sku)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'Sneaky', 'TEST-2')$$,
  '42501', null,
  'cashier without inventory.manage cannot create a product'
);

select is_empty(
  $$update public.products set name = 'Hacked'
     where id = 'bbbbbbbb-0000-4000-8000-000000000001' returning id$$,
  'cashier update matches no rows'
);

select is_empty(
  $$delete from public.products
     where id = 'bbbbbbbb-0000-4000-8000-000000000001' returning id$$,
  'cashier delete matches no rows'
);

select results_eq(
  $$select name from public.products where id = 'bbbbbbbb-0000-4000-8000-000000000001'$$,
  array['Test Product'],
  'the denied writes left the product intact'
);

select throws_ok(
  $$insert into public.role_permissions (role, permission_key)
    values ('cashier', 'staff.manage')$$,
  '42501', null,
  'cashier cannot grant permissions (no staff.manage)'
);

-- grant inventory.manage, then the same writes must succeed ---------------
reset role;
set local request.jwt.claims = '';

insert into public.role_permissions (role, permission_key)
values ('cashier', 'inventory.manage');

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"cashier","role":"authenticated","aud":"authenticated"}';

select results_eq(
  $$insert into public.products (category_id, name, sku, stock_qty)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'Cashier Product', 'TEST-2', 2)
    returning sku$$,
  array['TEST-2'],
  'cashier WITH inventory.manage can create a product'
);

select results_eq(
  $$update public.products set name = 'Updated'
     where id = 'bbbbbbbb-0000-4000-8000-000000000001' returning name$$,
  array['Updated'],
  'cashier WITH inventory.manage can update a product'
);

select results_eq(
  $$delete from public.products where sku = 'TEST-2' returning sku$$,
  array['TEST-2'],
  'cashier WITH inventory.manage can delete a product'
);

-- the ledger is append-only ------------------------------------------------
select throws_ok(
  $$update public.stock_movements set reason = 'tampered'$$,
  '42501', null,
  'stock movements cannot be updated'
);

-- admin --------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"admin","role":"authenticated","aud":"authenticated"}';

select results_eq(
  $$insert into public.role_permissions (role, permission_key)
    values ('cashier', 'staff.manage') returning permission_key$$,
  array['staff.manage'],
  'admin holds staff.manage and can grant permissions'
);

select results_eq(
  $$select public.get_or_create_category('Sofas') = public.get_or_create_category('sofas')$$,
  array[true],
  'get_or_create_category is case-insensitive and idempotent'
);

select * from finish();
rollback;
