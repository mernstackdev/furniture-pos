-- Extensions used by the declarative schema.
-- `http` is pgsql-http: a SYNCHRONOUS http client, which is what lets the admin
-- functions return the Auth API response directly. pg_net is async-only and
-- cannot return a result to the caller.
create schema if not exists extensions;

create extension if not exists http with schema extensions;
