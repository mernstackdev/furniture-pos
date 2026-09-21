-- Guards the security posture of the shop schema itself, rather than any one
-- feature: RLS on every table, no reachable privileges for anon, and no
-- privilege that RLS cannot police.
--
-- Read-only, so it needs no transaction.
--   run: supabase test db
begin;
select plan(8);

-- Every table must have RLS enabled. A table without it is readable by any
-- signed-in user through PostgREST, whatever the policies say.
select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0,
  'every table in public has row level security enabled'
);

-- RLS with no policies denies everything, which breaks the app in a way that
-- looks like a bug rather than a lockdown. Each table should carry policies.
select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and not exists (
        select 1 from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname
      )),
  0,
  'every table in public has at least one policy'
);

-- anon holds the publishable key. It must reach shop data only through the two
-- setup bootstrap functions, never a table or view directly.
select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
      and c.relacl is not null
      and exists (
        select 1 from aclexplode(c.relacl) a
         where a.grantee::regrole::text = 'anon'
      )),
  0,
  'anon holds no privileges on any table or view'
);

-- TRUNCATE ignores row level security entirely, so holding it defeats every
-- policy on the table.
select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and c.relacl is not null
      and exists (
        select 1 from aclexplode(c.relacl) a
         where a.grantee::regrole::text = 'authenticated'
           and a.privilege_type = 'TRUNCATE'
      )),
  0,
  'authenticated cannot truncate any table'
);

-- Unused by the app, and TRIGGER/REFERENCES on a client role are needless
-- surface.
select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and c.relacl is not null
      and exists (
        select 1 from aclexplode(c.relacl) a
         where a.grantee::regrole::text = 'authenticated'
           and a.privilege_type in ('REFERENCES', 'TRIGGER')
      )),
  0,
  'authenticated holds no references or trigger privileges'
);

-- A view without security_invoker runs as its owner and so bypasses the RLS of
-- the tables underneath it.
select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
      and not exists (
        select 1 from unnest(coalesce(c.reloptions, '{}')) o
         where o in ('security_invoker=true', 'security_invoker=on', 'security_invoker=1')
      )),
  0,
  'every view in public is security_invoker'
);

-- The invoice counter is only advanced from inside create_sale (SECURITY
-- DEFINER), so no client role needs the sequence.
select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'S'
      and c.relacl is not null
      and exists (
        select 1 from aclexplode(c.relacl) a
         where a.grantee::regrole::text in ('anon', 'authenticated')
      )),
  0,
  'client roles hold no privileges on sequences'
);

-- The durable fix for tables that do not exist yet: without this, the next
-- CREATE TABLE silently grants privileges to anon again.
--
-- Scoped to the postgres-owned default, which is the one that applies to
-- objects a migration creates, because migrations connect as postgres. A second
-- default owned by supabase_admin grants anon full DML and governs tables made
-- from the dashboard's Table Editor, but changing it needs membership in that
-- role, which postgres does not have here or on a hosted project — so it cannot
-- be asserted or fixed from a migration. Enable RLS on anything created there.
select is(
  (select count(*)::int
     from pg_default_acl d
     join pg_namespace n on n.oid = d.defaclnamespace
     join pg_roles r on r.oid = d.defaclrole
    where n.nspname = 'public' and d.defaclobjtype = 'r' and r.rolname = 'postgres'
      and exists (
        select 1 from aclexplode(d.defaclacl) a
         where a.grantee::regrole::text = 'anon'
      )),
  0,
  'new tables created by a migration are not granted to anon by default'
);

select * from finish();
rollback;
