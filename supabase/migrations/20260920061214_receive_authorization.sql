SET local check_function_bodies = off;

REVOKE ALL ON TABLE "public"."purchase_order_items" FROM "anon";

REVOKE ALL ON TABLE "public"."purchase_orders" FROM "anon";

REVOKE ALL ON TABLE "public"."suppliers" FROM "anon";

CREATE OR REPLACE FUNCTION public.receive_purchase_order (
  p_purchase_order_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;
