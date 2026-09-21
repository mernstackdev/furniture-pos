-- RLS tests for public.profiles.
--   create: supabase test new profiles_rls.test
--   run:    supabase test db
--
-- The two denied cases are different and both are covered here:
--   * a missing GRANT raises 42501 before any policy runs
--   * a WITH CHECK / trigger violation also raises 42501
--   * a USING clause that filters a row out raises nothing at all, so those are
--     asserted with is_empty() and then paired with a read proving the target
--     row is untouched.
begin;
select plan(11);

-- Seed ---------------------------------------------------------------------
-- Everything here is inside the transaction and rolled back at the end, so
-- clearing the table is safe and keeps the assertions independent of whatever
-- accounts happen to exist in the local database.
delete from public.profiles;

-- Only `id` is required on auth.users. The on_auth_user_changed trigger is what
-- creates the profile rows, so this also exercises it.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'cashier@test.local');

update public.profiles
   set role = 'admin'
 where id = '11111111-1111-1111-1111-111111111111';

select results_eq(
  $$select count(*)::int from public.profiles$$,
  array[2],
  'the auth.users trigger created one profile per user'
);

-- anon: no grant at all ----------------------------------------------------
set local role anon;
set local request.jwt.claims = '';

select throws_ok(
  $$select * from public.profiles$$,
  '42501', null,
  'anon cannot read profiles (no grant)'
);

select throws_ok(
  $$update public.profiles set full_name = 'nope'$$,
  '42501', null,
  'anon cannot update profiles (no grant)'
);

-- cashier: own row only ----------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","user_role":"cashier","role":"authenticated","aud":"authenticated"}';

select results_eq(
  $$select email from public.profiles order by email$$,
  array['cashier@test.local'],
  'cashier reads exactly one profile: their own'
);

select is_empty(
  $$select 1 from public.profiles where id = '11111111-1111-1111-1111-111111111111'$$,
  'cashier cannot see the admin profile'
);

select results_eq(
  $$update public.profiles
       set full_name = 'Cashier One'
     where id = '22222222-2222-2222-2222-222222222222'
     returning full_name$$,
  array['Cashier One'],
  'cashier can update their own full_name'
);

select throws_ok(
  $$update public.profiles
       set role = 'admin'
     where id = '22222222-2222-2222-2222-222222222222'$$,
  '42501', null,
  'cashier cannot promote themselves (column guard trigger)'
);

select results_eq(
  $$select role::text from public.profiles where id = '22222222-2222-2222-2222-222222222222'$$,
  array['cashier'],
  'the denied promotion left the row intact'
);

-- admin: everything --------------------------------------------------------
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","user_role":"admin","role":"authenticated","aud":"authenticated"}';

select results_eq(
  $$select count(*)::int from public.profiles$$,
  array[2],
  'admin reads every profile'
);

select results_eq(
  $$update public.profiles
       set role = 'admin'
     where id = '22222222-2222-2222-2222-222222222222'
     returning role::text$$,
  array['admin'],
  'admin can change another user role'
);

-- bootstrap is one-shot ----------------------------------------------------
set local role anon;
set local request.jwt.claims = '';

select throws_ok(
  $$select public.create_first_admin('late@test.local', 'password1', 'Late')$$,
  '42501', null,
  'create_first_admin refuses once a profile exists'
);

select * from finish();
rollback;
