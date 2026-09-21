-- Custom Access Token hook: stamps the user's role onto the access token as the
-- `user_role` claim, so RLS policies can authorize from the JWT alone.
-- Runs as supabase_auth_admin (see the grant on the function), which is why
-- that role is granted SELECT on public.profiles in 02_profiles.sql.
-- Enable it in config.toml under [auth.hook.custom_access_token].

create function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
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
$$;

comment on function public.custom_access_token_hook(jsonb) is 'Adds the user_role claim to issued access tokens.';

grant usage on schema public to supabase_auth_admin;
grant select on table public.profiles to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
