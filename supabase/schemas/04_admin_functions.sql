-- Privileged user-management RPCs.
--
-- Creating/deleting users and resetting passwords happens in the Auth service,
-- not in Postgres, so these functions call the Auth admin API over the
-- synchronous `http` extension. The secret key lives in Supabase Vault (created
-- out of band, never in a schema file), so it never enters the app runtime.
--
-- These are SECURITY DEFINER functions in the exposed `public` schema, i.e. they
-- are Data API endpoints. Each one therefore revokes EXECUTE from PUBLIC and
-- verifies the caller's role itself, rather than trusting the role alone.

-- Shared guard -------------------------------------------------------------

create function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select private.current_role()) is distinct from 'admin' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function private.require_admin() from public, anon, authenticated;

-- Auth admin API plumbing --------------------------------------------------

create function private.auth_admin_request(
  p_method text,
  p_path   text,
  p_body   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

comment on function private.auth_admin_request(text, text, text) is 'Calls the Auth admin API with the Vault-held secret key.';

revoke execute on function private.auth_admin_request(text, text, text) from public, anon, authenticated;

-- Admin RPCs ---------------------------------------------------------------

create function public.admin_create_user(
  p_email     text,
  p_password  text,
  p_full_name text,
  p_role      public.app_role
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public.admin_create_user(text, text, text, public.app_role) from public, anon;
grant execute on function public.admin_create_user(text, text, text, public.app_role) to authenticated;

create function public.admin_reset_password(p_user_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();

  perform private.auth_admin_request(
    'PUT',
    '/admin/users/' || p_user_id::text,
    jsonb_build_object('password', p_password)::text
  );
end;
$$;

revoke execute on function public.admin_reset_password(uuid, text) from public, anon;
grant execute on function public.admin_reset_password(uuid, text) to authenticated;

create function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- First-run bootstrap ------------------------------------------------------

-- `anon` cannot read public.profiles (no grant), so the setup screen cannot
-- count profiles itself. This exposes only the boolean.
create function public.is_setup_required()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.profiles);
$$;

revoke execute on function public.is_setup_required() from public;
grant execute on function public.is_setup_required() to anon, authenticated;

create function public.create_first_admin(
  p_email     text,
  p_password  text,
  p_full_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public.create_first_admin(text, text, text) from public;
grant execute on function public.create_first_admin(text, text, text) to anon, authenticated;
