-- The checkout RPC.
--
-- SECURITY DEFINER, the only one in this schema, and it earns it: deducting
-- stock writes to public.products, which is gated on inventory.manage, while a
-- cashier holds only sales.manage. The alternatives are worse — granting
-- cashiers inventory.manage defeats the permission model, and an RLS policy
-- cannot express "may update stock_qty and nothing else".
--
-- Because it runs as its owner it bypasses RLS, so the permission check below
-- is the gate, not a policy. EXECUTE is revoked from PUBLIC and anon.
create function public.create_sale(
  p_customer_id    uuid,
  p_items          jsonb,   -- [{ "product_id": uuid, "qty": int }]
  p_discount       numeric,
  p_payment_method public.payment_method,
  p_status         public.sale_status
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale_id    uuid;
  v_invoice_no text;
  v_line       record;
  v_product    record;
  v_subtotal   numeric(12, 2) := 0;
  v_discount   numeric(12, 2);
begin
  if not (select private.has_permission('sales.manage')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'a sale needs at least one item';
  end if;

  -- Lines are aggregated by product first: a payload listing the same product
  -- twice must be checked against the total, not each line separately.
  -- Prices come from the catalogue, never from the caller.
  for v_line in
    select item ->> 'product_id' as product_id,
           sum((item ->> 'qty')::integer) as qty
    from jsonb_array_elements(p_items) as item
    group by item ->> 'product_id'
  loop
    if v_line.product_id is null then
      raise exception 'each sale line needs a product_id key';
    end if;

    if v_line.qty <= 0 then
      raise exception 'each sale line needs a positive qty';
    end if;

    select id, name, sell_price, stock_qty into v_product
    from public.products
    where id = v_line.product_id::uuid
    for update;

    if v_product.id is null then
      raise exception 'product % not found', v_line.product_id;
    end if;

    -- Refuse rather than clamp: silently selling stock you do not have loses
    -- money and hides the problem.
    if v_line.qty > v_product.stock_qty then
      raise exception 'only % left of %, % requested',
        v_product.stock_qty, v_product.name, v_line.qty;
    end if;

    v_subtotal := v_subtotal + (v_line.qty * v_product.sell_price);
  end loop;

  v_discount := least(greatest(coalesce(p_discount, 0), 0), v_subtotal);

  insert into public.sales
    (invoice_no, customer_id, subtotal, discount, total, payment_method, status, created_by)
  values
    ('INV-' || nextval('public.invoice_number_seq'),
     p_customer_id, v_subtotal, v_discount, v_subtotal - v_discount,
     p_payment_method, p_status, (select auth.uid()))
  returning id, invoice_no into v_sale_id, v_invoice_no;

  for v_line in
    select item ->> 'product_id' as product_id,
           sum((item ->> 'qty')::integer) as qty
    from jsonb_array_elements(p_items) as item
    group by item ->> 'product_id'
  loop
    select id, name, sell_price into v_product
    from public.products
    where id = v_line.product_id::uuid;

    insert into public.sale_items (sale_id, product_id, name, qty, unit_price, line_total)
    values (
      v_sale_id,
      v_product.id,
      v_product.name,
      v_line.qty,
      v_product.sell_price,
      v_line.qty * v_product.sell_price
    );

    update public.products
       set stock_qty = stock_qty - v_line.qty
     where id = v_product.id;

    insert into public.stock_movements (product_id, movement_type, qty_change, reason, created_by)
    values (v_product.id, 'out', -v_line.qty, 'Sale ' || v_invoice_no, (select auth.uid()));
  end loop;

  return v_sale_id;
end;
$$;

comment on function public.create_sale(uuid, jsonb, numeric, public.payment_method, public.sale_status) is 'Creates a sale, its items, and the stock movements atomically, and returns the sale id.';

revoke execute on function public.create_sale(uuid, jsonb, numeric, public.payment_method, public.sale_status) from public, anon;
grant execute on function public.create_sale(uuid, jsonb, numeric, public.payment_method, public.sale_status) to authenticated;
