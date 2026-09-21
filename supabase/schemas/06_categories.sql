-- Product categories. Promoted out of the hardcoded TypeScript union so new
-- ones can be created from the product form.

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

comment on table public.categories is 'Product categories, managed from the inventory screens.';

-- Case-insensitive uniqueness: the create-if-missing flow must not be able to
-- produce both "Sofas" and "sofas".
create unique index categories_name_lower_key on public.categories (lower (name));

alter table public.categories enable row level security;

revoke all on table public.categories from anon, authenticated;
grant select, insert, update, delete on table public.categories to authenticated;
grant select, insert, update, delete on table public.categories to service_role;

create policy "Read categories with inventory.view"
on public.categories for select to authenticated
using ( (select private.has_permission('inventory.view')) );

create policy "Create categories with inventory.manage"
on public.categories for insert to authenticated
with check ( (select private.has_permission('inventory.manage')) );

create policy "Update categories with inventory.manage"
on public.categories for update to authenticated
using ( (select private.has_permission('inventory.manage')) )
with check ( (select private.has_permission('inventory.manage')) );

create policy "Delete categories with inventory.manage"
on public.categories for delete to authenticated
using ( (select private.has_permission('inventory.manage')) );
