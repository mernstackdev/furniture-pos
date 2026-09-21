SET local check_function_bodies = off;

DROP POLICY "Signed-in users can update own profile, admins any" ON "public"."profiles";

DROP POLICY "Signed-in users can view own profile, admins any" ON "public"."profiles";

CREATE OR REPLACE FUNCTION private."current_role"()
  RETURNS public.app_role
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select role from public.profiles where id = (select auth.uid());
$function$;

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
      and rp.role = (select private.current_role())
  );
$function$;

CREATE OR REPLACE FUNCTION private.protect_profile_columns()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if current_user <> 'authenticated' then
    new.updated_at := now();
    return new;
  end if;

  if (select private.current_role()) = 'admin' then
    new.updated_at := now();
    return new;
  end if;

  if new.role       is distinct from old.role
     or new.email      is distinct from old.email
     or new.id         is distinct from old.id
     or new.created_at is distinct from old.created_at then
    raise exception 'only full_name can be updated' using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.require_admin()
  RETURNS void
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if (select private.current_role()) is distinct from 'admin' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
end;
$function$;

CREATE POLICY "Signed-in users can update own profile, admins any" ON "public"."profiles"
  FOR UPDATE
  TO "authenticated"
  USING (((( SELECT auth.uid() AS uid) = id) OR (( SELECT private."current_role"() AS "current_role") = 'admin'::public.app_role)))
  WITH CHECK (((( SELECT auth.uid() AS uid) = id) OR (( SELECT private."current_role"() AS "current_role") = 'admin'::public.app_role)));

CREATE POLICY "Signed-in users can view own profile, admins any" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING (((( SELECT auth.uid() AS uid) = id) OR (( SELECT private."current_role"() AS "current_role") = 'admin'::public.app_role)));

COMMENT ON FUNCTION "private"."current_role"() IS 'The caller''s role, read live from public.profiles.';

REVOKE ALL ON FUNCTION "private"."current_role"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."current_role"() TO "authenticated", "postgres";

-- Removed from the generated diff: statements re-granting `anon` UPDATE on
-- public.invoice_number_seq, plus ALTER DEFAULT PRIVILEGES giving `anon` and
-- `authenticated` MAINTAIN/REFERENCES/TRIGGER/TRUNCATE on future tables.
--
-- Those are not part of this change. They reappear on every declarative sync
-- because the tool diffs against a shadow database whose default privileges
-- still carry Supabase's permissive defaults, and this project deliberately
-- revoked them (see 20260921060000_security_hardening.sql and
-- `auto_expose_new_tables = false` in config.toml). Applying them would undo
-- that hardening, so they must be dropped from any generated migration by hand.
