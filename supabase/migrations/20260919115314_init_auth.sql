SET local check_function_bodies = off;

CREATE SCHEMA "private";

CREATE EXTENSION "http" SCHEMA "extensions";

CREATE TABLE "public"."profiles" (
  "id"         uuid                     NOT NULL,
  "email"      text                     NOT NULL,
  "full_name"  text                     NOT NULL DEFAULT ''::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."app_role" AS ENUM (
  'admin',
  'cashier'
);

ALTER TABLE "public"."profiles"
  ADD COLUMN "role" public.app_role NOT NULL DEFAULT 'cashier'::public.app_role;

CREATE OR REPLACE FUNCTION private.auth_admin_request (
  p_method text,
  p_path   text,
  p_body   text DEFAULT NULL::text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_secret  text;
  v_base    text;
  v_status  integer;
  v_content text;
  v_json    jsonb;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'supabase_secret_key';

  select decrypted_secret into v_base
  from vault.decrypted_secrets where name = 'supabase_auth_url';

  if v_secret is null or v_base is null then
    raise exception 'vault secrets supabase_secret_key / supabase_auth_url are not configured';
  end if;

  select r.status, r.content into v_status, v_content
  from extensions.http(
    row(
      p_method::extensions.http_method,
      (v_base || p_path)::varchar,
      array[
        row('apikey', v_secret)::extensions.http_header,
        row('Authorization', 'Bearer ' || v_secret)::extensions.http_header
      ],
      'application/json'::varchar,
      p_body::varchar
    )::extensions.http_request
  ) as r;

  v_json := coalesce(nullif(v_content, ''), '{}')::jsonb;

  if v_status is null or v_status < 200 or v_status >= 300 then
    raise exception 'auth admin request % % failed with %: %',
      p_method, p_path, v_status,
      coalesce(v_json ->> 'msg', v_json ->> 'message', v_content, 'no response body')
      using errcode = '42501';
  end if;

  return v_json;
end;
$function$;

CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
    set email      = excluded.email,
        updated_at = now();
  return new;
end;
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

  if (select auth.jwt() ->> 'user_role') = 'admin' then
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
  if (select auth.jwt() ->> 'user_role') is distinct from 'admin' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_user (
  p_email     text,
  p_password  text,
  p_full_name text,
  p_role      public.app_role
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_id uuid;
begin
  perform private.require_admin();

  v_id := (
    private.auth_admin_request(
      'POST',
      '/admin/users',
      jsonb_build_object(
        'email',          p_email,
        'password',       p_password,
        'email_confirm',  true,
        'user_metadata',  jsonb_build_object('full_name', p_full_name)
      )::text
    ) ->> 'id'
  )::uuid;

  -- The auth.users trigger created the row with the default role; set the
  -- requested role here. Role deliberately never comes from user metadata,
  -- which the user themselves can write.
  update public.profiles
     set role = p_role, full_name = p_full_name, updated_at = now()
   where id = v_id;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_user (
  p_user_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform private.require_admin();

  if p_user_id = (select auth.uid()) then
    raise exception 'you cannot delete your own account';
  end if;

  if exists (select 1 from public.profiles where id = p_user_id and role = 'admin')
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'cannot delete the last admin';
  end if;

  perform private.auth_admin_request('DELETE', '/admin/users/' || p_user_id::text);
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_reset_password (
  p_user_id  uuid,
  p_password text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform private.require_admin();

  perform private.auth_admin_request(
    'PUT',
    '/admin/users/' || p_user_id::text,
    jsonb_build_object('password', p_password)::text
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_first_admin (
  p_email     text,
  p_password  text,
  p_full_name text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_id uuid;
begin
  -- Self-guarding: once any profile exists this can never run again, which is
  -- what makes granting it to `anon` acceptable.
  if exists (select 1 from public.profiles) then
    raise exception 'setup has already been completed' using errcode = '42501';
  end if;

  v_id := (
    private.auth_admin_request(
      'POST',
      '/admin/users',
      jsonb_build_object(
        'email',         p_email,
        'password',      p_password,
        'email_confirm', true,
        'user_metadata', jsonb_build_object('full_name', p_full_name)
      )::text
    ) ->> 'id'
  )::uuid;

  update public.profiles
     set role = 'admin', full_name = p_full_name, updated_at = now()
   where id = v_id;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook (
  event jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
declare
  claims    jsonb;
  user_role public.app_role;
begin
  select role into user_role
  from public.profiles
  where id = (event ->> 'user_id')::uuid;

  claims := event -> 'claims';

  if user_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  end if;

  return jsonb_build_object('claims', claims);
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_setup_required()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select not exists (select 1 from public.profiles);
$function$;

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX profiles_created_at_idx ON public.profiles USING btree (created_at DESC);

CREATE TRIGGER on_auth_user_changed
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_auth_user();

CREATE TRIGGER protect_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.protect_profile_columns();

CREATE POLICY "Auth admin reads profiles" ON "public"."profiles"
  FOR SELECT
  TO "supabase_auth_admin"
  USING (true);

CREATE POLICY "Signed-in users can update own profile, admins any" ON "public"."profiles"
  FOR UPDATE
  TO "authenticated"
  USING (((( SELECT auth.uid() AS uid) = id) OR ((( SELECT auth.jwt() AS jwt) ->> 'user_role'::text) = 'admin'::text)))
  WITH CHECK (((( SELECT auth.uid() AS uid) = id) OR ((( SELECT auth.jwt() AS jwt) ->> 'user_role'::text) = 'admin'::text)));

CREATE POLICY "Signed-in users can view own profile, admins any" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING (((( SELECT auth.uid() AS uid) = id) OR ((( SELECT auth.jwt() AS jwt) ->> 'user_role'::text) = 'admin'::text)));

COMMENT ON EXTENSION "http" IS 'HTTP client for PostgreSQL, allows web page retrieval inside the database.';

COMMENT ON FUNCTION "private"."auth_admin_request"(text, text, text) IS 'Calls the Auth admin API with the Vault-held secret key.';

COMMENT ON FUNCTION "private"."handle_new_auth_user"() IS 'Mirrors auth.users email into public.profiles.';

COMMENT ON FUNCTION "private"."protect_profile_columns"() IS 'Lets non-admins update only their own full_name.';

COMMENT ON FUNCTION "public"."custom_access_token_hook"(jsonb) IS 'Adds the user_role claim to issued access tokens.';

COMMENT ON TABLE "public"."profiles" IS 'Staff profile. role is the source of truth for authorization.';

REVOKE ALL ON FUNCTION "private"."auth_admin_request"(text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."auth_admin_request"(text, text, text) TO "postgres";

REVOKE ALL ON FUNCTION "private"."handle_new_auth_user"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."handle_new_auth_user"() TO "postgres", "supabase_auth_admin";

REVOKE ALL ON FUNCTION "private"."protect_profile_columns"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."protect_profile_columns"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."require_admin"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."require_admin"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."admin_create_user"(text, text, text, public.app_role) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."admin_create_user"(text, text, text, public.app_role) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."admin_delete_user"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."admin_delete_user"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."admin_reset_password"(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."admin_reset_password"(uuid, text) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."create_first_admin"(text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."create_first_admin"(text, text, text) TO "anon", "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."custom_access_token_hook"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."custom_access_token_hook"(jsonb) TO "postgres", "supabase_auth_admin";

REVOKE ALL ON FUNCTION "public"."is_setup_required"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."is_setup_required"() TO "anon", "authenticated", "postgres";

GRANT CREATE, USAGE ON SCHEMA "private" TO "postgres";

GRANT USAGE ON SCHEMA "private" TO "supabase_auth_admin";

REVOKE ALL ON SCHEMA "public" FROM "supabase_auth_admin";

GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";

REVOKE ALL ON TABLE "public"."profiles" FROM "authenticated";

GRANT SELECT, UPDATE ON TABLE "public"."profiles" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "postgres", "service_role";

GRANT SELECT ON TABLE "public"."profiles" TO "supabase_auth_admin";

GRANT USAGE ON TYPE "public"."app_role" TO "postgres";
