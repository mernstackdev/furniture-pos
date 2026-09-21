-- Inventory and purchasing RPCs. All SECURITY INVOKER, so RLS decides who may
-- call them: writing inventory needs inventory.manage, reading needs
-- inventory.view.

create function public.get_or_create_category(p_name text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
  v_id   uuid;
begin
  if v_name = '' then
    raise exception 'category name is required';
  end if;

  select id into v_id from public.categories where lower (name) = lower (v_name);
  if v_id is not null then
    return v_id;
  end if;

  insert into public.categories (name) values (v_name) returning id into v_id;
  return v_id;
exception
  when unique_violation then
    -- Lost a race with a concurrent create; return the winner.
    select id into v_id from public.categories where lower (name) = lower (v_name);
    return v_id;
end;
$$;

comment on function public.get_or_create_category(text) is 'Case-insensitive category lookup, creating it when absent.';

-- Writes the ledger row and the new stock level together. Clamps at 0 to match
-- the behaviour the UI already had, rather than raising a check-constraint
-- error on an over-large stock-out.
create function public.adjust_stock(
  p_product_id uuid,
  p_type       public.stock_movement_type,
  p_qty        integer,
  p_reason     text
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_delta integer;
  v_new   integer;
begin
  v_delta := case
    when p_type = 'in'  then abs(p_qty)
    when p_type = 'out' then -abs(p_qty)
    else p_qty
  end;

  insert into public.stock_movements (product_id, movement_type, qty_change, reason, created_by)
  values (
    p_product_id,
    p_type,
    v_delta,
    coalesce(nullif(btrim(p_reason), ''), 'No reason given'),
    (select auth.uid())
  );

  update public.products
     set stock_qty = greatest(0, stock_qty + v_delta)
   where id = p_product_id
  returning stock_qty into v_new;

  return v_new;
end;
$$;

comment on function public.adjust_stock(uuid, public.stock_movement_type, integer, text) is 'Records a stock movement and returns the resulting stock level.';

-- Order + lines in one transaction, so a half-created purchase is impossible.
create function public.create_purchase_order(
  p_vendor_id uuid,
  p_reference   text,
  p_notes       text,
  p_items       jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id   uuid;
  v_item jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'a purchase order needs at least one item';
  end if;

  insert into public.purchase_orders (vendor_id, reference, notes, status, ordered_at, created_by)
  values (
    p_vendor_id,
    coalesce(btrim(p_reference), ''),
    coalesce(btrim(p_notes), ''),
    'ordered',
    now(),
    (select auth.uid())
  )
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    -- Without this, a caller sending camelCase keys (productId) gets a bare
    -- not-null violation on product_id, which reads like a database bug rather
    -- than a mismatch in the payload.
    if (v_item ->> 'product_id') is null then
      raise exception 'each purchase line needs a product_id key';
    end if;

    insert into public.purchase_order_items (purchase_order_id, product_id, qty_ordered, unit_cost)
    values (
      v_id,
      (v_item ->> 'product_id')::uuid,
      (v_item ->> 'qty')::integer,
      coalesce((v_item ->> 'unit_cost')::numeric, 0)
    );
  end loop;

  return v_id;
end;
$$;

comment on function public.create_purchase_order(uuid, text, text, jsonb) is 'Creates a purchase order and its lines atomically.';

-- Receiving is what actually puts stock on the shelf: it writes an `in`
-- movement per pending line, increases stock, and refreshes the product's cost
-- price to the latest purchase cost.
create function public.receive_purchase_order(p_purchase_order_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_order   record;
  v_item    record;
  v_pending integer;
begin
  -- Checked explicitly because the row lock below needs an UPDATE policy: under
  -- RLS a user without inventory.manage would otherwise see "purchase order not
  -- found" instead of a permission error, which reads like a bug.
  if not (select private.has_permission('inventory.manage')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select id, status into v_order
  from public.purchase_orders
  where id = p_purchase_order_id
  for update;

  if v_order.id is null then
    raise exception 'purchase order not found';
  end if;

  if v_order.status = 'received' then
    raise exception 'this purchase order has already been received';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'this purchase order was cancelled';
  end if;

  for v_item in
    select id, product_id, qty_ordered, qty_received, unit_cost
    from public.purchase_order_items
    where purchase_order_id = p_purchase_order_id
      and qty_received < qty_ordered
  loop
    v_pending := v_item.qty_ordered - v_item.qty_received;

    insert into public.stock_movements
      (product_id, movement_type, qty_change, reason, purchase_order_id, created_by)
    values
      (v_item.product_id, 'in', v_pending, 'Purchase received', p_purchase_order_id, (select auth.uid()));

    update public.products
       set stock_qty  = stock_qty + v_pending,
           cost_price = v_item.unit_cost
     where id = v_item.product_id;

    update public.purchase_order_items
       set qty_received = v_item.qty_ordered
     where id = v_item.id;
  end loop;

  update public.purchase_orders
     set status = 'received', received_at = now()
   where id = p_purchase_order_id;
end;
$$;

comment on function public.receive_purchase_order(uuid) is 'Receives a purchase order: writes stock in and updates product cost.';

revoke execute on function public.get_or_create_category(text) from public, anon;
revoke execute on function public.adjust_stock(uuid, public.stock_movement_type, integer, text) from public, anon;
revoke execute on function public.create_purchase_order(uuid, text, text, jsonb) from public, anon;
revoke execute on function public.receive_purchase_order(uuid) from public, anon;

grant execute on function public.get_or_create_category(text) to authenticated;
grant execute on function public.adjust_stock(uuid, public.stock_movement_type, integer, text) to authenticated;
grant execute on function public.create_purchase_order(uuid, text, text, jsonb) to authenticated;
grant execute on function public.receive_purchase_order(uuid) to authenticated;
