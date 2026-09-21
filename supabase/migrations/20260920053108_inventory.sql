SET local check_function_bodies = off;

REVOKE ALL ON TABLE "public"."profiles" FROM "anon";

CREATE TABLE "public"."categories" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"       text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "categories_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."categories"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."permissions" (
  "key"         text NOT NULL,
  "description" text NOT NULL DEFAULT ''::text,
  CONSTRAINT "permissions_pkey" PRIMARY KEY (key)
);

ALTER TABLE "public"."permissions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."products" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "category_id"         uuid                     NOT NULL,
  "name"                text                     NOT NULL,
  "sku"                 text                     NOT NULL,
  "unit"                text                     NOT NULL DEFAULT 'pc'::text,
  "cost_price"          numeric(12,2)            NOT NULL DEFAULT 0,
  "sell_price"          numeric(12,2)            NOT NULL DEFAULT 0,
  "stock_qty"           integer                  NOT NULL DEFAULT 0,
  "low_stock_threshold" integer                  NOT NULL DEFAULT 3,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "products_cost_price_check" CHECK ((cost_price >= (0)::numeric)),
  CONSTRAINT "products_low_stock_threshold_check" CHECK ((low_stock_threshold >= 0)),
  CONSTRAINT "products_pkey" PRIMARY KEY (id),
  CONSTRAINT "products_sell_price_check" CHECK ((sell_price >= (0)::numeric)),
  CONSTRAINT "products_sku_key" UNIQUE (sku),
  CONSTRAINT "products_stock_qty_check" CHECK ((stock_qty >= 0))
);

ALTER TABLE "public"."products"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."role_permissions" (
  "role"           public.app_role NOT NULL,
  "permission_key" text            NOT NULL,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY (ROLE, permission_key)
);

ALTER TABLE "public"."role_permissions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."stock_movements" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "product_id" uuid                     NOT NULL,
  "qty_change" integer                  NOT NULL,
  "reason"     text                     NOT NULL DEFAULT ''::text,
  "created_by" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "stock_movements_pkey" PRIMARY KEY (id),
  CONSTRAINT "stock_movements_qty_change_check" CHECK ((qty_change <> 0))
);

ALTER TABLE "public"."stock_movements"
  ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."stock_movement_type" AS ENUM (
  'in',
  'out',
  'adjustment'
);

ALTER TABLE "public"."stock_movements"
  ADD COLUMN "movement_type" public.stock_movement_type NOT NULL;

CREATE OR REPLACE FUNCTION private.has_permission (
  p_permission text
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.role_permissions rp
    where rp.permission_key = p_permission
      and rp.role = (select auth.jwt() ->> 'user_role')::public.app_role
  );
$function$;

CREATE OR REPLACE FUNCTION private.touch_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.adjust_stock (
  p_product_id uuid,
  p_type       public.stock_movement_type,
  p_qty        integer,
  p_reason     text
)
  RETURNS integer
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_or_create_category (
  p_name text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

ALTER TABLE "public"."products"
  ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;

ALTER TABLE "public"."role_permissions"
  ADD CONSTRAINT "role_permissions_permission_key_fkey" FOREIGN KEY (permission_key) REFERENCES public.permissions(key) ON DELETE CASCADE;

ALTER TABLE "public"."stock_movements"
  ADD CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."stock_movements"
  ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX categories_name_lower_key ON public.categories USING btree (lower(name));

CREATE INDEX products_category_id_idx ON public.products USING btree (category_id);

CREATE INDEX stock_movements_created_at_idx ON public.stock_movements USING btree (created_at DESC);

CREATE INDEX stock_movements_product_id_idx ON public.stock_movements USING btree (product_id);

CREATE TRIGGER touch_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

CREATE POLICY "Create categories with inventory.manage" ON "public"."categories"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT private.has_permission('inventory.manage'::text) AS has_permission));

CREATE POLICY "Delete categories with inventory.manage" ON "public"."categories"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT private.has_permission('inventory.manage'::text) AS has_permission));

CREATE POLICY "Read categories with inventory.view" ON "public"."categories"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT private.has_permission('inventory.view'::text) AS has_permission));

CREATE POLICY "Update categories with inventory.manage" ON "public"."categories"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT private.has_permission('inventory.manage'::text) AS has_permission))
  WITH CHECK (( SELECT private.has_permission('inventory.manage'::text) AS has_permission));

CREATE POLICY "Signed-in users can read permissions" ON "public"."permissions"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "Create products with inventory.manage" ON "public"."products"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT private.has_permission('inventory.manage'::text) AS has_permission));

CREATE POLICY "Delete products with inventory.manage" ON "public"."products"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT private.has_permission('inventory.manage'::text) AS has_permission));

CREATE POLICY "Read products with inventory.view" ON "public"."products"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT private.has_permission('inventory.view'::text) AS has_permission));

CREATE POLICY "Update products with inventory.manage" ON "public"."products"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT private.has_permission('inventory.manage'::text) AS has_permission))
  WITH CHECK (( SELECT private.has_permission('inventory.manage'::text) AS has_permission));

CREATE POLICY "Signed-in users can read role permissions" ON "public"."role_permissions"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "Staff managers can grant a permission" ON "public"."role_permissions"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT private.has_permission('staff.manage'::text) AS has_permission));

CREATE POLICY "Staff managers can revoke a permission" ON "public"."role_permissions"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT private.has_permission('staff.manage'::text) AS has_permission));

CREATE POLICY "Read movements with inventory.view" ON "public"."stock_movements"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT private.has_permission('inventory.view'::text) AS has_permission));

CREATE POLICY "Record movements with inventory.manage" ON "public"."stock_movements"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (( SELECT private.has_permission('inventory.manage'::text) AS has_permission));

COMMENT ON FUNCTION "private"."has_permission"(text) IS 'True when the caller''s role holds the given permission.';

COMMENT ON FUNCTION "public"."adjust_stock"(uuid, public.stock_movement_type, integer, text) IS 'Records a stock movement and returns the resulting stock level.';

COMMENT ON FUNCTION "public"."get_or_create_category"(text) IS 'Case-insensitive category lookup, creating it when absent.';

COMMENT ON TABLE "public"."categories" IS 'Product categories, managed from the inventory screens.';

COMMENT ON TABLE "public"."permissions" IS 'Catalogue of permission keys used by RLS policies.';

COMMENT ON TABLE "public"."products" IS 'Furniture catalogue. category_id restricts, so a category in use cannot be deleted.';

COMMENT ON TABLE "public"."role_permissions" IS 'Permissions held by each application role.';

COMMENT ON TABLE "public"."stock_movements" IS 'Append-only stock ledger. qty_change is signed.';

REVOKE ALL ON FUNCTION "private"."has_permission"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."has_permission"(text) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."touch_updated_at"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."touch_updated_at"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."adjust_stock"(uuid, public.stock_movement_type, integer, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."adjust_stock"(uuid, public.stock_movement_type, integer, text) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_or_create_category"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_or_create_category"(text) TO "authenticated", "postgres";

REVOKE ALL ON TABLE "public"."categories" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."categories" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."categories" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."permissions" FROM "authenticated";

GRANT SELECT ON TABLE "public"."permissions" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."permissions" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."products" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."products" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."products" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."role_permissions" FROM "authenticated";

GRANT DELETE, INSERT, SELECT ON TABLE "public"."role_permissions" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."role_permissions" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."stock_movements" FROM "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."stock_movements" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stock_movements" TO "postgres", "service_role";

GRANT USAGE ON TYPE "public"."stock_movement_type" TO "postgres";
