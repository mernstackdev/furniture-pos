CREATE TABLE "public"."vendor_payments" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "vendor_id"         uuid                     NOT NULL,
  "purchase_order_id" uuid,
  "amount"            numeric(12,2)            NOT NULL,
  "reference"         text                     NOT NULL DEFAULT ''::text,
  "note"              text                     NOT NULL DEFAULT ''::text,
  "paid_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "created_by"        uuid,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "vendor_payments_amount_check" CHECK ((amount > (0)::numeric)),
  CONSTRAINT "vendor_payments_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."vendor_payments"
  ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."vendor_payment_method" AS ENUM (
  'cash',
  'bank',
  'cheque',
  'online'
);

ALTER TABLE "public"."vendor_payments"
  ADD COLUMN "method" public.vendor_payment_method NOT NULL DEFAULT 'cash'::public.vendor_payment_method;

ALTER TABLE "public"."vendor_payments"
  ADD CONSTRAINT "vendor_payments_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."vendor_payments"
  ADD CONSTRAINT "vendor_payments_purchase_order_id_fkey" FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;

ALTER TABLE "public"."vendor_payments"
  ADD CONSTRAINT "vendor_payments_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE RESTRICT;

CREATE VIEW "public"."vendor_balances" WITH (security_invoker=true) AS  WITH purchased AS (
         SELECT po.vendor_id,
            sum(((i.qty_received)::numeric * i.unit_cost)) AS total
           FROM (public.purchase_orders po
             JOIN public.purchase_order_items i ON ((i.purchase_order_id = po.id)))
          WHERE (po.status = 'received'::public.purchase_status)
          GROUP BY po.vendor_id
        ), paid AS (
         SELECT vendor_payments.vendor_id,
            sum(vendor_payments.amount) AS total
           FROM public.vendor_payments
          GROUP BY vendor_payments.vendor_id
        )
 SELECT v.id AS vendor_id,
    v.name AS vendor_name,
    (COALESCE(pu.total, (0)::numeric))::numeric(14,2) AS purchased_total,
    (COALESCE(pd.total, (0)::numeric))::numeric(14,2) AS paid_total,
    ((COALESCE(pu.total, (0)::numeric) - COALESCE(pd.total, (0)::numeric)))::numeric(14,2) AS outstanding
   FROM ((public.vendors v
     LEFT JOIN purchased pu ON ((pu.vendor_id = v.id)))
     LEFT JOIN paid pd ON ((pd.vendor_id = v.id)));

CREATE INDEX vendor_payments_paid_at_idx ON public.vendor_payments USING btree (paid_at DESC);

CREATE INDEX vendor_payments_purchase_order_idx ON public.vendor_payments USING btree (purchase_order_id);

CREATE INDEX vendor_payments_vendor_id_idx ON public.vendor_payments USING btree (vendor_id);

CREATE POLICY "Correct vendor payments with inventory.manage" ON "public"."vendor_payments"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT private.has_permission('inventory.manage'::text) AS has_permission))
  WITH CHECK (( SELECT private.has_permission('inventory.manage'::text) AS has_permission));

CREATE POLICY "Delete vendor payments with inventory.manage" ON "public"."vendor_payments"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT private.has_permission('inventory.manage'::text) AS has_permission));

CREATE POLICY "Read vendor payments with inventory.view" ON "public"."vendor_payments"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT private.has_permission('inventory.view'::text) AS has_permission));

CREATE POLICY "Record vendor payments with inventory.manage" ON "public"."vendor_payments"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT private.has_permission('inventory.manage'::text) AS has_permission));

COMMENT ON TABLE "public"."vendor_payments" IS 'Money paid to a vendor, optionally against a specific purchase order.';

COMMENT ON VIEW "public"."vendor_balances" IS 'Purchases received minus payments made, per vendor.';

REVOKE ALL ON TABLE "public"."vendor_payments" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."vendor_payments" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vendor_payments" TO "postgres", "service_role";

GRANT USAGE ON TYPE "public"."vendor_payment_method" TO "postgres";

REVOKE ALL ON TABLE "public"."vendor_balances" FROM "authenticated";

GRANT SELECT ON TABLE "public"."vendor_balances" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vendor_balances" TO "postgres";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."vendor_balances" TO "service_role";
