# Taste: Database & Backend

- Uses the declarative schema approach for Supabase migrations: `supabase/schemas/*.sql` is the source of truth and migrations are generated from it, instead of hand-writing imperative migrations. Confidence: 0.85
- Does not want the Supabase secret/service key exposed in the app env; privileged Auth operations (create/delete user, reset password) should be wrapped in Postgres `security definer` functions called via RPC, with the key held in Supabase Vault. Confidence: 0.7
- Normalises enum-like/reference data into its own table (e.g. product categories as a `categories` table rather than a hardcoded TypeScript union) so values are manageable at runtime. Confidence: 0.6
- Guards seed/migration data so it never resurrects or overwrites records the user has curated — expects existing data to be preserved and any accidentally re-added rows cleaned up. Confidence: 0.6
- Treats row level security as a non-negotiable baseline: every table must have RLS enabled and appropriate policies, with no client role (e.g. `anon`) reachable directly. Confidence: 0.75
- Before pushing changes to a live/hosted Supabase project, wants an explicit security audit first — verifies RLS coverage, grants and policies rather than assuming, and expects "no security risks" to be demonstrated, not asserted. Confidence: 0.75
