-- Vendor payments and the vendor_balances view: what the shop still owes.
--   run: supabase test db
begin;
select plan(6);

-- Seed ---------------------------------------------------------------------
delete from public.vendor_payments;
delete from public.stock_movements;
delete from public.purchase_order_items;
delete from public.purchase_orders;
delete from public.vendors;
delete from public.products;
delete from public.categories;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@pay.test'),
  ('22222222-2222-2222-2222-222222222222', 'cashier@pay.test');

update public.profiles set role = 'admin'
 where id = '11111111-1111-1111-1111-111111111111';

insert into public.categories (id, name)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'TestCat');

insert into public.products (id, category_id, name, sku, cost_price, stock_qty)
values ('bbbbbbbb-0000-4000-8000-000000000001',
        'aaaaaaaa-0000-4000-8000-000000000001',
        'Test Sofa', 'PAY-1', 100, 0);

insert into public.vendors (id, name, phone)
values ('55000000-0000-4000-8000-000000000001', 'Test Mill', '0300-1234567');

-- admin receives a purchase, then pays part of it --------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"admin","role":"authenticated","aud":"authenticated"}';

select public.create_purchase_order(
  '55000000-0000-4000-8000-000000000001',
  'BILL-1',
  '',
  '[{"product_id":"bbbbbbbb-0000-4000-8000-000000000001","qty":3,"unit_cost":250}]'::jsonb
);

select public.receive_purchase_order(
  (select id from public.purchase_orders where reference = 'BILL-1')
);

select results_eq(
  $$select purchased_total from public.vendor_balances
     where vendor_id = '55000000-0000-4000-8000-000000000001'$$,
  array[750.00::numeric],
  'a received purchase becomes money owed to the vendor'
);

select results_eq(
  $$select outstanding from public.vendor_balances
     where vendor_id = '55000000-0000-4000-8000-000000000001'$$,
  array[750.00::numeric],
  'with nothing paid, outstanding equals purchased'
);

insert into public.vendor_payments (vendor_id, amount, method, created_by)
values ('55000000-0000-4000-8000-000000000001', 500, 'bank', (select auth.uid()));

select results_eq(
  $$select paid_total from public.vendor_balances
     where vendor_id = '55000000-0000-4000-8000-000000000001'$$,
  array[500.00::numeric],
  'a payment is counted against the vendor'
);

select results_eq(
  $$select outstanding from public.vendor_balances
     where vendor_id = '55000000-0000-4000-8000-000000000001'$$,
  array[250.00::numeric],
  'outstanding is purchases received less payments made'
);

-- cashier with inventory.view only -----------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"cashier","role":"authenticated","aud":"authenticated"}';

select throws_ok(
  $$insert into public.vendor_payments (vendor_id, amount)
    values ('55000000-0000-4000-8000-000000000001', 10)$$,
  '42501', null,
  'a cashier without inventory.manage cannot record a payment'
);

-- The view is security_invoker, so it obeys the caller's RLS on the tables
-- underneath rather than the view owner's privileges.
select results_eq(
  $$select outstanding from public.vendor_balances
     where vendor_id = '55000000-0000-4000-8000-000000000001'$$,
  array[250.00::numeric],
  'a cashier with inventory.view can read balances through the view'
);

select * from finish();
rollback;
