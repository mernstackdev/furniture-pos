-- Environment-specific Vault secrets for the privileged Auth RPCs.
--
-- Why this is a separate file and not a schema:
--   supabase/schemas/* is the declarative source of truth for *schema objects*.
--   The secret key and Auth URL are rows, not schema, so the declarative diff
--   cannot manage them. They must be created once per environment, and
--   `supabase db reset` wipes them along with the rest of the database — after
--   a reset, /setup fails with:
--     "vault secrets supabase_secret_key / supabase_auth_url are not configured"
--
-- How to run:
--   Supabase Dashboard -> SQL Editor for the target project, paste this with the
--   values for that environment, and run it. It is idempotent: re-running
--   updates the secrets in place instead of colliding with the unique name.
--
-- Values per environment:
--   local  :: supabase_auth_url   = http://kong:8000/auth/v1
--             supabase_secret_key = the local secret key printed by `supabase status`
--   hosted :: supabase_auth_url   = https://<project-ref>.supabase.co/auth/v1
--             supabase_secret_key = a secret key from Dashboard -> Settings -> API Keys
--
-- Note the local URL uses the internal Docker hostname `kong`, because the
-- request is made from inside the database container, not from your machine.
-- The hosted equivalent is the public HTTPS project URL; pgsql-http handles TLS.
--
-- Never commit a real key here. Get it from the dashboard, and treat it as a
-- secret: it bypasses Row Level Security entirely.

do $$
declare
  v_auth_url text := 'https://REPLACE_WITH_PROJECT_REF.supabase.co/auth/v1';
  v_secret   text := 'sb_secret_REPLACE_ME';
  v_id       uuid;
begin
  select id into v_id from vault.secrets where name = 'supabase_auth_url';
  if v_id is null then
    perform vault.create_secret(v_auth_url, 'supabase_auth_url', 'Auth base URL');
  else
    perform vault.update_secret(v_id, v_auth_url, 'supabase_auth_url', 'Auth base URL');
  end if;

  select id into v_id from vault.secrets where name = 'supabase_secret_key';
  if v_id is null then
    perform vault.create_secret(v_secret, 'supabase_secret_key', 'Auth admin API key');
  else
    perform vault.update_secret(v_id, v_secret, 'supabase_secret_key', 'Auth admin API key');
  end if;
end $$;

-- Masked confirmation that both secrets are readable.
select name,
       left(decrypted_secret, 14) || '...' as preview,
       description
from vault.decrypted_secrets
where name in ('supabase_auth_url', 'supabase_secret_key')
order by name;
