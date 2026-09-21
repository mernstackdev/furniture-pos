REVOKE ALL ON TABLE "public"."categories" FROM "anon";

REVOKE ALL ON TABLE "public"."permissions" FROM "anon";

REVOKE ALL ON TABLE "public"."products" FROM "anon";

REVOKE ALL ON TABLE "public"."role_permissions" FROM "anon";

REVOKE ALL ON TABLE "public"."stock_movements" FROM "anon";

CREATE TYPE "public"."stock_status" AS ENUM (
  'out',
  'low',
  'ok'
);

ALTER TABLE "public"."products"
  ADD COLUMN "stock_status" public.stock_status GENERATED ALWAYS AS (
CASE
    WHEN (stock_qty = 0) THEN 'out'::public.stock_status
    WHEN (stock_qty <= low_stock_threshold) THEN 'low'::public.stock_status
    ELSE 'ok'::public.stock_status
END) STORED;

GRANT USAGE ON TYPE "public"."stock_status" TO "postgres";
