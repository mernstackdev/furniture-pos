SET local check_function_bodies = off;

DROP FUNCTION "public"."create_purchase_order"(uuid, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.create_purchase_order (
  p_vendor_id uuid,
  p_reference text,
  p_notes     text,
  p_items     jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

COMMENT ON FUNCTION "public"."create_purchase_order"(uuid, text, text, jsonb) IS 'Creates a purchase order and its lines atomically.';

COMMENT ON TABLE "public"."purchase_orders" IS 'Stock purchases from a vendor. Receiving one increases stock and writes movements.';

REVOKE ALL ON FUNCTION "public"."create_purchase_order"(uuid, text, text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."create_purchase_order"(uuid, text, text, jsonb) TO "authenticated", "postgres";
