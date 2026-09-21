DROP VIEW "public"."vendor_balances";

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
    v.phone,
    v.city,
    (COALESCE(pu.total, (0)::numeric))::numeric(14,2) AS purchased_total,
    (COALESCE(pd.total, (0)::numeric))::numeric(14,2) AS paid_total,
    ((COALESCE(pu.total, (0)::numeric) - COALESCE(pd.total, (0)::numeric)))::numeric(14,2) AS outstanding
   FROM ((public.vendors v
     LEFT JOIN purchased pu ON ((pu.vendor_id = v.id)))
     LEFT JOIN paid pd ON ((pd.vendor_id = v.id)));

COMMENT ON VIEW "public"."vendor_balances" IS 'Purchases received minus payments made, per vendor.';

REVOKE ALL ON TABLE "public"."vendor_balances" FROM "authenticated";

GRANT SELECT ON TABLE "public"."vendor_balances" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vendor_balances" TO "postgres";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."vendor_balances" TO "service_role";
