-- Seed data, applied by `supabase db reset`.
--
-- Staff accounts are NOT seeded: they live in auth.users, which is owned by the
-- Auth service. The first admin comes from the app's /setup screen.
--
-- The permission catalogue is NOT here either — it is required data and lives in
-- supabase/migrations/*_permission_catalogue.sql so that it also reaches a
-- deployed project, where seed files do not run.
--
-- EVERY block below is guarded on the table being empty. `on conflict do
-- nothing` is not enough on its own: it happily re-inserts rows that were
-- deleted after the first run, which resurrects a catalogue someone curated.

do $seed$
begin
  if not exists (select 1 from public.categories) then
    insert into public.categories (id, name) values
      ('20000000-0000-4000-8000-000000000001', 'Sofas'),
      ('20000000-0000-4000-8000-000000000002', 'Beds'),
      ('20000000-0000-4000-8000-000000000003', 'Dining'),
      ('20000000-0000-4000-8000-000000000004', 'Wardrobes'),
      ('20000000-0000-4000-8000-000000000005', 'Chairs'),
      ('20000000-0000-4000-8000-000000000006', 'Tables'),
      ('20000000-0000-4000-8000-000000000007', 'Decor');
  end if;

  if not exists (select 1 from public.products) then
    insert into public.products
      (id, category_id, name, sku, unit, cost_price, sell_price, stock_qty, low_stock_threshold)
    values
      ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Chesterfield 3-Seater Sofa',   'SF-CH3-BRN', 'pc',  65000,  95000,  6, 3),
      ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'L-Shaped Corner Sofa',         'SF-LSC-GRY', 'pc',  90000, 135000,  2, 2),
      ('10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'King Size Bed with Storage',   'BD-KNG-WLN', 'pc',  55000,  82000,  4, 2),
      ('10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 'Queen Size Bed',               'BD-QNS-OAK', 'pc',  40000,  60000,  5, 3),
      ('10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000003', '6-Seater Dining Table Set',    'DN-6ST-TEK', 'set', 70000, 105000,  3, 2),
      ('10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000003', '4-Seater Dining Table Set',    'DN-4ST-WAL', 'set', 45000,  68000,  0, 2),
      ('10000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000004', '3-Door Wardrobe',              'WD-3DR-WHT', 'pc',  38000,  56000,  7, 3),
      ('10000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000004', 'Sliding Door Wardrobe',        'WD-SLD-GRY', 'pc',  52000,  78000,  1, 2),
      ('10000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000005', 'Wooden Armchair',              'CH-ARM-TEK', 'pc',  12000,  18500, 14, 5),
      ('10000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000005', 'Office Chair - Ergonomic',     'CH-OFF-BLK', 'pc',   9000,  14500, 10, 4),
      ('10000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000006', 'Coffee Table - Round Glass',   'TB-CFE-GLS', 'pc',  15000,  23000,  8, 3),
      ('10000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000006', 'Study Table with Drawers',     'TB-STD-OAK', 'pc',  18000,  27000,  6, 3),
      ('10000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000006', 'TV Console - 5ft',             'TB-TVC-WLN', 'pc',  22000,  33000,  5, 2),
      ('10000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000007', 'Wall Mirror - Wooden Frame',   'DC-MIR-WLN', 'pc',   6000,   9500, 12, 4),
      ('10000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000007', 'Table Lamp - Ceramic Base',    'DC-LMP-CRM', 'pc',   3200,   5500,  3, 3);
  end if;

  if not exists (select 1 from public.sales) then
    insert into public.customers (id, name, phone, address) values
      ('c0000000-0000-4000-8000-000000000001', 'Ahmed Raza',      '0300-1234567', 'House 12, Street 4, DHA Phase 5, Lahore'),
      ('c0000000-0000-4000-8000-000000000002', 'Sana Malik',      '0321-9876543', 'Flat 3B, Clifton Block 2, Karachi'),
      ('c0000000-0000-4000-8000-000000000003', 'Bilal Hussain',   '0333-4567890', 'House 45, G-11/2, Islamabad'),
      ('c0000000-0000-4000-8000-000000000004', 'Ayesha Siddiqui', '0345-2223344', 'House 7, Model Town, Lahore'),
      ('c0000000-0000-4000-8000-000000000005', 'Usman Tariq',     '0311-8889977', 'Street 9, Gulshan-e-Iqbal, Karachi');

    insert into public.sales
      (id, invoice_no, customer_id, subtotal, discount, total, payment_method, status, sold_at)
    values
      ('a0000000-0000-4000-8000-000000000001', 'INV-1001', 'c0000000-0000-4000-8000-000000000001', 118000, 3000, 115000, 'cash', 'paid',   now() - interval '6 days'),
      ('a0000000-0000-4000-8000-000000000002', 'INV-1002', 'c0000000-0000-4000-8000-000000000002',  37000,    0,  37000, 'card', 'paid',   now() - interval '4 days'),
      ('a0000000-0000-4000-8000-000000000003', 'INV-1003', 'c0000000-0000-4000-8000-000000000003',  60000, 2000,  58000, 'bank', 'unpaid', now() - interval '2 days'),
      ('a0000000-0000-4000-8000-000000000004', 'INV-1004', null,                                     24000,    0,  24000, 'cash', 'paid',   now());

    -- product_id resolves by SKU, so this cannot fail on a catalogue that has
    -- drifted; the name/price snapshot keeps the invoice readable either way.
    insert into public.sale_items (sale_id, product_id, name, qty, unit_price, line_total) values
      ('a0000000-0000-4000-8000-000000000001', (select id from public.products where sku = 'SF-CH3-BRN'), 'Chesterfield 3-Seater Sofa', 1, 95000, 95000),
      ('a0000000-0000-4000-8000-000000000001', (select id from public.products where sku = 'TB-CFE-GLS'), 'Coffee Table - Round Glass', 1, 23000, 23000),
      ('a0000000-0000-4000-8000-000000000002', (select id from public.products where sku = 'CH-ARM-TEK'), 'Wooden Armchair',            2, 18500, 37000),
      ('a0000000-0000-4000-8000-000000000003', (select id from public.products where sku = 'BD-QNS-OAK'), 'Queen Size Bed',             1, 60000, 60000),
      ('a0000000-0000-4000-8000-000000000004', (select id from public.products where sku = 'CH-OFF-BLK'), 'Office Chair - Ergonomic',   1, 14500, 14500),
      ('a0000000-0000-4000-8000-000000000004', (select id from public.products where sku = 'DC-MIR-WLN'), 'Wall Mirror - Wooden Frame', 1,  9500,  9500);

    perform setval('public.invoice_number_seq', 1004, true);
  end if;
end;
$seed$;
