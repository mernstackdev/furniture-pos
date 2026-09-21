-- Role -> permission mapping.
--
-- Authorization is expressed as permission keys rather than checked against a
-- role directly, so what a role may do can change without editing policies.
--
-- The catalogue ROWS are reference data (DML), which the declarative diff does
-- not capture. They are applied by the permission_catalogue migration.

create table public.permissions (
  key         text primary key,
  description text not null default ''
);

create table public.role_permissions (
  role           public.app_role not null,
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (role, permission_key)
);

comment on table public.permissions is 'Catalogue of permission keys used by RLS policies.';
comment on table public.role_permissions is 'Permissions held by each application role.';

-- SECURITY INVOKER on purpose: this reads public.role_permissions through RLS
-- (granted below), which is why no security-definer function is needed here.
create function private.has_permission(p_permission text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.role_permissions rp
    where rp.permission_key = p_permission
      and rp.role = (select private.current_role())
  );
$$;

comment on function private.has_permission(text) is 'True when the caller''s role holds the given permission.';

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

-- New tables in public are not auto-exposed, so every grant is explicit.
-- Both tables are non-sensitive configuration, and policies need to read them.
revoke all on table public.permissions from anon, authenticated;
revoke all on table public.role_permissions from anon, authenticated;

grant select on table public.permissions to authenticated;
grant select, insert, delete on table public.role_permissions to authenticated;

grant select, insert, update, delete on table public.permissions to service_role;
grant select, insert, update, delete on table public.role_permissions to service_role;

-- USAGE on the schema is required for the function to be callable from user
-- context (an RPC body, say). USAGE alone grants nothing: EXECUTE stays revoked
-- on every other function in this schema, so has_permission is the only one
-- reachable.
grant usage on schema private to authenticated;

grant execute on function private.has_permission(text) to authenticated;
revoke execute on function private.has_permission(text) from public, anon;

create policy "Signed-in users can read permissions"
on public.permissions for select to authenticated
using ( true );

create policy "Signed-in users can read role permissions"
on public.role_permissions for select to authenticated
using ( true );

-- One policy per command, so the multiple_permissive_policies advisor stays quiet.
create policy "Staff managers can grant a permission"
on public.role_permissions for insert to authenticated
with check ( (select private.has_permission('staff.manage')) );

create policy "Staff managers can revoke a permission"
on public.role_permissions for delete to authenticated
using ( (select private.has_permission('staff.manage')) );
