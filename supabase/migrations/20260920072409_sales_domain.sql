SET local check_function_bodies = off;

REVOKE ALL ON TABLE "public"."vendor_balances" FROM "anon";

CREATE SEQUENCE "public"."invoice_number_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1001 CACHE 1 NO CYCLE;

CREATE TABLE "public"."customers" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"       text                     NOT NULL,
  "phone"      text                     NOT NULL,
  "address"    text                     NOT NULL DEFAULT ''::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "customers_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."customers"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."sale_items" (
  "id"         uuid          NOT NULL DEFAULT gen_random_uuid(),
  "sale_id"    uuid          NOT NULL,
  "product_id" uuid,
  "name"       text          NOT NULL,
  "qty"        integer       NOT NULL,
  "unit_price" numeric(12,2) NOT NULL,
  "line_total" numeric(12,2) NOT NULL,
  CONSTRAINT "sale_items_line_total_check" CHECK ((line_total >= (0)::numeric)),
  CONSTRAINT "sale_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "sale_items_qty_check" CHECK ((qty > 0)),
  CONSTRAINT "sale_items_unit_price_check" CHECK ((unit_price >= (0)::numeric))
);

ALTER TABLE "public"."sale_items"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."sales" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "invoice_no"  text                     NOT NULL,
  "customer_id" uuid,
  "subtotal"    numeric(12,2)            NOT NULL DEFAULT 0,
  "discount"    numeric(12,2)            NOT NULL DEFAULT 0,
  "total"       numeric(12,2)            NOT NULL DEFAULT 0,
  "sold_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "created_by"  uuid,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "sales_discount_check" CHECK ((discount >= (0)::numeric)),
  CONSTRAINT "sales_invoice_no_key" UNIQUE (invoice_no),
  CONSTRAINT "sales_pkey" PRIMARY KEY (id),
  CONSTRAINT "sales_subtotal_check" CHECK ((subtotal >= (0)::numeric)),
  CONSTRAINT "sales_total_check" CHECK ((total >= (0)::numeric))
);

ALTER TABLE "public"."sales"
  ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."payment_method" AS ENUM (
  'cash',
  'card',
  'bank'
);

ALTER TABLE "public"."sales"
  ADD COLUMN "payment_method" public.payment_method NOT NULL DEFAULT 'cash'::public.payment_method;

CREATE TYPE "public"."sale_status" AS ENUM (
  'paid',
  'unpaid'
);

ALTER TABLE "public"."sales"
  ADD COLUMN "status" public.sale_status NOT NULL DEFAULT 'paid'::public.sale_status;

CREATE OR REPLACE FUNCTION public.create_sale (
  p_customer_id    uuid,
  p_items          jsonb,
  p_discount       numeric,
  p_payment_method public.payment_method,
  p_status         public.sale_status
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

ALTER TABLE "public"."sale_items"
  ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE "public"."sales"
  ADD CONSTRAINT "sales_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."sales"
  ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE "public"."sale_items"
  ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;

CREATE VIEW "public"."customer_summary" WITH (security_invoker=true) AS  SELECT c.id,
    c.name,
    c.phone,
    c.address,
    c.created_at,
    count(s.id) AS order_count,
    (COALESCE(sum(s.total), (0)::numeric))::numeric(14,2) AS total_spent,
    (COALESCE(sum(
        CASE
            WHEN (s.status = 'unpaid'::public.sale_status) THEN s.total
            ELSE NULL::numeric
        END), (0)::numeric))::numeric(14,2) AS outstanding,
    max(s.sold_at) AS last_order_at,
    (array_agg(s.payment_method ORDER BY s.sold_at DESC))[1] AS last_payment_method
   FROM (public.customers c
     LEFT JOIN public.sales s ON ((s.customer_id = c.id)))
  GROUP BY c.id;

CREATE INDEX customers_name_idx ON public.customers USING btree (lower(name));

CREATE INDEX sale_items_product_id_idx ON public.sale_items USING btree (product_id);

CREATE INDEX sale_items_sale_id_idx ON public.sale_items USING btree (sale_id);

CREATE INDEX sales_customer_id_idx ON public.sales USING btree (customer_id);

CREATE INDEX sales_sold_at_idx ON public.sales USING btree (sold_at DESC);

CREATE TRIGGER touch_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

CREATE POLICY "Create customers with customers.manage" ON "public"."customers"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT private.has_permission('customers.manage'::text) AS has_permission));

CREATE POLICY "Delete customers with customers.manage" ON "public"."customers"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT private.has_permission('customers.manage'::text) AS has_permission));

CREATE POLICY "Read customers with sales.view" ON "public"."customers"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT private.has_permission('sales.view'::text) AS has_permission));

CREATE POLICY "Update customers with customers.manage" ON "public"."customers"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT private.has_permission('customers.manage'::text) AS has_permission))
  WITH CHECK (( SELECT private.has_permission('customers.manage'::text) AS has_permission));

CREATE POLICY "Create sale items with sales.manage" ON "public"."sale_items"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT private.has_permission('sales.manage'::text) AS has_permission));

CREATE POLICY "Read sale items with sales.view" ON "public"."sale_items"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT private.has_permission('sales.view'::text) AS has_permission));

CREATE POLICY "Create sales with sales.manage" ON "public"."sales"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT private.has_permission('sales.manage'::text) AS has_permission));

CREATE POLICY "Read sales with sales.view" ON "public"."sales"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT private.has_permission('sales.view'::text) AS has_permission));

CREATE POLICY "Update sales with sales.manage" ON "public"."sales"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT private.has_permission('sales.manage'::text) AS has_permission))
  WITH CHECK (( SELECT private.has_permission('sales.manage'::text) AS has_permission));

COMMENT ON FUNCTION "public"."create_sale"(uuid, jsonb, numeric, public.payment_method, public.sale_status) IS 'Creates a sale, its items, and the stock movements atomically, and returns the sale id.';

COMMENT ON TABLE "public"."customers" IS 'Shop customers. Sales with a null customer_id are walk-ins.';

COMMENT ON TABLE "public"."sale_items" IS 'Line items. name and unit_price are snapshots taken at sale time.';

COMMENT ON TABLE "public"."sales" IS 'Completed sales. customer_id is null for walk-ins.';

COMMENT ON VIEW "public"."customer_summary" IS 'Per-customer purchase totals and the last payment method used.';

REVOKE ALL ON FUNCTION "public"."create_sale"(uuid, jsonb, numeric, public.payment_method, public.sale_status) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."create_sale"(uuid, jsonb, numeric, public.payment_method, public.sale_status) TO "authenticated", "postgres";

GRANT UPDATE ON SEQUENCE "public"."invoice_number_seq" TO "anon", "authenticated";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."invoice_number_seq" TO "postgres";

GRANT UPDATE ON SEQUENCE "public"."invoice_number_seq" TO "service_role";

REVOKE ALL ON TABLE "public"."customers" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."customers" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."customers" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."sale_items" FROM "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."sale_items" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."sale_items" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."sales" FROM "authenticated";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."sales" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."sales" TO "postgres", "service_role";

GRANT USAGE ON TYPE "public"."payment_method" TO "postgres";

GRANT USAGE ON TYPE "public"."sale_status" TO "postgres";

REVOKE ALL ON TABLE "public"."customer_summary" FROM "authenticated";

GRANT SELECT ON TABLE "public"."customer_summary" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."customer_summary" TO "postgres";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."customer_summary" TO "service_role";
