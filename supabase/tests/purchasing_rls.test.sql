-- Purchasing: receiving a purchase order is the only path that puts stock on
-- the shelf, so these assertions cover the stock/cost/movement side effects and
-- the permission gate.
--   run: supabase test db
begin;
select plan(8);

-- Seed ---------------------------------------------------------------------
-- Children first: vendor_payments restricts vendor deletion, and
-- purchase_order_items restricts product deletion.
delete from public.vendor_payments;
delete from public.stock_movements;
delete from public.purchase_order_items;
delete from public.purchase_orders;
delete from public.vendors;
delete from public.products;
delete from public.categories;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@buy.test'),
  ('22222222-2222-2222-2222-222222222222', 'cashier@buy.test');

update public.profiles set role = 'admin'
 where id = '11111111-1111-1111-1111-111111111111';
-- cashier keeps the default role, which holds inventory.view only.

insert into public.categories (id, name)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'TestCat');

insert into public.vendors (id, name, phone)
values ('55000000-0000-4000-8000-000000000001', 'Test Mill', '0300-1234567');

insert into public.products (id, category_id, name, sku, cost_price, stock_qty)
values ('bbbbbbbb-0000-4000-8000-000000000001',
        'aaaaaaaa-0000-4000-8000-000000000001',
        'Test Sofa', 'BUY-1', 100, 5);

-- admin --------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"admin","role":"authenticated","aud":"authenticated"}';

select public.create_purchase_order(
  '55000000-0000-4000-8000-000000000001',
  'BILL-1',
  '',
  '[{"product_id":"bbbbbbbb-0000-4000-8000-000000000001","qty":3,"unit_cost":250}]'::jsonb
);

select results_eq(
  $$select count(*)::int from public.purchase_order_items where qty_ordered = 3$$,
  array[1],
  'admin can raise a purchase order with a line'
);

-- A second order stays unreceived, to test the cashier path below.
select public.create_purchase_order(
  '55000000-0000-4000-8000-000000000001',
  'BILL-2',
  '',
  '[{"product_id":"bbbbbbbb-0000-4000-8000-000000000001","qty":1,"unit_cost":10}]'::jsonb
);

select public.receive_purchase_order(
  (select id from public.purchase_orders where reference = 'BILL-1')
);

select results_eq(
  $$select stock_qty from public.products where id = 'bbbbbbbb-0000-4000-8000-000000000001'$$,
  array[8],
  'receiving adds the ordered quantity to stock'
);

select results_eq(
  $$select cost_price from public.products where id = 'bbbbbbbb-0000-4000-8000-000000000001'$$,
  array[250.00::numeric],
  'receiving refreshes the product cost price to the purchase cost'
);

select results_eq(
  $$select count(*)::int from public.stock_movements where purchase_order_id is not null$$,
  array[1],
  'receiving writes a stock movement linked to the purchase'
);

select results_eq(
  $$select status::text from public.purchase_orders where reference = 'BILL-1'$$,
  array['received'],
  'the purchase order is marked received'
);

select throws_ok(
  $$select public.receive_purchase_order(
      (select id from public.purchase_orders where reference = 'BILL-1'))$$,
  'P0001', null,
  'receiving the same order twice is refused'
);

-- cashier with inventory.view only -----------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"cashier","role":"authenticated","aud":"authenticated"}';

select throws_ok(
  $$select public.create_purchase_order(
      '55000000-0000-4000-8000-000000000001', 'BILL-3', '',
      '[{"product_id":"bbbbbbbb-0000-4000-8000-000000000001","qty":1,"unit_cost":10}]'::jsonb)$$,
  '42501', null,
  'a cashier without inventory.manage cannot raise a purchase order'
);

select throws_ok(
  $$select public.receive_purchase_order(
      (select id from public.purchase_orders where reference = 'BILL-2'))$$,
  '42501', null,
  'a cashier cannot receive stock'
);

select * from finish();
rollback;
