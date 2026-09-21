import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Staff-screen queries: the account list (from `profiles`), the permission
 * catalogue, and the role -> permission grants behind the matrix.
 *
 * Taken by the Supabase client so the same definition serves the server
 * prefetch and the browser cache. The keys must match exactly across the two or
 * the dehydrated data would sit under a key the component never reads.
 */

export type StaffRole = "admin" | "cashier";

export interface StaffMember {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
  createdAt: string;
}

export interface PermissionRow {
  key: string;
  description: string;
}

/** The matrix columns, and the roles the grant map is seeded with. */
export const STAFF_ROLES: StaffRole[] = ["admin", "cashier"];

export function staffListQuery(supabase: SupabaseClient) {
  return {
    queryKey: ["staff", "list"] as const,
    queryFn: async (): Promise<StaffMember[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, created_at")
        .order("created_at", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((row) => ({
        id: row.id as string,
        email: row.email as string,
        fullName: row.full_name as string,
        role: row.role as StaffRole,
        createdAt: row.created_at as string,
      }));
    },
  };
}

export function permissionCatalogQuery(supabase: SupabaseClient) {
  return {
    queryKey: ["staff", "permissions"] as const,
    queryFn: async (): Promise<PermissionRow[]> => {
      const { data, error } = await supabase
        .from("permissions")
        .select("key, description")
        .order("key", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((row) => ({
        key: row.key as string,
        description: row.description as string,
      }));
    },
  };
}

export function roleGrantsQuery(supabase: SupabaseClient) {
  return {
    queryKey: ["staff", "grants"] as const,
    queryFn: async (): Promise<Record<string, string[]>> => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("role, permission_key");

      if (error) throw error;

      // Seed every role so a role that currently holds no grants still maps to
      // an empty list, which is the shape the matrix renders.
      const grants: Record<string, string[]> = {};
      for (const role of STAFF_ROLES) grants[role] = [];
      for (const row of data ?? []) {
        const role = row.role as string;
        if (!grants[role]) grants[role] = [];
        grants[role].push(row.permission_key as string);
      }
      return grants;
    },
  };
}

/**
 * Root key for the staff domain. It covers the account list, the catalogue and
 * the grants, so a role's write and a permission toggle can each refresh the
 * whole screen with one invalidation.
 */
export const STAFF_QUERY_KEY = ["staff"] as const;
