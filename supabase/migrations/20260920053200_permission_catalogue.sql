-- Permission catalogue (reference data).
--
-- This is DML, and the declarative schema diff does not capture DML, so it
-- lives in a versioned migration rather than in supabase/schemas/. Without
-- these rows every permission-gated policy denies, so this is required data,
-- not sample data.
--
-- Cashier starts with inventory.view only: the admin grants inventory.manage
-- from the Staff screen when a cashier should be allowed to edit inventory.

insert into public.permissions (key, description) values
  ('inventory.view',   'View products, categories and stock levels'),
  ('inventory.manage', 'Create, edit and delete products and categories, and adjust stock'),
  ('staff.manage',     'Manage staff accounts and role permissions')
on conflict (key) do nothing;

insert into public.role_permissions (role, permission_key) values
  ('admin',   'inventory.view'),
  ('admin',   'inventory.manage'),
  ('admin',   'staff.manage'),
  ('cashier', 'inventory.view')
on conflict do nothing;
