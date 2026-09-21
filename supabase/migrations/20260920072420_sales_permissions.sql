-- Permissions for the sales domain (reference data; DML is not captured by the
-- declarative diff, so it lives in a versioned migration).

insert into public.permissions (key, description) values
  ('sales.view',       'View sales, invoices and customers'),
  ('sales.manage',     'Record sales at the till'),
  ('customers.manage', 'Create, edit and delete customers')
on conflict (key) do nothing;

-- Running the till is the cashier's job, so they get all three. What separates
-- them from an admin is inventory, staff and settings, not selling.
insert into public.role_permissions (role, permission_key) values
  ('admin',   'sales.view'),
  ('admin',   'sales.manage'),
  ('admin',   'customers.manage'),
  ('cashier', 'sales.view'),
  ('cashier', 'sales.manage'),
  ('cashier', 'customers.manage')
on conflict do nothing;
