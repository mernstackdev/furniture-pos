-- Sales domain: the create_sale RPC, its stock side effects, invoice numbering,
-- walk-in handling and the customer_summary view.
--   run: supabase test db
begin;
select plan(15);

-- Seed ---------------------------------------------------------------------
-- Children first, so a leftover row from real data cannot block the cleanup.
delete from public.sale_items;
delete from public.sales;
delete from public.customers;
delete from public.vendor_payments;
delete from public.stock_movements;
delete from public.purchase_order_items;
delete from public.purchase_orders;
delete from public.vendors;
delete from public.products;
delete from public.categories;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@sales.test'),
  ('22222222-2222-2222-2222-222222222222', 'cashier@sales.test');

update public.profiles set role = 'admin'
 where id = '11111111-1111-1111-1111-111111111111';
-- The cashier role holds sales.manage, which is what the till needs.

insert into public.categories (id, name)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'TestCat');

insert into public.products (id, category_id, name, sku, sell_price, cost_price, stock_qty)
values ('bbbbbbbb-0000-4000-8000-000000000001',
        'aaaaaaaa-0000-4000-8000-000000000001',
        'Test Sofa', 'SALE-1', 500, 300, 10);

insert into public.customers (id, name, phone)
values ('cc000000-0000-4000-8000-000000000001', 'Test Buyer', '0300-1234567');

-- anon ---------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '';

select throws_ok(
  $$select * from public.customers$$,
  '42501', null,
  'anon cannot read customers'
);

select throws_ok(
  $$select * from public.sales$$,
  '42501', null,
  'anon cannot read sales'
);

-- cashier with sales.manage ------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"cashier","role":"authenticated","aud":"authenticated"}';

-- 2 x 500, with a 100 discount. The price comes from the catalogue, not the
-- caller, so no unit price is passed at all.
select public.create_sale(
  'cc000000-0000-4000-8000-000000000001',
  '[{"product_id":"bbbbbbbb-0000-4000-8000-000000000001","qty":2}]'::jsonb,
  100,
  'cash',
  'paid'
);

select results_eq(
  $$select count(*)::int from public.sales$$,
  array[1],
  'a cashier with sales.manage can record a sale'
);

select results_eq(
  $$select stock_qty from public.products where id = 'bbbbbbbb-0000-4000-8000-000000000001'$$,
  array[8],
  'the sold quantity is deducted from stock'
);

select results_eq(
  $$select count(*)::int from public.stock_movements
     where movement_type = 'out' and qty_change = -2$$,
  array[1],
  'an out movement is written for the sale'
);

select results_eq(
  $$select total from public.sales$$,
  array[900.00::numeric],
  'the total is priced from the catalogue (2 x 500 less 100)'
);

select throws_ok(
  $$select public.create_sale(
      'cc000000-0000-4000-8000-000000000001',
      '[{"product_id":"bbbbbbbb-0000-4000-8000-000000000001","qty":99}]'::jsonb,
      0, 'cash', 'paid')$$,
  'P0001', null,
  'selling more than stock is refused rather than clamped'
);

-- A second sale, a walk-in, with a different payment method.
select public.create_sale(
  null,
  '[{"product_id":"bbbbbbbb-0000-4000-8000-000000000001","qty":1}]'::jsonb,
  0,
  'card',
  'paid'
);

select results_eq(
  $$select (max(translate(invoice_no, 'INV-', ''))::int
          - min(translate(invoice_no, 'INV-', ''))::int)
     from public.sales$$,
  array[1],
  'invoice numbers are consecutive'
);

select results_eq(
  $$select count(*)::int from public.sales where customer_id is null$$,
  array[1],
  'a walk-in sale is stored with a null customer'
);

-- customer_summary ---------------------------------------------------------
select results_eq(
  $$select total_spent from public.customer_summary
     where id = 'cc000000-0000-4000-8000-000000000001'$$,
  array[900.00::numeric],
  'the walk-in sale does not count toward a customer total'
);

select results_eq(
  $$select last_payment_method::text from public.customer_summary
     where id = 'cc000000-0000-4000-8000-000000000001'$$,
  array['cash'],
  'the last payment method is the customer''s most recent sale'
);

-- customers ----------------------------------------------------------------
select lives_ok(
  $$insert into public.customers (id, name, phone, address)
    values ('cc000000-0000-4000-8000-000000000002', 'Till Customer', '0300-9999999', 'Lahore')$$,
  'a cashier with customers.manage can add a customer from the till'
);

select results_eq(
  $$select order_count::int from public.customer_summary
     where id = 'cc000000-0000-4000-8000-000000000002'$$,
  array[0],
  'a customer with no sales still appears in the summary with zero orders'
);

set local role anon;
set local request.jwt.claims = '';

select throws_ok(
  $$insert into public.customers (name, phone) values ('Anon', '0300-0000000')$$,
  '42501', null,
  'anon cannot add a customer'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"cashier","role":"authenticated","aud":"authenticated"}';

-- permission gate ----------------------------------------------------------
reset role;
delete from public.role_permissions
 where role = 'cashier' and permission_key = 'sales.manage';

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"cashier","role":"authenticated","aud":"authenticated"}';

select throws_ok(
  $$select public.create_sale(
      null,
      '[{"product_id":"bbbbbbbb-0000-4000-8000-000000000001","qty":1}]'::jsonb,
      0, 'cash', 'paid')$$,
  '42501', null,
  'without sales.manage the till is refused'
);

select * from finish();
rollback;
