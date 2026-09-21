-- Staff profiles. `role` is the single source of truth for authorization; it is
-- injected into the JWT by the custom access token hook (03_auth_hook.sql) so
-- RLS policies can read it without a recursive lookup.

create type public.app_role as enum ('admin', 'cashier');

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  role       public.app_role not null default 'cashier',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Staff profile. role is the source of truth for authorization.';

create index profiles_created_at_idx on public.profiles (created_at desc);

-- Keep the profile row in step with auth.users. Created by the Auth service
-- (not by this schema), so a trigger is the only way to guarantee a profile
-- exists for every user.
create schema if not exists private;

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

comment on function private.handle_new_auth_user() is 'Mirrors auth.users email into public.profiles.';

create trigger on_auth_user_changed
  after insert or update on auth.users
  for each row execute function private.handle_new_auth_user();

-- Restricts which COLUMNS a signed-in user may change. RLS policies can only
-- filter rows, never columns, and a column-level GRANT on `full_name` cannot
-- express "admins may change role, users may not" because admins act as the
-- same `authenticated` role. A trigger can express it.
--
-- `current_user` is checked because a SECURITY DEFINER function (the admin
-- RPCs, which set the role at creation) runs as its owner, while a direct
-- PostgREST request runs as `authenticated`.
create function private.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
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
$$;

comment on function private.protect_profile_columns() is 'Lets non-admins update only their own full_name.';

create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function private.protect_profile_columns();

revoke execute on function private.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function private.protect_profile_columns() from public, anon, authenticated;

grant usage on schema private to supabase_auth_admin;
grant execute on function private.handle_new_auth_user() to supabase_auth_admin;

-- Row Level Security -------------------------------------------------------

alter table public.profiles enable row level security;

-- New tables in public are no longer auto-exposed to the Data API (see
-- [api] auto_expose_new_tables in config.toml), so every grant is explicit.
-- `anon` gets nothing: profiles are staff-only data.
revoke all on table public.profiles from anon, authenticated;
grant select, update on table public.profiles to authenticated;

-- service_role bypasses RLS entirely, so its grants are stated explicitly
-- rather than left to drift. It is not used by this app; it exists for
-- server-side/admin tooling.
grant select, insert, update, delete on table public.profiles to service_role;

-- One policy per operation. Splitting "own row" and "admin" into two policies
-- would trip the multiple_permissive_policies advisor: permissive policies for
-- the same role+command are OR'd anyway, so combining them is equivalent and
-- cheaper. Only the function CALL is wrapped in a scalar subquery, which is
-- what turns it into a single InitPlan instead of a per-row evaluation.
create policy "Signed-in users can view own profile, admins any"
on public.profiles for select to authenticated
using (
  (select auth.uid()) = id
  or ((select auth.jwt()) ->> 'user_role') = 'admin'
);

create policy "Signed-in users can update own profile, admins any"
on public.profiles for update to authenticated
using (
  (select auth.uid()) = id
  or ((select auth.jwt()) ->> 'user_role') = 'admin'
)
with check (
  (select auth.uid()) = id
  or ((select auth.jwt()) ->> 'user_role') = 'admin'
);

-- The access token hook runs as supabase_auth_admin, which needs to read the
-- role despite RLS being on.
create policy "Auth admin reads profiles"
on public.profiles for select to supabase_auth_admin
using ( true );
