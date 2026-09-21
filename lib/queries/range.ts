import type { PostgrestError } from "@supabase/supabase-js";

/**
 * True when a paged read asked for a range past the end of the result set.
 *
 * PostgREST answers that with an error (PGRST103, "requested range not
 * satisfiable") rather than an empty page, which is reachable from any stale
 * `?page=99` link or from a filter that shrank the result set. Throwing on it
 * fails the whole render; treating it as an empty page lets the caller degrade
 * — and lets a page that clamps redirect to a real page instead of 500ing.
 *
 * Every other error is still a real error and must be thrown.
 */
export function isEmptyRange(error: PostgrestError | null): boolean {
  return error?.code === "PGRST103";
}
