import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/lib/auth";

// Server-only: imported by Server Actions, never by a client component.

export const NOT_SIGNED_IN = "You are not signed in.";
export const INVENTORY_DENIED = "You don't have permission to change inventory.";

/**
 * Every action re-checks the caller. Proxy does not cover Server Actions, and
 * the database policies are the real gate — this only produces a clearer
 * message than a rejected query would.
 */
export async function authorizeInventory() {
  const user = await getSessionUser();
  if (!user) return { supabase: null, error: NOT_SIGNED_IN, user: null };
  if (!user.permissions.includes("inventory.manage")) {
    return { supabase: null, error: INVENTORY_DENIED, user: null };
  }
  // `user` is returned so actions can stamp created_by without a second lookup.
  return { supabase: createClient(await cookies()), error: null, user };
}

/** Turns a Postgres/PostgREST error into something a shopkeeper can read. */
export function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "That record already exists.";
  if (error.code === "23503") {
    return "That record is still referenced by something else and cannot be removed.";
  }
  if (error.code === "42501") return INVENTORY_DENIED;
  return error.message;
}
