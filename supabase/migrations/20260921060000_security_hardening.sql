-- Client roles must reach shop data only through row level security.
--
-- Why this exists, given the schema files already say `revoke ... from anon`:
--
--   1. `supabase db schema declarative sync` does not translate those revokes
--      faithfully. It turned
--        revoke all on table public.customers from anon, authenticated;
--      into a revoke from `authenticated` alone, quietly dropping `anon`, so
--      `anon` kept the privileges PostgreSQL's default ACLs hand to new tables.
--      The generated migrations are therefore NOT a reliable record of ACLs.
--   2. A hosted project auto-exposes new tables to `anon`/`authenticated` by
--      default, more broadly than the local stack does.
--
-- TRUNCATE is the privilege that matters: it is NOT subject to row level
-- security, so a role holding it can empty a table no matter what its policies
-- say. REFERENCES, TRIGGER and MAINTAIN are simply unused by this app. The
-- select/insert/update/delete grants the app does need are left in place — the
-- policies are what constrain those.
--
-- Idempotent: safe to run repeatedly.

do $$
declare
  t record;
  -- MAINTAIN arrived in PostgreSQL 17. Naming it on an older server is a syntax
  -- error, and the hosted project may run an older major than the local one.
  privileges text := 'truncate, references, trigger';
begin
  if current_setting('server_version_num')::int >= 170000 then
    privileges := privileges || ', maintain';
  end if;

  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm')
  loop
    -- anon should have no direct access to shop data at all. The only things it
    -- may call are the setup bootstrap helpers, granted separately, and both of
    -- those refuse to act once an account exists.
    execute format('revoke all on public.%I from anon', t.relname);
    execute format('revoke %s on public.%I from authenticated', privileges, t.relname);
  end loop;
end $$;

-- The invoice counter is only ever advanced from inside create_sale, which is
-- SECURITY DEFINER and therefore runs with the owner's rights, not the caller's.
revoke all on sequence public.invoice_number_seq from anon, authenticated;

-- Stop future objects inheriting these grants at CREATE time. This applies to
-- objects created by the current role, which is the role migrations run as.
--
-- Note the consequence: a new table or function now needs an explicit `grant`
-- for `authenticated`. That is the secure default — it fails closed and loudly,
-- at the first query, rather than silently exposing rows.
do $$
declare
  tables_without_maintain text := 'truncate, references, trigger';
  tables_with_maintain text := 'truncate, references, trigger, maintain';
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'alter default privileges in schema public
               revoke ' || tables_with_maintain || ' on tables from anon, authenticated';
  else
    execute 'alter default privileges in schema public
               revoke ' || tables_without_maintain || ' on tables from anon, authenticated';
  end if;

  execute 'alter default privileges in schema public revoke all on sequences from anon, authenticated';
  -- Otherwise every new function is executable by the whole world, which on a
  -- SECURITY DEFINER function is exactly the mistake worth preventing.
  execute 'alter default privileges in schema public revoke execute on functions from public';
end $$;

-- A second set of defaults is owned by supabase_admin, and it is the one that
-- applies to tables created from the dashboard's Table Editor. It grants anon
-- full DML, so a dashboard-created table would be world reachable at the grant
-- level. Changing another role's defaults needs membership in that role, which
-- the hosted `postgres` may not have, so this is best effort: the guarantee the
-- app depends on is the postgres-owned default above, because migrations run as
-- postgres.
do $$
begin
  execute 'alter default privileges for role supabase_admin in schema public
             revoke all on tables from anon, authenticated';
  execute 'alter default privileges for role supabase_admin in schema public
             revoke all on sequences from anon, authenticated';
exception
  when insufficient_privilege then
    raise notice 'not a member of supabase_admin; leaving its default privileges alone';
  when undefined_object then
    raise notice 'no supabase_admin role on this server';
end $$;
