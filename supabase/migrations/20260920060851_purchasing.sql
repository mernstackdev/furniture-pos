SET local check_function_bodies = off;

CREATE TABLE "public"."purchase_order_items" (
  "id"                uuid          NOT NULL DEFAULT gen_random_uuid(),
  "purchase_order_id" uuid          NOT NULL,
  "product_id"        uuid          NOT NULL,
  "qty_ordered"       integer       NOT NULL,
  "qty_received"      integer       NOT NULL DEFAULT 0,
  "unit_cost"         numeric(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "purchase_order_items_qty_ordered_check" CHECK ((qty_ordered > 0)),
  CONSTRAINT "purchase_order_items_qty_received_check" CHECK ((qty_received >= 0)),
  CONSTRAINT "purchase_order_items_unique" UNIQUE (purchase_order_id, product_id),
  CONSTRAINT "purchase_order_items_unit_cost_check" CHECK ((unit_cost >= (0)::numeric))
);

ALTER TABLE "public"."purchase_order_items"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."purchase_orders" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "supplier_id" uuid                     NOT NULL,
  "reference"   text                     NOT NULL DEFAULT ''::text,
  "notes"       text                     NOT NULL DEFAULT ''::text,
  "ordered_at"  timestamp with time zone,
  "received_at" timestamp with time zone,
  "created_by"  uuid,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "purchase_orders_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."purchase_orders"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."suppliers" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"       text                     NOT NULL,
  "phone"      text                     NOT NULL,
  "city"       text                     NOT NULL DEFAULT ''::text,
  "address"    text                     NOT NULL DEFAULT ''::text,
  "notes"      text                     NOT NULL DEFAULT ''::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "suppliers_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."suppliers"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."products"
  ADD COLUMN "reorder_point" integer NOT NULL DEFAULT 0;

ALTER TABLE "public"."stock_movements"
  ADD COLUMN "purchase_order_id" uuid;

CREATE TYPE "public"."purchase_status" AS ENUM (
  'draft',
  'ordered',
  'received',
  'cancelled'
);

ALTER TABLE "public"."purchase_orders"
  ADD COLUMN "status" public.purchase_status NOT NULL DEFAULT 'draft'::public.purchase_status;

CREATE OR REPLACE FUNCTION public.create_purchase_order (
  p_supplier_id uuid,
  p_reference   text,
  p_notes       text,
  p_items       jsonb
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

  insert into public.purchase_orders (supplier_id, reference, notes, status, ordered_at, created_by)
  values (
    p_supplier_id,
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

ALTER TABLE "public"."products"
  ADD CONSTRAINT "products_reorder_point_check" CHECK ((reorder_point >= 0));

ALTER TABLE "public"."purchase_order_items"
  ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;

ALTER TABLE "public"."purchase_orders"
  ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."purchase_order_items"
  ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;

ALTER TABLE "public"."stock_movements"
  ADD CONSTRAINT "stock_movements_purchase_order_id_fkey" FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;

ALTER TABLE "public"."purchase_orders"
  ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;

CREATE INDEX purchase_order_items_order_idx ON public.purchase_order_items USING btree (purchase_order_id);

CREATE INDEX purchase_order_items_product_idx ON public.purchase_order_items USING btree (product_id);

CREATE INDEX purchase_orders_created_at_idx ON public.purchase_orders USING btree (created_at DESC);

CREATE INDEX purchase_orders_status_idx ON public.purchase_orders USING btree (status);

CREATE INDEX purchase_orders_supplier_id_idx ON public.purchase_orders USING btree (supplier_id);

CREATE INDEX stock_movements_purchase_order_idx ON public.stock_movements USING btree (purchase_order_id);

CREATE UNIQUE INDEX suppliers_name_key ON public.suppliers USING btree (lower(name));

CREATE TRIGGER touch_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER touch_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

CREATE POLICY "Create purchase items with inventory.manage" ON "public"."purchase_order_items"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT private.has_permission('inventory.manage'::text) AS has_permission));

CREATE POLICY "Delete purchase items with inventory.manage" ON "public"."purchase_order_items"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT private.has_permission('inventory.manage'::text) AS has_permission));

CREATE POLICY "Read purchase items with inventory.view" ON "public"."purchase_order_items"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT private.has_permission('inventory.view'::text) AS has_permission));

CREATE POLICY "Update purchase items with inventory.manage" ON "public"."purchase_order_items"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT private.has_permission('inventory.manage'::text) AS has_permission))
  WITH CHECK (( SELECT private.has_permission('inventory.manage'::text) AS has_permission));

CREATE POLICY "Create purchase orders with inventory.manage" ON "public"."purchase_orders"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT private.has_permission('inventory.manage'::text) AS has_permission));

CREATE POLICY "Delete purchase orders with inventory.manage" ON "public"."purchase_orders"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT private.has_permission('inventory.manage'::text) AS has_permission));

CREATE POLICY "Read purchase orders with inventory.view" ON "public"."purchase_orders"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT private.has_permission('inventory.view'::text) AS has_permission));

CREATE POLICY "Update purchase orders with inventory.manage" ON "public"."purchase_orders"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT private.has_permission('inventory.manage'::text) AS has_permission))
  WITH CHECK (( SELECT private.has_permission('inventory.manage'::text) AS has_permission));

CREATE POLICY "Create suppliers with inventory.manage" ON "public"."suppliers"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT private.has_permission('inventory.manage'::text) AS has_permission));

CREATE POLICY "Delete suppliers with inventory.manage" ON "public"."suppliers"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT private.has_permission('inventory.manage'::text) AS has_permission));

CREATE POLICY "Read suppliers with inventory.view" ON "public"."suppliers"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT private.has_permission('inventory.view'::text) AS has_permission));

CREATE POLICY "Update suppliers with inventory.manage" ON "public"."suppliers"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT private.has_permission('inventory.manage'::text) AS has_permission))
  WITH CHECK (( SELECT private.has_permission('inventory.manage'::text) AS has_permission));

COMMENT ON FUNCTION "public"."create_purchase_order"(uuid, text, text, jsonb) IS 'Creates a purchase order and its lines atomically.';

COMMENT ON FUNCTION "public"."receive_purchase_order"(uuid) IS 'Receives a purchase order: writes stock in and updates product cost.';

COMMENT ON TABLE "public"."purchase_orders" IS 'Stock purchases from a supplier. Receiving one increases stock and writes movements.';

COMMENT ON TABLE "public"."suppliers" IS 'Manufacturers and wholesalers the shop buys stock from.';

REVOKE ALL ON FUNCTION "public"."create_purchase_order"(uuid, text, text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."create_purchase_order"(uuid, text, text, jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."receive_purchase_order"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."receive_purchase_order"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON TABLE "public"."purchase_order_items" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."purchase_order_items" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."purchase_order_items" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."purchase_orders" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."purchase_orders" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."purchase_orders" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."suppliers" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."suppliers" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."suppliers" TO "postgres", "service_role";

GRANT USAGE ON TYPE "public"."purchase_status" TO "postgres";
